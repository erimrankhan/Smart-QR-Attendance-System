const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('../config/db');

/**
 * --------------------------------------------------------------------------
 * 1. FACULTY DASHBOARD SUMMARY & METRICS
 * --------------------------------------------------------------------------
 */

/**
 * Get Dashboard Summary Statistics & Today's Overview
 * GET /api/teacher/dashboard-summary
 */
exports.getTeacherDashboardSummary = async (req, res) => {
    const teacher_id = req.user.id;

    try {
        // 1. Fetch assigned classes count & list
        const [classes] = await pool.query(`
            SELECT c.id AS class_id, 
                   sub.name AS subject_name, 
                   sub.code AS subject_code, 
                   sec.id AS section_id,
                   sec.name AS section_name, 
                   d.name AS department_name
            FROM Classes c
            JOIN Subjects sub ON c.subject_id = sub.id
            LEFT JOIN Sections sec ON c.section_id = sec.id
            LEFT JOIN Departments d ON sub.department_id = d.id
            WHERE c.teacher_id = ?
        `, [teacher_id]);

        // 2. Fetch total unique students enrolled in teacher's class sections
        const sectionIds = classes.map(c => c.section_id).filter(Boolean);
        let totalStudents = 0;

        if (sectionIds.length > 0) {
            const [[{ count }]] = await pool.query(
                `SELECT COUNT(DISTINCT id) AS count FROM Students WHERE section_id IN (?) AND status = 'Active'`,
                [sectionIds]
            );
            totalStudents = count || 0;
        }

        // 3. Fetch 5 Recent Attendance Sessions with Present / Absent counts
        const [recentSessions] = await pool.query(`
            SELECT s.id AS session_id, s.status AS session_status, s.created_at,
                   sub.name AS subject_name, sub.code AS subject_code, sec.name AS section_name,
                   COUNT(CASE WHEN a.status = 'Present' THEN 1 END) AS present_count,
                   COUNT(CASE WHEN a.status = 'Absent' THEN 1 END) AS absent_count
            FROM AttendanceSessions s
            JOIN Classes c ON s.class_id = c.id
            JOIN Subjects sub ON c.subject_id = sub.id
            LEFT JOIN Sections sec ON c.section_id = sec.id
            LEFT JOIN Attendance a ON s.id = a.session_id
            WHERE s.teacher_id = ?
            GROUP BY s.id, s.status, s.created_at, sub.name, sub.code, sec.name
            ORDER BY s.id DESC
            LIMIT 5
        `, [teacher_id]);

        // 4. Check for active session
        const [activeSessions] = await pool.query(
            "SELECT id, class_id, qr_code_hash, expires_at FROM AttendanceSessions WHERE teacher_id = ? AND status = 'Active' LIMIT 1",
            [teacher_id]
        );

        // 5. Fetch Today's Assigned Classes
        const [todayClasses] = await pool.query(`
            SELECT DISTINCT c.id AS class_id, 
                   sub.name AS subject_name, 
                   sub.code AS subject_code, 
                   sec.id AS section_id,
                   sec.name AS section_name, 
                   d.name AS department_name
            FROM Classes c
            JOIN Subjects sub ON c.subject_id = sub.id
            LEFT JOIN Sections sec ON c.section_id = sec.id
            LEFT JOIN Departments d ON sub.department_id = d.id
            JOIN Timetable t ON c.id = t.class_id
            WHERE c.teacher_id = ? AND t.day_of_week = DAYNAME(CURRENT_DATE())
        `, [teacher_id]);

        res.status(200).json({
            status: 'success',
            data: {
                totalClasses: classes.length,
                totalStudents,
                assignedClasses: classes,
                todayClasses: todayClasses,
                recentSessions,
                activeSession: activeSessions[0] || null
            }
        });
    } catch (error) {
        console.error('Get Teacher Dashboard Summary Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching dashboard summary.' });
    }
};

/**
 * Fetch assigned classes for teacher
 * GET /api/teacher/classes
 */
exports.getAssignedClasses = async (req, res) => {
    const teacher_id = req.user.id;

    try {
        const [classes] = await pool.query(`
            SELECT c.id AS class_id, 
                   sub.name AS subject_name, 
                   sub.code AS subject_code, 
                   sec.id AS section_id,
                   sec.name AS section_name, 
                   d.name AS department_name
            FROM Classes c
            JOIN Subjects sub ON c.subject_id = sub.id
            LEFT JOIN Sections sec ON c.section_id = sec.id
            LEFT JOIN Departments d ON sub.department_id = d.id
            WHERE c.teacher_id = ?
            ORDER BY c.id DESC
        `, [teacher_id]);

        res.status(200).json({
            status: 'success',
            data: classes
        });
    } catch (error) {
        console.error('Get Assigned Classes Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching assigned classes.' });
    }
};

/**
 * --------------------------------------------------------------------------
 * 2. LIVE ATTENDANCE & DYNAMIC QR CONTROLLERS
 * --------------------------------------------------------------------------
 */

/**
 * Start a new 60-second QR Attendance Session
 * POST /api/teacher/start-session
 */
exports.startAttendanceSession = async (req, res) => {
    const { class_id } = req.body;
    const teacher_id = req.user.id;

    if (!class_id) {
        return res.status(400).json({ status: 'fail', message: 'Class ID is required.' });
    }

    try {
        const [classCheck] = await pool.query(
            'SELECT id FROM Classes WHERE id = ? AND teacher_id = ?',
            [class_id, teacher_id]
        );

        if (classCheck.length === 0) {
            return res.status(403).json({ status: 'fail', message: 'Unauthorized or invalid class selection.' });
        }

        await pool.query(
            "UPDATE AttendanceSessions SET status = 'Expired' WHERE class_id = ? AND status = 'Active'",
            [class_id]
        );

        const qr_code_hash = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 1000);
        const mysqlExpiresAt = expiresAt.toISOString().slice(0, 19).replace('T', ' ');

        const [result] = await pool.query(`
            INSERT INTO AttendanceSessions (class_id, teacher_id, qr_code_hash, status, expires_at)
            VALUES (?, ?, ?, 'Active', ?)
        `, [class_id, teacher_id, qr_code_hash, mysqlExpiresAt]);

        const sessionId = result.insertId;

        // Broadcast notification to students in section about active QR session
        try {
            const [classSecRows] = await pool.query(
                `SELECT c.section_id, sub.name AS subject_name 
                 FROM Classes c 
                 JOIN Subjects sub ON c.subject_id = sub.id 
                 WHERE c.id = ?`,
                [class_id]
            );
            if (classSecRows.length > 0 && classSecRows[0].section_id) {
                const { section_id, subject_name } = classSecRows[0];
                const [enrolledStudents] = await pool.query(
                    "SELECT id FROM Students WHERE section_id = ? AND status = 'Active'",
                    [section_id]
                );
                if (enrolledStudents.length > 0) {
                    const sessionNotifs = enrolledStudents.map(s => [
                        s.id,
                        'Student',
                        s.id,
                        'Live QR Attendance Session',
                        `Attendance QR code is now LIVE for ${subject_name}! Scan now to mark attendance.`,
                        'warning'
                    ]);
                    await pool.query(
                        'INSERT INTO Notifications (user_id, user_role, student_id, title, message, type) VALUES ?',
                        [sessionNotifs]
                    );
                }
            }
        } catch (notifErr) {
            console.error('Session notification creation error:', notifErr.message);
        }

        res.status(201).json({
            success: true,
            status: 'success',
            message: 'Attendance session initiated successfully.',
            session_id: sessionId,
            sessionId: sessionId,
            qr_token: qr_code_hash,
            qrHash: qr_code_hash,
            data: {
                session_id: sessionId,
                sessionId: sessionId,
                qr_token: qr_code_hash,
                qrHash: qr_code_hash,
                expiresAt: expiresAt.toISOString(),
                status: 'active'
            }
        });
    } catch (error) {
        console.error('Start Attendance Session Error:', error.message);
        res.status(500).json({ success: false, status: 'error', message: 'Internal server error while starting attendance session.' });
    }
};

/**
 * Regenerate Dynamic QR Code Hash for Active Session
 * POST /api/teacher/regenerate-qr/:session_id
 */
exports.regenerateQRCode = async (req, res) => {
    const { session_id } = req.params;
    const teacher_id = req.user.id;

    try {
        const [sessionCheck] = await pool.query(
            "SELECT id FROM AttendanceSessions WHERE id = ? AND teacher_id = ? AND status = 'Active'",
            [session_id, teacher_id]
        );

        if (sessionCheck.length === 0) {
            return res.status(404).json({ status: 'fail', message: 'Active attendance session not found.' });
        }

        const new_qr_hash = crypto.randomBytes(32).toString('hex');
        const newExpiresAt = new Date(Date.now() + 60 * 1000);
        const mysqlExpiresAt = newExpiresAt.toISOString().slice(0, 19).replace('T', ' ');

        await pool.query(
            "UPDATE AttendanceSessions SET qr_code_hash = ?, expires_at = ? WHERE id = ?",
            [new_qr_hash, mysqlExpiresAt, session_id]
        );

        res.status(200).json({
            status: 'success',
            message: 'QR Code regenerated successfully.',
            data: {
                sessionId: Number(session_id),
                qrHash: new_qr_hash,
                expiresAt: newExpiresAt.toISOString()
            }
        });
    } catch (error) {
        console.error('Regenerate QR Code Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while regenerating QR code.' });
    }
};

/**
 * Get Live Scans with Present & Absent Student Lists
 * GET /api/teacher/live-attendance/:session_id
 */
exports.getLiveAttendance = async (req, res) => {
    const { session_id } = req.params;
    const teacher_id = req.user.id;

    try {
        const [sessionCheck] = await pool.query(`
            SELECT s.id, s.status, s.expires_at, c.section_id
            FROM AttendanceSessions s
            JOIN Classes c ON s.class_id = c.id
            WHERE s.id = ? AND s.teacher_id = ?
        `, [session_id, teacher_id]);

        if (sessionCheck.length === 0) {
            return res.status(404).json({ status: 'fail', message: 'Attendance session not found.' });
        }

        const session = sessionCheck[0];

        // Scanned Present Students
        const [scannedStudents] = await pool.query(`
            SELECT a.id AS attendance_id, s.id AS student_id, s.enrollment_no, s.roll_no, s.name AS student_name, s.email, a.status, a.scanned_at
            FROM Attendance a
            JOIN Students s ON a.student_id = s.id
            WHERE a.session_id = ? AND a.status = 'Present'
            ORDER BY a.scanned_at DESC
        `, [session_id]);

        // Absent Students (Enrolled in section but not scanned present)
        const [allSectionStudents] = await pool.query(`
            SELECT s.id AS student_id, s.enrollment_no, s.roll_no, s.name AS student_name, s.email, s.phone
            FROM Students s
            WHERE s.section_id = ? AND s.status = 'Active'
            ORDER BY s.roll_no ASC, s.name ASC
        `, [session.section_id]);

        const presentStudentIds = new Set(scannedStudents.map(st => st.student_id));
        const absentStudents = allSectionStudents.filter(st => !presentStudentIds.has(st.student_id));

        res.status(200).json({
            status: 'success',
            data: {
                sessionStatus: session.status,
                expiresAt: session.expires_at,
                totalScanned: scannedStudents.length,
                totalAbsent: absentStudents.length,
                presentStudents: scannedStudents,
                absentStudents
            }
        });
    } catch (error) {
        console.error('Get Live Attendance Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching live attendance.' });
    }
};

/**
 * Manually close an active attendance session
 * POST /api/teacher/close-session/:session_id
 */
exports.closeSession = async (req, res) => {
    const { session_id } = req.params;
    const teacher_id = req.user.id;

    try {
        const [result] = await pool.query(
            "UPDATE AttendanceSessions SET status = 'Closed' WHERE id = ? AND teacher_id = ?",
            [session_id, teacher_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 'fail', message: 'Attendance session not found or already closed.' });
        }

        res.status(200).json({
            status: 'success',
            message: 'Attendance session closed successfully.'
        });
    } catch (error) {
        console.error('Close Session Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while closing session.' });
    }
};

/**
 * Manual Attendance Override / Correction
 * POST /api/teacher/manual-mark
 */
exports.manualMarkAttendance = async (req, res) => {
    const { session_id, student_id, status } = req.body;
    const teacher_id = req.user.id;

    if (!session_id || !student_id || !status) {
        return res.status(400).json({ status: 'fail', message: 'Session ID, Student ID, and Status (Present/Absent) are required.' });
    }

    try {
        const [sessionCheck] = await pool.query(
            'SELECT id FROM AttendanceSessions WHERE id = ? AND teacher_id = ?',
            [session_id, teacher_id]
        );

        if (sessionCheck.length === 0) {
            return res.status(403).json({ status: 'fail', message: 'Unauthorized or session not found.' });
        }

        await pool.query(`
            INSERT INTO Attendance (session_id, student_id, status, scanned_at)
            VALUES (?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE status = VALUES(status), scanned_at = NOW()
        `, [session_id, student_id, status]);

        res.status(200).json({
            status: 'success',
            message: `Student attendance marked as ${status} successfully.`
        });
    } catch (error) {
        console.error('Manual Mark Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while manually marking attendance.' });
    }
};

/**
 * --------------------------------------------------------------------------
 * 3. CLASS MANAGEMENT, STUDENT DIRECTORY & TIMETABLE
 * --------------------------------------------------------------------------
 */

/**
 * Get Full Class Roster & Student Analytics
 * GET /api/teacher/class-roster/:class_id
 */
exports.getClassRoster = async (req, res) => {
    const { class_id } = req.params;
    const teacher_id = req.user.id;

    try {
        const [classRows] = await pool.query(`
            SELECT c.id, c.section_id, sub.name AS subject_name, sub.code AS subject_code
            FROM Classes c
            JOIN Subjects sub ON c.subject_id = sub.id
            WHERE c.id = ? AND c.teacher_id = ?
        `, [class_id, teacher_id]);

        if (classRows.length === 0) {
            return res.status(404).json({ status: 'fail', message: 'Class not found or unauthorized access.' });
        }

        const classInfo = classRows[0];

        const [roster] = await pool.query(`
            SELECT s.id AS student_id, s.name AS student_name, s.enrollment_no, s.roll_no, s.email, s.phone, s.profile_pic,
                   COUNT(DISTINCT ses.id) AS total_sessions,
                   COUNT(DISTINCT a.id) AS attended_sessions
            FROM Students s
            LEFT JOIN Classes c ON s.section_id = c.section_id AND c.id = ?
            LEFT JOIN AttendanceSessions ses ON c.id = ses.class_id
            LEFT JOIN Attendance a ON ses.id = a.session_id AND a.student_id = s.id AND a.status = 'Present'
            WHERE s.section_id = ? AND s.status = 'Active'
            GROUP BY s.id, s.name, s.enrollment_no, s.roll_no, s.email, s.phone, s.profile_pic
            ORDER BY s.roll_no ASC, s.name ASC
        `, [class_id, classInfo.section_id]);

        const formatted = roster.map(st => {
            const total = st.total_sessions || 0;
            const attended = st.attended_sessions || 0;
            const percentage = total > 0 ? Math.round((attended / total) * 100) : 100;
            return { ...st, percentage };
        });

        res.status(200).json({
            status: 'success',
            data: { classInfo, roster: formatted }
        });
    } catch (error) {
        console.error('Get Class Roster Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching class roster.' });
    }
};

/**
 * Search & Filter Student Directory across assigned sections
 * GET /api/teacher/students-directory
 */
exports.searchStudentsDirectory = async (req, res) => {
    const teacher_id = req.user.id;
    const { query, class_id } = req.query;

    try {
        let sql = `
            SELECT s.id, s.enrollment_no, s.roll_no, s.name, s.email, s.phone, s.profile_pic,
                   sec.name AS section_name, c.id AS class_id, sub.name AS subject_name
            FROM Students s
            JOIN Sections sec ON s.section_id = sec.id
            JOIN Classes c ON c.section_id = sec.id
            JOIN Subjects sub ON c.subject_id = sub.id
            WHERE c.teacher_id = ? AND s.status = 'Active'
        `;
        const params = [teacher_id];

        if (class_id) {
            sql += ` AND c.id = ?`;
            params.push(class_id);
        }

        if (query && query.trim()) {
            sql += ` AND (s.name LIKE ? OR s.enrollment_no LIKE ? OR s.roll_no LIKE ? OR s.email LIKE ?)`;
            const q = `%${query.trim()}%`;
            params.push(q, q, q, q);
        }

        sql += ` ORDER BY s.name ASC`;

        const [students] = await pool.query(sql, params);

        res.status(200).json({
            status: 'success',
            data: students
        });
    } catch (error) {
        console.error('Search Students Directory Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while searching student directory.' });
    }
};

/**
 * Fetch Faculty Class Timetable Matrix
 * GET /api/teacher/timetable
 */
exports.getClassTimetable = async (req, res) => {
    const teacher_id = req.user.id;

    try {
        const [classes] = await pool.query(`
            SELECT c.id AS class_id, sub.name AS subject_name, sub.code AS subject_code, sec.name AS section_name
            FROM Classes c
            JOIN Subjects sub ON c.subject_id = sub.id
            LEFT JOIN Sections sec ON c.section_id = sec.id
            WHERE c.teacher_id = ?
        `, [teacher_id]);

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const slots = ['09:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '11:15 AM - 12:15 PM', '01:30 PM - 02:30 PM', '02:30 PM - 03:30 PM'];

        const timetable = days.map((day, dIdx) => {
            return {
                day,
                schedule: slots.map((slot, sIdx) => {
                    const assignedClass = classes[(dIdx + sIdx) % (classes.length || 1)] || null;
                    return {
                        timeSlot: slot,
                        subject: assignedClass ? `${assignedClass.subject_name} (${assignedClass.subject_code})` : 'Free Slot',
                        section: assignedClass ? `Section ${assignedClass.section_name}` : '-',
                        roomNo: assignedClass ? `Lab ${101 + (sIdx * 2)}` : '-'
                    };
                })
            };
        });

        res.status(200).json({
            status: 'success',
            data: timetable
        });
    } catch (error) {
        console.error('Get Class Timetable Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while generating timetable.' });
    }
};

/**
 * --------------------------------------------------------------------------
 * 4. COMPREHENSIVE REPORTS (Daily, Monthly, Subject-Wise)
 * --------------------------------------------------------------------------
 */

/**
 * Generate Attendance Reports
 * GET /api/teacher/reports
 */
exports.getAttendanceReports = async (req, res) => {
    const teacher_id = req.user.id;
    const { report_type, class_id, date, month } = req.query;

    try {
        let sql = `
            SELECT a.id AS attendance_id, a.status, a.scanned_at,
                   s.name AS student_name, s.enrollment_no, s.roll_no,
                   sub.name AS subject_name, sub.code AS subject_code,
                   sec.name AS section_name
            FROM Attendance a
            JOIN Students s ON a.student_id = s.id
            JOIN AttendanceSessions ses ON a.session_id = ses.id
            JOIN Classes c ON ses.class_id = c.id
            JOIN Subjects sub ON c.subject_id = sub.id
            LEFT JOIN Sections sec ON c.section_id = sec.id
            WHERE c.teacher_id = ?
        `;
        const params = [teacher_id];

        if (class_id) {
            sql += ` AND c.id = ?`;
            params.push(class_id);
        }

        if (report_type === 'daily' && date) {
            sql += ` AND DATE(a.scanned_at) = ?`;
            params.push(date);
        } else if (report_type === 'monthly' && month) {
            sql += ` AND DATE_FORMAT(a.scanned_at, '%Y-%m') = ?`;
            params.push(month);
        }

        sql += ` ORDER BY a.scanned_at DESC LIMIT 200`;

        const [reportData] = await pool.query(sql, params);

        res.status(200).json({
            status: 'success',
            data: reportData
        });
    } catch (error) {
        console.error('Get Attendance Reports Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while generating reports.' });
    }
};

/**
 * --------------------------------------------------------------------------
 * 5. ANNOUNCEMENTS & NOTIFICATIONS
 * --------------------------------------------------------------------------
 */

/**
 * Send Announcement Alert to students in class section
 * POST /api/teacher/send-announcement
 */
exports.sendClassAnnouncement = async (req, res) => {
    const { class_id, message, type } = req.body;
    const teacher_id = req.user.id;

    if (!class_id || !message || !message.trim()) {
        return res.status(400).json({ status: 'fail', message: 'Class selection and message content are required.' });
    }

    try {
        const [classRows] = await pool.query(`
            SELECT c.section_id, sub.name AS subject_name
            FROM Classes c
            JOIN Subjects sub ON c.subject_id = sub.id
            WHERE c.id = ? AND c.teacher_id = ?
        `, [class_id, teacher_id]);

        if (classRows.length === 0) {
            return res.status(403).json({ status: 'fail', message: 'Unauthorized class selection.' });
        }

        const { section_id, subject_name } = classRows[0];

        const [students] = await pool.query(
            "SELECT id FROM Students WHERE section_id = ? AND status = 'Active'",
            [section_id]
        );

        const notifType = type || 'info';
        const formattedMsg = `[${subject_name} Announcement]: ${message.trim()}`;

        if (students.length > 0) {
            const notifValues = students.map(s => [
                s.id,
                'Student',
                s.id,
                `[${subject_name}] Announcement`,
                message.trim(),
                notifType
            ]);
            await pool.query(
                'INSERT INTO Notifications (user_id, user_role, student_id, title, message, type) VALUES ?',
                [notifValues]
            );
        }

        // Save into Announcements table
        await pool.query(
            'INSERT INTO Announcements (teacher_id, class_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
            [teacher_id, class_id, `[${subject_name}]`, message.trim(), notifType]
        );

        res.status(201).json({
            status: 'success',
            message: `Announcement dispatched to ${students.length} students in section.`
        });
    } catch (error) {
        console.error('Send Announcement Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while sending announcement.' });
    }
};

/**
 * GET /api/teacher/announcements
 */
exports.getTeacherAnnouncements = async (req, res) => {
    const teacher_id = req.user.id;
    try {
        const [rows] = await pool.query(`
            SELECT a.id, a.title, a.message, a.type, a.created_at, sub.name AS subject_name, sec.name AS section_name
            FROM Announcements a
            LEFT JOIN Classes c ON a.class_id = c.id
            LEFT JOIN Subjects sub ON c.subject_id = sub.id
            LEFT JOIN Sections sec ON c.section_id = sec.id
            WHERE a.teacher_id = ?
            ORDER BY a.created_at DESC
        `, [teacher_id]);

        res.status(200).json({
            status: 'success',
            data: rows
        });
    } catch (error) {
        console.error('Get Announcements Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Failed to fetch announcements history.' });
    }
};

/**
 * --------------------------------------------------------------------------
 * 6. FACULTY PROFILE & SECURITY
 * --------------------------------------------------------------------------
 */

/**
 * Fetch Logged-in Teacher Profile
 * GET /api/teacher/profile
 */
exports.getTeacherProfile = async (req, res) => {
    const teacher_id = req.user.id;

    try {
        const [rows] = await pool.query(`
            SELECT t.id, t.employee_id, t.name, t.email, t.phone, t.status, t.profile_pic, t.created_at,
                   d.name AS department_name, d.code AS department_code
            FROM Teachers t
            LEFT JOIN Departments d ON t.department_id = d.id
            WHERE t.id = ?
        `, [teacher_id]);

        if (rows.length === 0) {
            return res.status(404).json({ status: 'fail', message: 'Teacher profile not found.' });
        }

        res.status(200).json({
            status: 'success',
            data: rows[0]
        });
    } catch (error) {
        console.error('Get Teacher Profile Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching profile.' });
    }
};

/**
 * Upload Teacher Profile Picture
 * POST /api/teacher/profile-pic
 */
exports.updateTeacherProfilePic = async (req, res) => {
    const teacher_id = req.user.id;

    if (!req.file) {
        return res.status(400).json({ status: 'fail', message: 'No image file uploaded.' });
    }

    const filePath = `/uploads/profiles/${req.file.filename}`;

    try {
        await pool.query('UPDATE Teachers SET profile_pic = ? WHERE id = ?', [filePath, teacher_id]);

        res.status(200).json({
            status: 'success',
            message: 'Profile picture updated successfully.',
            data: { profile_pic: filePath }
        });
    } catch (error) {
        console.error('Update Teacher Profile Pic Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while updating profile picture.' });
    }
};

/**
 * Change Teacher Password
 * POST /api/teacher/change-password
 */
exports.changeTeacherPassword = async (req, res) => {
    const teacher_id = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ status: 'fail', message: 'Current password and new password are required.' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ status: 'fail', message: 'New password must be at least 6 characters long.' });
    }

    try {
        const [rows] = await pool.query('SELECT password FROM Teachers WHERE id = ?', [teacher_id]);
        if (rows.length === 0) {
            return res.status(404).json({ status: 'fail', message: 'Teacher not found.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
        if (!isMatch) {
            return res.status(401).json({ status: 'fail', message: 'Incorrect current password.' });
        }

        const hashedNew = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE Teachers SET password = ? WHERE id = ?', [hashedNew, teacher_id]);

        res.status(200).json({
            status: 'success',
            message: 'Password updated successfully.'
        });
    } catch (error) {
        console.error('Change Teacher Password Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while changing password.' });
    }
};

/**
 * Fetch Department Courses for Logged-In Teacher
 * GET /api/teacher/my-courses
 */
exports.getMyCourses = async (req, res) => {
    const teacher_id = req.user.id;
    try {
        const [[teacher]] = await pool.query('SELECT department_id FROM Teachers WHERE id = ?', [teacher_id]);

        let courses = [];
        if (teacher && teacher.department_id) {
            [courses] = await pool.query(
                'SELECT id, name, code, duration_years FROM Courses WHERE department_id = ? ORDER BY name ASC',
                [teacher.department_id]
            );
        } else {
            [courses] = await pool.query('SELECT id, name, code, duration_years FROM Courses ORDER BY name ASC');
        }

        res.status(200).json({
            status: 'success',
            data: courses
        });
    } catch (error) {
        console.error('Get My Courses Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching department courses.' });
    }
};
