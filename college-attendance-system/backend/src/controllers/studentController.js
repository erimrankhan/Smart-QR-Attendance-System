const bcrypt = require('bcrypt');
const pool = require('../config/db');

/**
 * --------------------------------------------------------------------------
 * MODULE 1: CORE DASHBOARD & SUMMARY
 * --------------------------------------------------------------------------
 */

/**
 * Get Student Dashboard Summary (Today's status, overall %, 5 recent activities)
 * GET /api/student/dashboard-summary
 */
exports.getDashboardSummary = async (req, res) => {
    const student_id = req.user.id;

    try {
        // 1. Fetch Student Basic Profile
        const [studentRows] = await pool.query(
            `SELECT s.id, s.name, s.enrollment_no, s.roll_no, s.email, s.profile_pic, s.course_id, s.semester_id,
                    sec.name AS section_name,
                    COALESCE(c.name, c2.name) AS course_name,
                    COALESCE(d.name, d2.name) AS department_name
             FROM Students s
             LEFT JOIN Sections sec ON s.section_id = sec.id
             LEFT JOIN Semesters sem ON sec.semester_id = sem.id
             LEFT JOIN Courses c ON sem.course_id = c.id
             LEFT JOIN Courses c2 ON s.course_id = c2.id
             LEFT JOIN Departments d ON c.department_id = d.id
             LEFT JOIN Departments d2 ON c2.department_id = d2.id
             WHERE s.id = ?`,
            [student_id]
        );

        if (studentRows.length === 0) {
            return res.status(404).json({ status: 'fail', message: 'Student profile not found.' });
        }

        const student = studentRows[0];

        // 2. Today's Attendance Status Check
        const [todayRows] = await pool.query(`
            SELECT a.status, sub.name AS subject_name, a.scanned_at
            FROM Attendance a
            JOIN AttendanceSessions ses ON a.session_id = ses.id
            JOIN Classes c ON ses.class_id = c.id
            JOIN Subjects sub ON c.subject_id = sub.id
            WHERE a.student_id = ? AND DATE(a.scanned_at) = CURDATE()
            ORDER BY a.scanned_at DESC
            LIMIT 1
        `, [student_id]);

        const todayStatus = todayRows.length > 0 ? {
            marked: true,
            status: todayRows[0].status,
            subject: todayRows[0].subject_name,
            time: todayRows[0].scanned_at
        } : {
            marked: false,
            status: 'Not Marked Today',
            subject: null,
            time: null
        };

        // 3. Calculate Attendance Counts & Overall Percentage
        const [[{ attendedCount }]] = await pool.query(
            "SELECT COUNT(*) AS attendedCount FROM Attendance WHERE student_id = ? AND status = 'Present'",
            [student_id]
        );

        const [[{ totalSessions }]] = await pool.query(
            "SELECT COUNT(*) AS totalSessions FROM AttendanceSessions"
        );

        const attended = attendedCount || 0;
        const total = totalSessions || 0;
        const percentage = total > 0 ? Math.min(100, Math.round((attended / total) * 100)) : 100;

        // 4. Fetch 5 Most Recent Attendance Activities
        const [recentHistory] = await pool.query(`
            SELECT a.id, sub.name AS subject_name, sub.code AS subject_code, 
                   t.name AS teacher_name, a.status, a.scanned_at
            FROM Attendance a
            JOIN AttendanceSessions ses ON a.session_id = ses.id
            JOIN Classes c ON ses.class_id = c.id
            JOIN Subjects sub ON c.subject_id = sub.id
            JOIN Teachers t ON c.teacher_id = t.id
            WHERE a.student_id = ?
            ORDER BY a.scanned_at DESC
            LIMIT 5
        `, [student_id]);

        // 5. Low Attendance Alert Trigger check (<75%)
        if (total > 3 && percentage < 75) {
            const [existingWarning] = await pool.query(
                "SELECT id FROM Notifications WHERE student_id = ? AND type = 'warning' AND DATE(created_at) = CURDATE()",
                [student_id]
            );
            if (existingWarning.length === 0) {
                await pool.query(
                    `INSERT INTO Notifications (student_id, message, type)
                     VALUES (?, ?, 'warning')`,
                    [student_id, `Low Attendance Warning: Your overall attendance is currently at ${percentage}%. Keep it above 75% to stay eligible for exams.`]
                );
            }
        }

        res.status(200).json({
            status: 'success',
            data: {
                student,
                todayStatus,
                stats: {
                    attendancePercentage: percentage,
                    totalClasses: total,
                    attendedClasses: attended,
                    absentClasses: Math.max(0, total - attended)
                },
                recentHistory
            }
        });
    } catch (error) {
        console.error('Get Dashboard Summary Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching dashboard summary.' });
    }
};

/**
 * --------------------------------------------------------------------------
 * MODULE 2: ATTENDANCE ENGINE & ANALYTICS
 * --------------------------------------------------------------------------
 */

/**
 * Mark Attendance via QR Code Scan OR 8-Digit Dynamic PIN Fallback
 * POST /api/student/mark-attendance
 */
exports.markAttendance = async (req, res) => {
    const student_id = req.user ? req.user.id : (req.body.student_id || req.body.studentId);
    let sessionId = req.body.session_id || req.body.sessionId;
    const qrToken = req.body.qr_token || req.body.qrToken || req.body.qrHash;
    const rawPin = req.body.pin || req.body.session_pin || req.body.sessionPin;
    const pin = rawPin ? String(rawPin).trim() : null;

    if (!student_id) {
        return res.status(401).json({
            success: false,
            status: 'fail',
            message: 'Unauthorized. Student login profile required.'
        });
    }

    if (!qrToken && !pin && !sessionId) {
        return res.status(400).json({
            success: false,
            status: 'fail',
            message: 'Either QR Code scan, 8-Digit PIN, or active session is required.'
        });
    }

    try {
        let session = null;

        // CASE 1: Student submitted an 8-Digit PIN (No session_id or with session_id)
        if (pin) {
            const [pinSessions] = await pool.query(`
                SELECT ses.id, ses.qr_code_hash, ses.session_pin, ses.status, sub.name AS subject_name, ses.class_id
                FROM AttendanceSessions ses
                JOIN Classes c ON ses.class_id = c.id
                JOIN Subjects sub ON c.subject_id = sub.id
                WHERE ses.session_pin = ? AND ses.status = 'Active'
                ORDER BY ses.id DESC
                LIMIT 1
            `, [pin]);

            if (pinSessions.length === 0) {
                return res.status(400).json({
                    success: false,
                    status: 'fail',
                    message: 'Invalid or expired 8-Digit Classroom PIN.'
                });
            }

            session = pinSessions[0];
            sessionId = session.id;
        } 
        // CASE 2: Student submitted QR Token / Hash
        else if (qrToken || sessionId) {
            let sessionQuery = `
                SELECT ses.id, ses.qr_code_hash, ses.session_pin, ses.status, sub.name AS subject_name
                FROM AttendanceSessions ses
                JOIN Classes c ON ses.class_id = c.id
                JOIN Subjects sub ON c.subject_id = sub.id
                WHERE ses.status = 'Active'
            `;
            const params = [];

            if (sessionId) {
                sessionQuery += ` AND ses.id = ?`;
                params.push(sessionId);
            }
            if (qrToken) {
                sessionQuery += ` AND ses.qr_code_hash = ?`;
                params.push(String(qrToken).trim());
            }

            const [sessions] = await pool.query(sessionQuery, params);

            if (sessions.length === 0) {
                return res.status(400).json({
                    success: false,
                    status: 'fail',
                    message: 'Attendance QR session is inactive, expired, or invalid.'
                });
            }

            session = sessions[0];
            sessionId = session.id;
        }

        // Check if attendance is already recorded
        const [existing] = await pool.query(
            'SELECT id FROM Attendance WHERE session_id = ? AND student_id = ?',
            [sessionId, student_id]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                status: 'fail',
                message: `Attendance is already marked for ${session.subject_name}.`
            });
        }

        // Record Present Attendance
        await pool.query(
            'INSERT INTO Attendance (session_id, student_id, status, scanned_at) VALUES (?, ?, "Present", NOW())',
            [sessionId, student_id]
        );

        return res.status(200).json({
            success: true,
            status: 'success',
            message: `Attendance marked successfully for ${session.subject_name}!`
        });

    } catch (error) {
        console.error('Attendance Mark Execution Error:', error);
        return res.status(500).json({
            success: false,
            status: 'error',
            message: 'Internal server error while recording attendance.'
        });
    }
};

/**
 * Fetch Detailed Attendance History with Filters (Subject, Daily, Monthly, Semester)
 * GET /api/student/attendance-history
 */
exports.getAttendanceHistory = async (req, res) => {
    const student_id = req.user.id;
    const { subject_id, month, year } = req.query;

    try {
        let query = `
            SELECT a.id, a.status, a.scanned_at,
                   sub.id AS subject_id, sub.name AS subject_name, sub.code AS subject_code, sub.type AS subject_type,
                   t.name AS teacher_name, sem.semester_number
            FROM Attendance a
            JOIN AttendanceSessions ses ON a.session_id = ses.id
            JOIN Classes c ON ses.class_id = c.id
            JOIN Subjects sub ON c.subject_id = sub.id
            JOIN Teachers t ON c.teacher_id = t.id
            LEFT JOIN Semesters sem ON sub.semester_id = sem.id
            WHERE a.student_id = ?
        `;

        const queryParams = [student_id];

        if (subject_id) {
            query += ` AND sub.id = ?`;
            queryParams.push(parseInt(subject_id, 10));
        }

        if (month) {
            query += ` AND MONTH(a.scanned_at) = ?`;
            queryParams.push(parseInt(month, 10));
        }

        if (year) {
            query += ` AND YEAR(a.scanned_at) = ?`;
            queryParams.push(parseInt(year, 10));
        }

        query += ` ORDER BY a.scanned_at DESC`;

        const [history] = await pool.query(query, queryParams);

        res.status(200).json({
            status: 'success',
            data: history
        });
    } catch (error) {
        console.error('Get Attendance History Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching attendance history.' });
    }
};

/**
 * Get Attendance Analytics Breakdown (Subject-wise, Present/Absent Counts)
 * GET /api/student/attendance-analytics
 */
exports.getAttendanceAnalytics = async (req, res) => {
    const student_id = req.user.id;

    try {
        const [subjectWise] = await pool.query(`
            SELECT sub.id AS subject_id,
                   sub.name AS subject_name,
                   sub.code AS subject_code,
                   sub.type AS subject_type,
                   COUNT(DISTINCT ses.id) AS total_classes,
                   COUNT(DISTINCT a.id) AS attended_classes
            FROM Subjects sub
            JOIN Classes c ON sub.id = c.subject_id
            JOIN AttendanceSessions ses ON c.id = ses.class_id
            LEFT JOIN Attendance a ON ses.id = a.session_id AND a.student_id = ? AND a.status = 'Present'
            GROUP BY sub.id, sub.name, sub.code, sub.type
        `, [student_id]);

        const formatted = subjectWise.map(item => {
            const total = item.total_classes || 0;
            const attended = item.attended_classes || 0;
            const absent = Math.max(0, total - attended);
            const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;
            return {
                subject_id: item.subject_id,
                subject_name: item.subject_name,
                subject_code: item.subject_code,
                subject_type: item.subject_type,
                total_classes: total,
                attended_classes: attended,
                absent_classes: absent,
                percentage
            };
        });

        res.status(200).json({
            status: 'success',
            data: formatted
        });
    } catch (error) {
        console.error('Get Attendance Analytics Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching analytics.' });
    }
};

/**
 * --------------------------------------------------------------------------
 * MODULE 3: PROFILE & IDENTITY MANAGEMENT
 * --------------------------------------------------------------------------
 */

exports.getProfile = async (req, res) => {
    const student_id = req.user.id;

    try {
        const [rows] = await pool.query(`
            SELECT s.id, s.enrollment_no, s.roll_no, s.name, s.email, s.phone, s.status, s.profile_pic, s.created_at, s.course_id, s.semester_id,
                   sec.name AS section_name,
                   COALESCE(sem.semester_number, s.semester_id, 1) AS semester_number,
                   COALESCE(c.name, c2.name) AS course_name, COALESCE(c.code, c2.code) AS course_code,
                   COALESCE(d.name, d2.name) AS department_name
            FROM Students s
            LEFT JOIN Sections sec ON s.section_id = sec.id
            LEFT JOIN Semesters sem ON sec.semester_id = sem.id
            LEFT JOIN Courses c ON sem.course_id = c.id
            LEFT JOIN Courses c2 ON s.course_id = c2.id
            LEFT JOIN Departments d ON c.department_id = d.id
            LEFT JOIN Departments d2 ON c2.department_id = d2.id
            WHERE s.id = ?
        `, [student_id]);

        if (rows.length === 0) {
            return res.status(404).json({ status: 'fail', message: 'Student profile not found.' });
        }

        res.status(200).json({
            status: 'success',
            data: rows[0]
        });
    } catch (error) {
        console.error('Get Profile Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching profile.' });
    }
};

exports.updateProfilePic = async (req, res) => {
    const student_id = req.user.id;

    if (!req.file) {
        return res.status(400).json({ status: 'fail', message: 'No image file uploaded.' });
    }

    const filePath = `/uploads/profiles/${req.file.filename}`;

    try {
        await pool.query('UPDATE Students SET profile_pic = ? WHERE id = ?', [filePath, student_id]);

        res.status(200).json({
            status: 'success',
            message: 'Profile picture updated successfully.',
            data: { profile_pic: filePath }
        });
    } catch (error) {
        console.error('Update Profile Pic Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while updating profile picture.' });
    }
};

exports.changePassword = async (req, res) => {
    const student_id = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ status: 'fail', message: 'Current password and new password are required.' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ status: 'fail', message: 'New password must be at least 6 characters long.' });
    }

    try {
        const [rows] = await pool.query('SELECT password FROM Students WHERE id = ?', [student_id]);
        if (rows.length === 0) {
            return res.status(404).json({ status: 'fail', message: 'Student not found.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
        if (!isMatch) {
            return res.status(401).json({ status: 'fail', message: 'Incorrect current password.' });
        }

        const hashedNew = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE Students SET password = ? WHERE id = ?', [hashedNew, student_id]);

        res.status(200).json({
            status: 'success',
            message: 'Password updated successfully.'
        });
    } catch (error) {
        console.error('Change Password Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while updating password.' });
    }
};

/**
 * --------------------------------------------------------------------------
 * MODULE 4: LEAVE MANAGEMENT & NOTIFICATIONS
 * --------------------------------------------------------------------------
 */

exports.applyLeave = async (req, res) => {
    const student_id = req.user.id;
    const { start_date, end_date, reason } = req.body;

    if (!start_date || !end_date || !reason || !reason.trim()) {
        return res.status(400).json({ status: 'fail', message: 'Start date, End date, and Reason are required.' });
    }

    try {
        await pool.query(
            `INSERT INTO LeaveRequests (student_id, start_date, end_date, reason, status)
             VALUES (?, ?, ?, ?, 'Pending')`,
            [student_id, start_date, end_date, reason.trim()]
        );

        await pool.query(
            `INSERT INTO Notifications (student_id, user_id, user_role, title, message, type)
             VALUES (?, ?, 'Student', 'Leave Application Submitted', ?, 'info')`,
            [student_id, student_id, `Leave application submitted for period ${start_date} to ${end_date}. Status: Pending.`]
        );

        res.status(201).json({
            status: 'success',
            message: 'Leave application submitted successfully. Pending Admin review.'
        });
    } catch (error) {
        console.error('Apply Leave Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while submitting leave request.' });
    }
};

exports.getLeaveHistory = async (req, res) => {
    const student_id = req.user.id;

    try {
        const [leaves] = await pool.query(
            `SELECT id, start_date, end_date, reason, status, admin_remark, created_at
             FROM LeaveRequests
             WHERE student_id = ?
             ORDER BY created_at DESC`,
            [student_id]
        );

        res.status(200).json({
            status: 'success',
            data: leaves
        });
    } catch (error) {
        console.error('Get Leave History Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching leave history.' });
    }
};
exports.getMyLeaves = exports.getLeaveHistory;

exports.getNotifications = async (req, res) => {
    const student_id = req.user.id;

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    try {
        const [announcements] = await pool.query(`
            SELECT a.id, a.title, a.message, a.type,
                   COALESCE(a.type, 'info') AS priority,
                   a.created_at,
                   t.name AS faculty_name,
                   s.name AS subject_name,
                   s.code AS subject_code,
                   sec.name AS section_name,
                   'announcement' AS source
            FROM Announcements a
            LEFT JOIN Classes c ON a.class_id = c.id
            LEFT JOIN Teachers t ON a.teacher_id = t.id
            LEFT JOIN Subjects s ON c.subject_id = s.id
            LEFT JOIN Sections sec ON c.section_id = sec.id
            WHERE (
                a.class_id IN (
                    SELECT id FROM Classes 
                    WHERE section_id = (SELECT section_id FROM Students WHERE id = ?)
                       OR section_id IS NULL
                       OR subject_id IN (SELECT id FROM Subjects WHERE course_id = (SELECT course_id FROM Students WHERE id = ?))
                )
                OR a.class_id IS NULL
            )
            ORDER BY a.created_at DESC
            LIMIT 30
        `, [student_id, student_id]);

        const [systemNotifs] = await pool.query(`
            SELECT n.id, n.title, n.message, n.type,
                   COALESCE(n.type, 'info') AS priority,
                   n.is_read, n.created_at,
                   'Administration' AS faculty_name,
                   'System Alert' AS subject_name,
                   NULL AS subject_code,
                   NULL AS section_name,
                   'system' AS source
            FROM Notifications n
            WHERE n.student_id = ? OR (n.user_id = ? AND n.user_role = 'Student')
            ORDER BY n.created_at DESC
            LIMIT 20
        `, [student_id, student_id]);

        const combined = [...announcements, ...systemNotifs].sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );

        res.status(200).json({
            status: 'success',
            success: true,
            data: {
                notifications: combined,
                unreadCount: combined.length
            }
        });
    } catch (error) {
        console.error('Get Notifications Error:', error.message);
        res.status(500).json({ 
            status: 'error', 
            success: false, 
            message: 'Internal server error while fetching notifications.',
            details: error.message 
        });
    }
};
exports.getStudentNotifications = exports.getNotifications;

exports.markNotificationsRead = async (req, res) => {
    const student_id = req.user.id;

    try {
        await pool.query('UPDATE Notifications SET is_read = 1 WHERE student_id = ? OR (user_id = ? AND user_role = "Student")', [student_id, student_id]);

        res.status(200).json({
            status: 'success',
            success: true,
            message: 'Notifications marked as read.'
        });
    } catch (error) {
        console.error('Mark Notifications Read Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while updating notifications.' });
    }
};