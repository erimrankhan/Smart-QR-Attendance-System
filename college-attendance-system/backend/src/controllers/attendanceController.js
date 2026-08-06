/**
 * Smart QR Attendance System - Attendance Controller
 * File: backend/src/controllers/attendanceController.js
 */

const crypto = require('crypto');
const pool = require('../config/db');

/**
 * 1. Backend: Session Creation API
 * POST /api/teacher/start-session or /api/attendance/start-session
 * 
 * Explicitly sets status to 'Active', generates a secure random qr_token (crypto.randomBytes),
 * stores it in the database with the session, and returns it in the JSON response along with session_id.
 */
exports.createAttendanceSession = async (req, res) => {
    const { class_id, course_id } = req.body;
    const teacher_id = req.user ? req.user.id : (req.body.teacher_id || 1);
    const targetClassId = class_id || course_id;

    if (!targetClassId) {
        return res.status(400).json({
            success: false,
            status: 'fail',
            message: 'Class ID or Course ID is required to initiate an attendance session.'
        });
    }

    try {
        // Expire any existing active sessions for this class
        await pool.query(
            "UPDATE AttendanceSessions SET status = 'Expired' WHERE class_id = ? AND (status = 'Active' OR status = 'active')",
            [targetClassId]
        );

        // Generate secure random QR token string using crypto.randomBytes
        const qrToken = crypto.randomBytes(32).toString('hex');

        // Set expiry time (60 seconds)
        const expiresAt = new Date(Date.now() + 60 * 1000);
        const mysqlExpiresAt = expiresAt.toISOString().slice(0, 19).replace('T', ' ');

        // SQL INSERT explicitly sets session status to 'Active'
        const [result] = await pool.query(`
            INSERT INTO AttendanceSessions (class_id, teacher_id, qr_code_hash, status, expires_at)
            VALUES (?, ?, ?, 'Active', ?)
        `, [targetClassId, teacher_id, qrToken, mysqlExpiresAt]);

        const sessionId = result.insertId;

        return res.status(201).json({
            success: true,
            status: 'success',
            message: 'Attendance session initiated successfully.',
            session_id: sessionId,
            sessionId: sessionId,
            qr_token: qrToken,
            qrHash: qrToken,
            data: {
                session_id: sessionId,
                sessionId: sessionId,
                qr_token: qrToken,
                qrHash: qrToken,
                status: 'active',
                expiresAt: expiresAt.toISOString()
            }
        });
    } catch (error) {
        console.error('Error creating attendance session:', error);
        return res.status(500).json({
            success: false,
            status: 'error',
            message: 'Internal server error while creating attendance session.'
        });
    }
};

/**
 * 3. Backend: Mark Attendance API
 * POST /api/student/mark-attendance or /api/attendance/mark-attendance
 * 
 * Strictly checks: SELECT * FROM AttendanceSessions WHERE id = ? AND (status = 'active' OR status = 'Active') AND qr_code_hash = ?
 * If no record is found, returns: { success: false, message: "Attendance session is inactive or QR token is invalid." }
 */
exports.markAttendance = async (req, res) => {
    console.log("RECEIVED BODY:", req.body);

    const sessionId = req.body.session_id || req.body.sessionId;
    const qrToken = req.body.qr_token || req.body.qrToken || req.body.qrHash || req.body.qr_hash;
    const student_id = req.user ? req.user.id : req.body.student_id;

    if (!sessionId) {
        console.log("MISSING SESSION ID IN REQ.BODY:", req.body);
        return res.status(400).json({
            success: false,
            status: 'fail',
            message: 'Session ID is missing from request body.'
        });
    }

    try {
        // Query strictly by session_id without status and token in SQL
        const [sessions] = await pool.query(
            `SELECT * FROM AttendanceSessions WHERE id = ?`,
            [sessionId]
        );

        const sessionRecord = (sessions && sessions.length > 0) ? sessions[0] : null;

        console.log("DB SESSION DATA:", sessionRecord);

        if (!sessionRecord) {
            console.log("SESSION ID NOT FOUND IN DB:", sessionId);
            return res.status(404).json({
                success: false,
                status: 'fail',
                error: "Session ID not found in DB",
                message: "Session ID not found in DB"
            });
        }

        const dbStatus = sessionRecord.status ? String(sessionRecord.status) : '';
        const dbToken = sessionRecord.qr_code_hash || sessionRecord.qr_token || '';

        if (dbStatus.toLowerCase() !== 'active') {
            console.log("STATUS MISMATCH: DB status =", dbStatus, " | EXPECTED = active");
        }

        if (dbToken !== String(qrToken)) {
            console.log("TOKEN MISMATCH: DB =", dbToken, " | REQ =", qrToken);
        }

        if (dbStatus.toLowerCase() !== 'active' || dbToken !== String(qrToken)) {
            return res.status(400).json({
                success: false,
                status: 'fail',
                message: "Attendance session is inactive or QR token is invalid."
            });
        }

        // Check if session has expired based on expiration timestamp
        if (new Date() > new Date(sessionRecord.expires_at)) {
            console.log("SESSION EXPIRED IN DB:", sessionRecord.expires_at);
            await pool.query("UPDATE AttendanceSessions SET status = 'Expired' WHERE id = ?", [sessionId]);
            return res.status(400).json({
                success: false,
                status: 'fail',
                message: 'Attendance session is inactive or QR token is invalid.'
            });
        }

        // Check if student has already scanned for this session
        const [existing] = await pool.query(
            'SELECT id FROM Attendance WHERE session_id = ? AND student_id = ?',
            [sessionId, student_id]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                status: 'fail',
                message: 'Attendance already marked for this class session.'
            });
        }

        // Insert student attendance record
        await pool.query(
            'INSERT INTO Attendance (session_id, student_id, status, scanned_at) VALUES (?, ?, "Present", NOW())',
            [sessionId, student_id]
        );

        return res.status(200).json({
            success: true,
            status: 'success',
            message: 'Attendance marked successfully!'
        });
    } catch (error) {
        console.error('Error marking attendance:', error);
        return res.status(500).json({
            success: false,
            status: 'error',
            message: 'Internal server error while marking attendance.'
        });
    }
};
