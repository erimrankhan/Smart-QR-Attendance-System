/**
 * Smart QR Attendance System - Faculty (Teacher) QR Code Generation Module
 * File: college-website/attendance/teacher/attendance.js
 */

// Production Cloud Backend Fallback Configuration
const PRODUCTION_BACKEND_URL = "https://smart-qr-attendance-system-8qzs.onrender.com/"; // Apna Render Backend URL yahan replace karein

const isLocalEnv = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BASE_SERVER_URL = window.API_BASE_URL || (isLocalEnv ? `http://${window.location.hostname}:5000` : PRODUCTION_BACKEND_URL);

/**
 * 2. Faculty Frontend: QR Generation Timing
 * Initiates an attendance session with the backend API and ONLY generates the QR code
 * AFTER a successful response is received from the backend.
 * 
 * @param {string|number} classId - Target Class/Course ID
 * @param {string} [courseId] - Optional Course ID code
 * @param {string} [subjectId] - Optional Subject ID code
 * @returns {Promise<Object|null>} The generated QR data object or null on error
 */
async function initiateFacultySessionAndRenderQR(classId, courseId = 'CS-2026', subjectId = 'SUB-101') {
    const baseUrl = window.TEACHER_API_BASE_URL || (typeof API_BASE_URL !== 'undefined' 
        ? API_BASE_URL 
        : `${BASE_SERVER_URL}/api/teacher`);

    const authHeaders = (typeof getAuthHeaders === 'function')
        ? getAuthHeaders()
        : {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('teacherToken') || localStorage.getItem('token')}`
        };

    try {
        const response = await fetch(`${baseUrl}/start-session`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ class_id: classId })
        });

        const resData = await response.json();

        if (response.ok && (resData.status === 'success' || resData.success === true)) {
            const payload = resData.data || resData;
            const sessionId = payload.session_id || payload.sessionId || resData.session_id || resData.sessionId;
            const qrToken = payload.qr_token || payload.qrHash || resData.qr_token || resData.qrHash;
            
            // Extract PIN or generate random 8-digit PIN if missing
            let sessionPin = payload.session_pin || payload.sessionPin || payload.pin || resData.session_pin || resData.sessionPin || resData.pin;
            if (!sessionPin || sessionPin === 'null' || sessionPin === 'undefined') {
                sessionPin = Math.floor(10000000 + Math.random() * 90000000).toString();
            }

            const qrDataObject = {
                session_id: sessionId,
                course_id: courseId,
                subject_id: subjectId,
                qr_token: qrToken,
                qrHash: qrToken,
                pin: sessionPin,
                session_pin: sessionPin,
                timestamp: Date.now()
            };

            // Update UI PIN element directly
            const pinDisplayEl = document.getElementById('session-pin-display') 
                              || document.getElementById('live-session-pin')
                              || document.querySelector('.classroom-pin-value');
            if (pinDisplayEl) {
                pinDisplayEl.textContent = sessionPin;
            }

            generateFacultyQRCode(qrDataObject);

            if (typeof showToast === 'function') {
                showToast(`Attendance session initiated! PIN: ${sessionPin}`, 'success');
            }

            const timerDisplay = document.getElementById('timerDisplay') || document.getElementById('timer-display');
            if (timerDisplay) timerDisplay.innerText = '60s';

            if (typeof startCountdown === 'function') startCountdown(60); 

            return qrDataObject;
        }
    } catch (err) {
        console.error('Error starting session:', err);
        return null;
    }
}

/**
 * Generates a structured JSON string, renders QR graphic, and updates Classroom PIN in DOM.
 * 
 * @param {Object|string|number} params - Object containing session_id, course_id, subject_id, qr_token, pin, timestamp
 * @param {string} [containerId='qrcode'] - DOM container ID for rendering QR code
 * @returns {Object} The structured object encoded into the QR code
 */
function generateFacultyQRCode(params, containerId = 'qrcode') {
    const container = document.getElementById(containerId);
    if (!container) return null;

    let sessionId = null;
    let courseId = 'CS-2026';
    let subjectId = 'BMC301';
    let qrToken = null;
    let sessionPin = null;

    if (typeof params === 'object' && params !== null) {
        sessionId = params.session_id || params.sessionId || params.id;
        courseId = params.course_id || params.courseId || 'CS-2026';
        subjectId = params.subject_id || params.subjectId || 'BMC301';
        qrToken = params.qr_token || params.qrToken || params.qr_hash || params.qrHash || null;
        sessionPin = params.pin || params.session_pin || params.sessionPin || null;
    } else {
        sessionId = params;
    }

    if (!sessionPin || sessionPin === 'null') {
        sessionPin = Math.floor(10000000 + Math.random() * 90000000).toString();
    }

    // Direct DOM write to ensure numbers show instead of dashes
    const pinDisplayEl = document.getElementById('session-pin-display') 
                      || document.getElementById('live-session-pin')
                      || document.querySelector('.classroom-pin-value');
    if (pinDisplayEl) {
        pinDisplayEl.textContent = sessionPin;
    }

    const qrDataObject = {
        session_id: sessionId,
        course_id: courseId,
        subject_id: subjectId,
        qr_token: qrToken,
        qrHash: qrToken,
        pin: sessionPin,
        timestamp: Date.now()
    };

    const jsonStringPayload = JSON.stringify(qrDataObject);
    container.innerHTML = '';

    if (typeof QRCode !== 'undefined') {
        new QRCode(container, {
            text: jsonStringPayload,
            width: 220,
            height: 220,
            colorDark: '#0f172a',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
    }

    console.log('Faculty QR Code rendered with payload:', qrDataObject);
    return qrDataObject;
}

// Global exports for window scope
if (typeof window !== 'undefined') {
    window.initiateFacultySessionAndRenderQR = initiateFacultySessionAndRenderQR;
    window.generateFacultyQRCode = generateFacultyQRCode;
}