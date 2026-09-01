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

        // Generate secure random QR token string and 8-digit numeric PIN
        const qrToken = crypto.randomBytes(32).toString('hex');
        const sessionPin = Math.floor(10000000 + Math.random() * 90000000).toString();

        // Set expiry time (60 seconds)
        const expiresAt = new Date(Date.now() + 60 * 1000);
        const mysqlExpiresAt = expiresAt.toISOString().slice(0, 19).replace('T', ' ');

        // SQL INSERT explicitly sets session status to 'Active'
        const [result] = await pool.query(`
            INSERT INTO AttendanceSessions (class_id, teacher_id, qr_code_hash, session_pin, status, expires_at)
            VALUES (?, ?, ?, ?, 'Active', ?)
        `, [targetClassId, teacher_id, qrToken, sessionPin, mysqlExpiresAt]);

        const sessionId = result.insertId;

        return res.status(201).json({
            success: true,
            status: 'success',
            message: 'Attendance session initiated successfully.',
            session_id: sessionId,
            sessionId: sessionId,
            qr_token: qrToken,
            qrHash: qrToken,
            session_pin: sessionPin,
            sessionPin: sessionPin,
            pin: sessionPin,
            data: {
                session_id: sessionId,
                sessionId: sessionId,
                qr_token: qrToken,
                qrHash: qrToken,
                session_pin: sessionPin,
                sessionPin: sessionPin,
                pin: sessionPin,
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
 */
exports.markAttendance = async (req, res) => {
    console.log("RECEIVED BODY:", req.body);

    const sessionId = req.body.session_id || req.body.sessionId;
    const qrToken = req.body.qr_token || req.body.qrToken || req.body.qrHash || req.body.qr_hash;
    const rawPin = req.body.pin || req.body.session_pin || req.body.sessionPin;
    const pin = rawPin ? String(rawPin).trim() : null;
    const student_id = req.user ? req.user.id : req.body.student_id;

    if (!qrToken && !pin) {
        return res.status(400).json({
            success: false,
            status: 'fail',
            message: 'QR token or 8-digit Classroom PIN is required.'
        });
    }

    try {
        let sessions = [];
        if (sessionId) {
            const [rows] = await pool.query(
                `SELECT * FROM AttendanceSessions WHERE id = ?`,
                [sessionId]
            );
            sessions = rows;
        } else if (pin) {
            const [rows] = await pool.query(
                `SELECT * FROM AttendanceSessions WHERE session_pin = ? AND (status = 'Active' OR status = 'active') ORDER BY id DESC LIMIT 1`,
                [pin]
            );
            sessions = rows;
        }

        const sessionRecord = (sessions && sessions.length > 0) ? sessions[0] : null;

        if (!sessionRecord) {
            return res.status(404).json({
                success: false,
                status: 'fail',
                message: pin ? "No active session found with this PIN." : "Attendance session not found."
            });
        }

        const dbStatus = sessionRecord.status ? String(sessionRecord.status) : '';
        const dbToken = sessionRecord.qr_code_hash || sessionRecord.qr_token || '';
        const dbPin = sessionRecord.session_pin || '';

        if (dbStatus.toLowerCase() !== 'active') {
            return res.status(400).json({
                success: false,
                status: 'fail',
                message: "Attendance session is inactive or expired."
            });
        }

        let isMatch = false;
        let method = 'QR';
        if (pin && dbPin && dbPin === pin) {
            isMatch = true;
            method = 'PIN';
        } else if (qrToken && dbToken && dbToken === String(qrToken).trim()) {
            isMatch = true;
            method = 'QR';
        }

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                status: 'fail',
                message: pin ? "Invalid 8-digit Classroom PIN." : "Attendance session is inactive or QR token is invalid."
            });
        }

        const targetSessionId = sessionRecord.id;

        // Check if student has already scanned for this session
        const [existing] = await pool.query(
            'SELECT id FROM Attendance WHERE session_id = ? AND student_id = ?',
            [targetSessionId, student_id]
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
