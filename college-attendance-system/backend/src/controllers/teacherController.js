const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('../config/db');

// 1. Dashboard Summary
exports.getTeacherDashboardSummary = async (req, res) => {
    const teacher_id = req.user.id;
    try {
        const [assignedClasses] = await pool.query(`
            SELECT c.id, c.id AS class_id, s.name AS subject_name, s.code AS subject_code, 
                   sec.name AS section_name, d.name AS department_name
            FROM Classes c
            LEFT JOIN Subjects s ON c.subject_id = s.id
            LEFT JOIN Sections sec ON c.section_id = sec.id
            LEFT JOIN Departments d ON s.department_id = d.id
            WHERE c.teacher_id = ?
        `, [teacher_id]);

        const [recentSessions] = await pool.query(`
            SELECT ses.id, s.name AS subject_name, s.code AS subject_code, 
                   sec.name AS section_name, ses.created_at, ses.status AS session_status,
                   (SELECT COUNT(*) FROM Attendance a WHERE a.session_id = ses.id AND a.status = 'Present') AS present_count
            FROM AttendanceSessions ses
            JOIN Classes c ON ses.class_id = c.id
            JOIN Subjects s ON c.subject_id = s.id
            JOIN Sections sec ON c.section_id = sec.id
            WHERE ses.teacher_id = ?
            ORDER BY ses.created_at DESC LIMIT 5
        `, [teacher_id]);

        const [studentCount] = await pool.query(`
            SELECT COUNT(DISTINCT s.id) AS total_students
            FROM Students s
            JOIN Classes c ON s.section_id = c.section_id
            WHERE c.teacher_id = ?
        `, [teacher_id]);

        res.status(200).json({
            status: 'success',
            success: true,
            data: {
                totalClasses: assignedClasses.length,
                totalStudents: studentCount[0]?.total_students || 0,
                assignedClasses,
                todayClasses: assignedClasses,
                recentSessions
            }
        });
    } catch (err) {
        console.error('Teacher Dashboard Error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 2. Dropdown Classes Fetch
exports.getAssignedClasses = async (req, res) => {
    const teacher_id = req.user.id;
    try {
        const [classes] = await pool.query(`
            SELECT c.id, c.id AS class_id, s.name AS subject_name, s.code AS subject_code, 
                   sec.name AS section_name
            FROM Classes c
            LEFT JOIN Subjects s ON c.subject_id = s.id
            LEFT JOIN Sections sec ON c.section_id = sec.id
            WHERE c.teacher_id = ?
        `, [teacher_id]);

        res.status(200).json({
            status: 'success',
            success: true,
            data: classes,
            classes: classes
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};
exports.getMyCourses = exports.getAssignedClasses;

// 3. Start Session & PIN Generator
exports.startAttendanceSession = async (req, res) => {
    const { class_id } = req.body;
    const teacher_id = req.user.id;

    if (!class_id) {
        return res.status(400).json({ status: 'fail', message: 'Class ID is required.' });
    }

    try {
        await pool.query(
            "UPDATE AttendanceSessions SET status = 'Expired' WHERE class_id = ? AND status = 'Active'",
            [class_id]
        );

        const qr_code_hash = crypto.randomBytes(32).toString('hex');
        const session_pin = Math.floor(10000000 + Math.random() * 90000000).toString();

        const [result] = await pool.query(`
            INSERT INTO AttendanceSessions (class_id, teacher_id, qr_code_hash, session_pin, status, expires_at)
            VALUES (?, ?, ?, ?, 'Active', DATE_ADD(NOW(), INTERVAL 60 SECOND))
        `, [class_id, teacher_id, qr_code_hash, session_pin]);

        const sessionId = result.insertId;

        res.status(201).json({
            status: 'success',
            success: true,
            sessionId,
            session_id: sessionId,
            qrHash: qr_code_hash,
            qr_token: qr_code_hash,
            session_pin,
            sessionPin: session_pin,
            pin: session_pin,
            data: {
                sessionId,
                session_id: sessionId,
                qrHash: qr_code_hash,
                qr_token: qr_code_hash,
                session_pin,
                sessionPin: session_pin,
                pin: session_pin
            }
        });
    } catch (error) {
        console.error('Start Session Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// 4. Regenerate QR
exports.regenerateQRCode = async (req, res) => {
    const { session_id } = req.params;
    const teacher_id = req.user.id;
    try {
        const new_qr_hash = crypto.randomBytes(32).toString('hex');
        const new_session_pin = Math.floor(10000000 + Math.random() * 90000000).toString();

        await pool.query(
            "UPDATE AttendanceSessions SET qr_code_hash = ?, session_pin = ?, expires_at = DATE_ADD(NOW(), INTERVAL 60 SECOND) WHERE id = ? AND teacher_id = ?",
            [new_qr_hash, new_session_pin, session_id, teacher_id]
        );

        res.status(200).json({
            status: 'success',
            success: true,
            sessionId: Number(session_id),
            session_id: Number(session_id),
            qrHash: new_qr_hash,
            qr_token: new_qr_hash,
            session_pin: new_session_pin,
            pin: new_session_pin
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 5. Live Attendance Scans Polling
exports.getLiveAttendance = async (req, res) => {
    const { session_id } = req.params;
    try {
        const [session] = await pool.query(`
            SELECT s.id, s.status, s.expires_at, s.session_pin, c.section_id
            FROM AttendanceSessions s
            JOIN Classes c ON s.class_id = c.id
            WHERE s.id = ?
        `, [session_id]);

        if (session.length === 0) {
            return res.status(404).json({ status: 'fail', message: 'Session not found' });
        }

        const [scanned] = await pool.query(`
            SELECT st.id AS student_id, st.name AS student_name, st.roll_no, st.enrollment_no, a.scanned_at, a.status
            FROM Attendance a
            JOIN Students st ON a.student_id = st.id
            WHERE a.session_id = ?
            ORDER BY a.scanned_at DESC
        `, [session_id]);

        const [absent] = await pool.query(`
            SELECT st.id AS student_id, st.name AS student_name, st.roll_no, st.enrollment_no, st.phone
            FROM Students st
            WHERE st.section_id = ? 
              AND st.id NOT IN (SELECT student_id FROM Attendance WHERE session_id = ?)
            ORDER BY st.roll_no ASC
        `, [session[0].section_id, session_id]);

        res.status(200).json({
            status: 'success',
            data: {
                sessionStatus: session[0].status,
                sessionPin: session[0].session_pin,
                presentStudents: scanned,
                absentStudents: absent
            }
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 6. Close Session
exports.closeSession = async (req, res) => {
    const { session_id } = req.params;
    try {
        await pool.query("UPDATE AttendanceSessions SET status = 'Closed' WHERE id = ?", [session_id]);
        res.status(200).json({ status: 'success', message: 'Attendance session closed.' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 7. Manual Mark Attendance
exports.manualMarkAttendance = async (req, res) => {
    const { session_id, student_id, status } = req.body;
    try {
        if (status === 'Absent') {
            await pool.query('DELETE FROM Attendance WHERE session_id = ? AND student_id = ?', [session_id, student_id]);
        } else {
            await pool.query(`
                INSERT INTO Attendance (session_id, student_id, status, scanned_at) 
                VALUES (?, ?, 'Present', NOW())
                ON DUPLICATE KEY UPDATE status = 'Present'
            `, [session_id, student_id]);
        }
        res.status(200).json({ status: 'success', message: 'Attendance updated.' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 8. Class Roster
exports.getClassRoster = async (req, res) => {
    const { class_id } = req.params;
    try {
        const [students] = await pool.query(`
            SELECT s.id, s.name, s.roll_no, s.enrollment_no, s.email, s.phone 
            FROM Students s
            JOIN Classes c ON s.section_id = c.section_id
            WHERE c.id = ?
            ORDER BY s.roll_no ASC
        `, [class_id]);
        res.status(200).json({ status: 'success', data: students });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 9. Student Directory
exports.searchStudentsDirectory = async (req, res) => {
    const { query } = req.query;
    try {
        const [students] = await pool.query(`
            SELECT s.id, s.name, s.roll_no, s.enrollment_no, s.email, sec.name AS section_name
            FROM Students s
            LEFT JOIN Sections sec ON s.section_id = sec.id
            WHERE s.name LIKE ? OR s.roll_no LIKE ? OR s.enrollment_no LIKE ?
            LIMIT 50
        `, [`%${query || ''}%`, `%${query || ''}%`, `%${query || ''}%`]);
        res.status(200).json({ status: 'success', data: students });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 10. Timetable
exports.getClassTimetable = async (req, res) => {
    const teacher_id = req.user.id;
    try {
        const [classes] = await pool.query(`
            SELECT c.id, s.name AS subject_name, s.code AS subject_code, sec.name AS section_name
            FROM Classes c
            JOIN Subjects s ON c.subject_id = s.id
            JOIN Sections sec ON c.section_id = sec.id
            WHERE c.teacher_id = ?
        `, [teacher_id]);
        res.status(200).json({ status: 'success', data: classes });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 11. Reports
exports.getAttendanceReports = async (req, res) => {
    const teacher_id = req.user.id;
    try {
        const [reports] = await pool.query(`
            SELECT a.id, st.name AS student_name, st.roll_no, st.enrollment_no, 
                   sub.name AS subject_name, a.status, a.scanned_at
            FROM Attendance a
            JOIN Students st ON a.student_id = st.id
            JOIN AttendanceSessions ses ON a.session_id = ses.id
            JOIN Classes c ON ses.class_id = c.id
            JOIN Subjects sub ON c.subject_id = sub.id
            WHERE c.teacher_id = ?
            ORDER BY a.scanned_at DESC
        `, [teacher_id]);
        res.status(200).json({ status: 'success', data: reports });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 12. Announcements
exports.sendClassAnnouncement = async (req, res) => {
    const teacher_id = req.user.id;
    const { class_id, title, message, type } = req.body;
    try {
        await pool.query(`
            INSERT INTO Announcements (teacher_id, class_id, title, message, type, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        `, [teacher_id, class_id || null, title, message, type || 'info']);
        res.status(201).json({ status: 'success', message: 'Announcement sent.' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

exports.getTeacherAnnouncements = async (req, res) => {
    const teacher_id = req.user.id;
    try {
        const [announcements] = await pool.query(`
            SELECT a.*, s.name AS subject_name
            FROM Announcements a
            LEFT JOIN Classes c ON a.class_id = c.id
            LEFT JOIN Subjects s ON c.subject_id = s.id
            WHERE a.teacher_id = ?
            ORDER BY a.created_at DESC
        `, [teacher_id]);
        res.status(200).json({ status: 'success', data: announcements });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 13. Profile
exports.getTeacherProfile = async (req, res) => {
    const teacher_id = req.user.id;
    try {
        const [rows] = await pool.query('SELECT id, name, email, phone, profile_pic FROM Teachers WHERE id = ?', [teacher_id]);
        if (rows.length === 0) return res.status(404).json({ status: 'fail', message: 'Profile not found' });
        res.status(200).json({ status: 'success', data: rows[0] });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

exports.updateTeacherProfilePic = async (req, res) => {
    const teacher_id = req.user.id;
    if (!req.file) return res.status(400).json({ status: 'fail', message: 'No file' });
    const filePath = `/uploads/profiles/${req.file.filename}`;
    try {
        await pool.query('UPDATE Teachers SET profile_pic = ? WHERE id = ?', [filePath, teacher_id]);
        res.status(200).json({ status: 'success', data: { profile_pic: filePath } });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

exports.changeTeacherPassword = async (req, res) => {
    const teacher_id = req.user.id;
    const { currentPassword, newPassword } = req.body;
    try {
        const [rows] = await pool.query('SELECT password FROM Teachers WHERE id = ?', [teacher_id]);
        const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
        if (!isMatch) return res.status(401).json({ status: 'fail', message: 'Incorrect password.' });

        const hashed = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE Teachers SET password = ? WHERE id = ?', [hashed, teacher_id]);
        res.status(200).json({ status: 'success', message: 'Password updated.' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};