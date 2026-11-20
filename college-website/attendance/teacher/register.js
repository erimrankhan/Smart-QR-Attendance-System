/**
 * Smart QR Attendance System - Faculty Registration Logic
 */

// Localhost Backend Configuration
window.BACKEND_API_URL = window.API_BASE_URL || 
    (window.location.protocol.startsWith('http') 
        ? window.location.origin 
        : "http://localhost:5000");

const BASE_SERVER_URL = window.BACKEND_API_URL;
const AUTH_API_URL = `${BASE_SERVER_URL}/api/auth`;

// Faculty OTP Verification State
let isFacultyEmailVerified = false;
let facultyOtpCooldownTimer = null;
let facultyOtpSecondsRemaining = 0;

window.onload = async () => {
    await fetchDepartments();
    initFacultyOtpHandlers();
    initRegistrationForm();
};

/**
 * Initialize Faculty OTP Verification Handlers
 */
function initFacultyOtpHandlers() {
    const emailInput = document.getElementById('email');
    const sendOtpBtn = document.getElementById('sendFacultyOtpBtn');
    const otpBox = document.getElementById('facultyOtpBox');
    const otpInput = document.getElementById('facultyOtpInput');
    const verifyOtpBtn = document.getElementById('verifyFacultyOtpBtn');
    const otpStatusMsg = document.getElementById('facultyOtpStatus');
    const changeEmailBtn = document.getElementById('changeFacultyEmailBtn');
    const verifiedBadge = document.getElementById('facultyEmailVerifiedBadge');

    // 1. Cooldown Timer Handler
    function startFacultyOtpCooldown(duration = 60) {
        facultyOtpSecondsRemaining = duration;
        if (sendOtpBtn) {
            sendOtpBtn.disabled = true;
            sendOtpBtn.innerHTML = `<i class="fa-solid fa-clock"></i> <span>Resend (${facultyOtpSecondsRemaining}s)</span>`;
        }

        clearInterval(facultyOtpCooldownTimer);
        facultyOtpCooldownTimer = setInterval(() => {
            facultyOtpSecondsRemaining--;
            if (facultyOtpSecondsRemaining <= 0) {
                clearInterval(facultyOtpCooldownTimer);
                if (sendOtpBtn && !isFacultyEmailVerified) {
                    sendOtpBtn.disabled = false;
                    sendOtpBtn.innerHTML = `<i class="fa-solid fa-rotate-right"></i> <span>Resend OTP</span>`;
                }
            } else {
                if (sendOtpBtn && !isFacultyEmailVerified) {
                    sendOtpBtn.innerHTML = `<i class="fa-solid fa-clock"></i> <span>Resend (${facultyOtpSecondsRemaining}s)</span>`;
                }
            }
        }, 1000);
    }

    // 2. Send OTP Click
    if (sendOtpBtn) {
        sendOtpBtn.addEventListener('click', async () => {
            const emailVal = emailInput ? emailInput.value.trim() : '';

            if (!emailVal) {
                showToast('Please enter your institutional email address first.', 'warning');
                if (emailInput) emailInput.focus();
                return;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailVal)) {
                showToast('Please enter a valid email address format.', 'error');
                if (emailInput) emailInput.focus();
                return;
            }

            sendOtpBtn.disabled = true;
            sendOtpBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Sending...</span>`;

            try {
                const response = await fetch(`${AUTH_API_URL}/send-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailVal, role: 'faculty' })
                });
                const resData = await response.json();

                if (response.ok && resData.status === 'success') {
                    showToast(resData.message || `OTP sent to ${emailVal}`);

                    if (otpBox) {
                        otpBox.style.display = 'flex';
                        otpBox.classList.add('active');
                    }
                    if (emailInput) emailInput.readOnly = true;
                    if (changeEmailBtn) changeEmailBtn.style.display = 'inline-block';
                    if (otpInput) {
                        otpInput.value = '';
                        otpInput.focus();
                    }
                    if (otpStatusMsg) {
                        otpStatusMsg.innerHTML = `<i class="fa-solid fa-paper-plane" style="color: var(--accent-teal);"></i> Code sent to <strong style="color: var(--text-primary);">${emailVal}</strong> (valid 10m)`;
                    }

                    startFacultyOtpCooldown(60);
                } else {
                    showToast(resData.message || 'Failed to send OTP.', 'error');
                    sendOtpBtn.disabled = false;
                    sendOtpBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> <span>Send OTP</span>`;
                }
            } catch (err) {
                console.error('Send OTP Network Error:', err);
                showToast('Network error while requesting verification OTP.', 'error');
                sendOtpBtn.disabled = false;
                sendOtpBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> <span>Send OTP</span>`;
            }
        });
    }

    // 3. Verify OTP Click
    if (verifyOtpBtn) {
        verifyOtpBtn.addEventListener('click', async () => {
            const emailVal = emailInput ? emailInput.value.trim() : '';
            const otpVal = otpInput ? otpInput.value.trim() : '';

            if (!otpVal || otpVal.length < 4) {
                showToast('Please enter the 6-digit OTP code.', 'warning');
                if (otpInput) otpInput.focus();
                return;
            }

            verifyOtpBtn.disabled = true;
            verifyOtpBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Verifying...</span>`;

            try {
                const response = await fetch(`${AUTH_API_URL}/verify-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailVal, otp: otpVal })
                });
                const resData = await response.json();

                if (response.ok && resData.status === 'success') {
                    isFacultyEmailVerified = true;
                    clearInterval(facultyOtpCooldownTimer);

                    showToast('Official email verified successfully!', 'success');

                    if (verifiedBadge) verifiedBadge.style.display = 'inline-flex';
                    if (sendOtpBtn) sendOtpBtn.style.display = 'none';
                    if (otpBox) otpBox.style.display = 'none';
                    if (emailInput) {
                        emailInput.readOnly = true;
                        emailInput.style.borderColor = '#10b981';
                    }
                } else {
                    showToast(resData.message || 'Invalid or expired OTP code.', 'error');
                    verifyOtpBtn.disabled = false;
                    verifyOtpBtn.innerHTML = `<i class="fa-solid fa-check"></i> <span>Verify OTP</span>`;
                    if (otpInput) {
                        otpInput.style.borderColor = '#f43f5e';
                        otpInput.focus();
                    }
                }
            } catch (err) {
                console.error('Verify OTP Network Error:', err);
                showToast('Network error during OTP verification.', 'error');
                verifyOtpBtn.disabled = false;
                verifyOtpBtn.innerHTML = `<i class="fa-solid fa-check"></i> <span>Verify OTP</span>`;
            }
        });
    }

    // 4. Change Email Click
    if (changeEmailBtn) {
        changeEmailBtn.addEventListener('click', () => {
            clearInterval(facultyOtpCooldownTimer);
            isFacultyEmailVerified = false;
            if (emailInput) {
                emailInput.readOnly = false;
                emailInput.style.borderColor = '';
                emailInput.focus();
            }
            if (otpBox) {
                otpBox.style.display = 'none';
                otpBox.classList.remove('active');
            }
            if (sendOtpBtn) {
                sendOtpBtn.disabled = false;
                sendOtpBtn.style.display = 'inline-flex';
                sendOtpBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> <span>Send OTP</span>`;
            }
            if (verifiedBadge) verifiedBadge.style.display = 'none';
            if (otpInput) otpInput.value = '';
        });
    }
}

/**
 * Fetch Public Departments for Dropdown
 */
async function fetchDepartments() {
    const deptSelect = document.getElementById('departmentSelect');
    if (!deptSelect) return;

    try {
        const response = await fetch(`${AUTH_API_URL}/public-departments`);
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            const departments = resData.data;
            if (departments.length === 0) {
                deptSelect.innerHTML = '<option value="">No departments available</option>';
            } else {
                deptSelect.innerHTML = '<option value="">Select your Department *</option>' +
                    departments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
            }
        } else {
            deptSelect.innerHTML = '<option value="">Failed to load departments</option>';
        }
    } catch (err) {
        console.error('Error fetching departments:', err);
        deptSelect.innerHTML = '<option value="">Error connecting to server</option>';
    }
}

/**
 * Handle Faculty Form Submission
 */
function initRegistrationForm() {
    const form = document.getElementById('faculty-register-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Email OTP Verification Guard
        if (!isFacultyEmailVerified) {
            showToast('Please verify your official email address via OTP first.', 'warning');
            const otpBox = document.getElementById('facultyOtpBox');
            const sendOtpBtn = document.getElementById('sendFacultyOtpBtn');
            const otpInput = document.getElementById('facultyOtpInput');

            if (!otpBox || !otpBox.classList.contains('active')) {
                if (sendOtpBtn) sendOtpBtn.click();
            } else if (otpInput) {
                otpInput.focus();
            }
            return;
        }

        const name = document.getElementById('name').value.trim();
        const employee_id = document.getElementById('employee_id') ? document.getElementById('employee_id').value.trim() : '';
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const phone = document.getElementById('phone').value.trim();
        const rawDeptId = document.getElementById('departmentSelect').value;
        const submitBtn = document.getElementById('register-btn');

        if (!rawDeptId) {
            showToast('Please select your academic department.', 'error');
            return;
        }

        const department_id = parseInt(rawDeptId, 10);
        if (isNaN(department_id)) {
            showToast('Invalid Department selected.', 'error');
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Submitting Registration...`;
        }

        try {
            const response = await fetch(`${AUTH_API_URL}/teacher/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, employee_id, email, password, phone, department_id })
            });

            const resData = await response.json();

            if (response.ok && resData.status === 'success') {
                showToast('Registration submitted successfully! Please wait for Admin approval.');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);
            } else {
                showToast(resData.message || 'Registration failed. Please try again.', 'error');
            }
        } catch (err) {
            console.error('Faculty Register Error:', err);
            showToast('Network error while connecting to authentication server.', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fa-solid fa-user-plus"></i> Submit Faculty Registration`;
            }
        }
    });
}

/**
 * Utility Toast Notification Display
 */
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-xmark';
    if (type === 'warning') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}