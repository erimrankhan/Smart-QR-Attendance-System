/**
 * Smart QR Attendance System - Faculty (Teacher) QR Code Generation Module
 * File: college-website/attendance/teacher/attendance.js
 */

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
    const HOST_IP = (window.location.hostname && window.location.hostname !== '') ? window.location.hostname : 'localhost';
    const baseUrl = (typeof API_BASE_URL !== 'undefined') 
        ? API_BASE_URL 
        : `http://${HOST_IP}:5000/api/teacher`;

    const authHeaders = (typeof getAuthHeaders === 'function')
        ? getAuthHeaders()
        : {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('teacherToken') || localStorage.getItem('token')}`
        };

    try {
        // Step 1: Call Backend Session Creation API
        const response = await fetch(`${baseUrl}/start-session`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ class_id: classId })
        });

        const resData = await response.json();

        // Step 2: ONLY generate QR code AFTER successful response from backend
        if (response.ok && (resData.status === 'success' || resData.success === true)) {
            // Extract session_id and qr_token from backend success response
            const payload = resData.data || resData;
            const sessionId = payload.session_id || payload.sessionId || resData.session_id || resData.sessionId;
            const qrToken = payload.qr_token || payload.qrHash || resData.qr_token || resData.qrHash;

            if (!sessionId || !qrToken) {
                console.error('Backend response missing session_id or qr_token:', resData);
                if (typeof showToast === 'function') {
                    showToast('Backend response missing required QR token session data.', 'error');
                }
                return null;
            }

            // Step 3: Package exact values into JSON object
            const qrDataObject = {
                session_id: sessionId,
                course_id: courseId,
                subject_id: subjectId,
                qr_token: qrToken,
                qrHash: qrToken,
                timestamp: Date.now()
            };

            // Render QR code graphic using QRCode.js
            generateFacultyQRCode(qrDataObject);

            if (typeof showToast === 'function') {
                showToast('Attendance session initiated! Dynamic QR Code active.', 'success');
            }

            // --- NAYA TIMER CODE YAHAN ADD KIYA GAYA HAI ---
            const timerDisplay = document.getElementById('timerDisplay');
            if (timerDisplay) {
                timerDisplay.innerText = '60';
            }

            if (typeof startCountdown === 'function') {
                startCountdown(); 
            } else if (typeof startTimer === 'function') {
                startTimer();
            }
            // --- NAYA TIMER CODE YAHAN KHATAM HOTA HAI ---

            return qrDataObject;
        } else {
            const errorMsg = resData.message || 'Failed to start session on backend.';
            console.error('Session creation failed:', errorMsg);
            if (typeof showToast === 'function') {
                showToast(errorMsg, 'error');
            }
            return null;
        }
    } catch (err) {
        console.error('Network/Server error initiating session:', err);
        if (typeof showToast === 'function') {
            showToast('Error connecting to backend server.', 'error');
        }
        return null;
    }
}

/**
 * Generates a structured JSON string and renders the QR code graphic using QRCode.js
 * 
 * @param {Object|string|number} params - Object containing session_id, course_id, subject_id, qr_token, timestamp
 * @param {string} [containerId='qrcode'] - DOM container ID for rendering QR code
 * @returns {Object} The structured object encoded into the QR code
 */
function generateFacultyQRCode(params, containerId = 'qrcode') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`QR Code container "#${containerId}" not found in DOM.`);
        return null;
    }

    let sessionId = null;
    let courseId = null;
    let subjectId = null;
    let qrToken = null;

    if (typeof params === 'object' && params !== null) {
        sessionId = params.session_id || params.sessionId || params.id;
        courseId = params.course_id || params.courseId || params.class_id || params.classId || 'CS-2026';
        subjectId = params.subject_id || params.subjectId || params.subject_code || 'SUB-101';
        qrToken = params.qr_token || params.qrToken || params.qr_hash || params.qrHash || null;
    } else {
        sessionId = params;
        courseId = 'CS-2026';
        subjectId = 'SUB-101';
    }

    // Create structured JavaScript object
    const qrDataObject = {
        session_id: sessionId,
        course_id: courseId,
        subject_id: subjectId,
        qr_token: qrToken,
        qrHash: qrToken,
        timestamp: Date.now()
    };

    // Use JSON.stringify() to convert object into a secure JSON string
    const jsonStringPayload = JSON.stringify(qrDataObject);

    // Pass JSON string to QRCode.js to render graphic
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
    } else {
        console.error('QRCode.js library is not loaded.');
    }

    console.log('Faculty QR Code rendered with payload:', qrDataObject);
    return qrDataObject;
}

// Global exports for window scope
if (typeof window !== 'undefined') {
    window.initiateFacultySessionAndRenderQR = initiateFacultySessionAndRenderQR;
    window.generateFacultyQRCode = generateFacultyQRCode;
}