/**
 * Smart QR Attendance System - Complete Student Portal Logic
 * Modules 1-5: Dashboard, QR Scanner, Attendance Analytics, Profile, Leaves/Alerts, and Reports
 */

const HOST_IP = (window.location.hostname && window.location.hostname !== '') ? window.location.hostname : 'localhost';
const SERVER_URL = `http://${HOST_IP}:5000`;
const API_BASE_URL = `${SERVER_URL}/api/student`;

let html5QrcodeScanner = null;
let isScanning = false;
let isProcessingScan = false;
let currentReportData = [];

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initTheme();
    initNavigation();
    loadDashboardData();
    initScannerControls();
    initFormListeners();
    loadNotifications();

    // Show login toast on right side when landing on dashboard
    if (sessionStorage.getItem('justLoggedIn') === 'true') {
        sessionStorage.removeItem('justLoggedIn');
        const userStr = localStorage.getItem('studentUser') || localStorage.getItem('user');
        let displayName = 'Student';
        if (userStr) {
            try {
                const u = JSON.parse(userStr);
                displayName = u.name || u.enrollment_no || 'Student';
            } catch (e) {}
        }
        showToast(`Welcome back, ${displayName}! Logged in successfully.`, 'success');
    }
});

/**
 * --------------------------------------------------------------------------
 * 1. AUTHENTICATION & HEADERS
 * --------------------------------------------------------------------------
 */
function checkAuth() {
    const token = localStorage.getItem('studentToken') || localStorage.getItem('token');
    const userStr = localStorage.getItem('studentUser') || localStorage.getItem('user');

    if (!token || !userStr) {
        redirectToLogin();
        return;
    }

    try {
        const user = JSON.parse(userStr);
        if (user.role !== 'Student') {
            showToast('Access restricted to Student accounts.', 'error');
            redirectToLogin();
            return;
        }

        const nameEl = document.getElementById('student-name-display');
        const enrollEl = document.getElementById('student-enrollment-display');

        const displayName = user.name || user.enrollment_no || 'Student';
        if (nameEl) nameEl.textContent = displayName;
        if (enrollEl) enrollEl.textContent = `Enrollment: ${user.enrollment_no || 'N/A'}`;

        updateTopbarAvatar(user.profile_pic, displayName);

    } catch (e) {
        redirectToLogin();
    }
}

/**
 * Reusable Topbar Avatar Synchronizer
 */
function updateTopbarAvatar(photoUrl, name) {
    const avatarEl = document.getElementById('topbarAvatarContainer') || document.getElementById('student-avatar');
    const sidebarAvatarEl = document.getElementById('sidebarAvatarContainer');
    const sidebarNameEl = document.getElementById('sidebar-student-name');

    const displayName = name || 'My Profile';
    if (sidebarNameEl) sidebarNameEl.textContent = displayName;

    if (photoUrl) {
        const fullUrl = photoUrl.startsWith('http') ? photoUrl : `${SERVER_URL}${photoUrl}`;
        const imgHtml = `<img src="${fullUrl}" class="avatar-img" alt="${name || 'Student'}" style="width: 100%; height: 100%; object-fit: cover;">`;
        if (avatarEl) avatarEl.innerHTML = imgHtml;
        if (sidebarAvatarEl) sidebarAvatarEl.innerHTML = imgHtml;
    } else {
        const initial = (name && name.trim()) ? name.trim().charAt(0).toUpperCase() : 'S';
        if (avatarEl) avatarEl.textContent = initial;
        if (sidebarAvatarEl) sidebarAvatarEl.textContent = initial;
    }
}

function getAuthHeaders() {
    const token = localStorage.getItem('studentToken') || localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

function redirectToLogin() {
    window.location.href = '/attendance/student/login.html';
}

/**
 * --------------------------------------------------------------------------
 * 2. TOAST NOTIFICATION UTILITY
 * --------------------------------------------------------------------------
 */
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4500);
}

/**
 * --------------------------------------------------------------------------
 * 3. THEME TOGGLE SWITCHER
 * --------------------------------------------------------------------------
 */
function initTheme() {
    const themeBtn = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('studentTheme') || 'dark';

    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        document.body.classList.remove('light-mode');
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.body.classList.add('light-mode');
        document.body.classList.remove('dark-mode');
        document.documentElement.setAttribute('data-theme', 'light');
    }

    updateThemeIcon(savedTheme);

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const isDark = document.body.classList.contains('dark-mode') || document.documentElement.getAttribute('data-theme') === 'dark';
            const newTheme = isDark ? 'light' : 'dark';

            if (newTheme === 'dark') {
                document.body.classList.add('dark-mode');
                document.body.classList.remove('light-mode');
                document.documentElement.setAttribute('data-theme', 'dark');
            } else {
                document.body.classList.add('light-mode');
                document.body.classList.remove('dark-mode');
                document.documentElement.setAttribute('data-theme', 'light');
            }

            localStorage.setItem('studentTheme', newTheme);
            updateThemeIcon(newTheme);
        });
    }
}

function updateThemeIcon(theme) {
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        themeBtn.innerHTML = theme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    }
}

/**
 * --------------------------------------------------------------------------
 * 4. VIEW NAVIGATION ENGINE
 * --------------------------------------------------------------------------
 */
function initNavigation() {
    const sidebar = document.getElementById('sidebar');
    const mobileToggle = document.getElementById('mobileMenuToggle');
    const mobileOverlay = document.getElementById('mobileOverlay');

    const toggleMobileMenu = () => {
        if (sidebar) sidebar.classList.toggle('open');
        if (mobileOverlay) mobileOverlay.classList.toggle('active');
    };

    const closeMobileMenu = () => {
        if (sidebar) sidebar.classList.remove('open');
        if (mobileOverlay) mobileOverlay.classList.remove('active');
    };

    if (mobileToggle) mobileToggle.addEventListener('click', toggleMobileMenu);
    if (mobileOverlay) mobileOverlay.addEventListener('click', closeMobileMenu);

    const navItems = document.querySelectorAll('.nav-item[data-view]');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = item.getAttribute('data-view');
            closeMobileMenu();
            switchView(viewId);
        });
    });

    const handleLogout = (e) => {
        if (e) e.preventDefault();
        
        if (typeof showConfirmModal === 'function') {
            showConfirmModal(
                'Confirm Account Logout',
                'Are you sure you want to log out of your Student Portal account?',
                () => {
                    if (typeof stopCameraScan === 'function') stopCameraScan();
                    localStorage.removeItem('studentToken');
                    localStorage.removeItem('studentUser');
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    localStorage.clear();
                    sessionStorage.setItem('justLoggedOut', 'true');
                    window.location.href = 'login.html';
                },
                'Logout',
                'btn-danger'
            );
        } else {
            const confirmLogout = confirm("Are you sure you want to securely logout?");
            if (confirmLogout) {
                if (typeof stopCameraScan === 'function') stopCameraScan();
                localStorage.removeItem('studentToken');
                localStorage.removeItem('studentUser');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.clear();
                sessionStorage.setItem('justLoggedOut', 'true');
                window.location.href = 'login.html';
            }
        }
    };

    document.querySelectorAll('.logout-btn').forEach(button => {
        button.addEventListener('click', handleLogout);
    });

    const topbarAvatar = document.getElementById('topbarAvatarContainer');
    const topbarUserInfo = document.querySelector('.header-user .user-info');
    if (topbarAvatar) {
        topbarAvatar.style.cursor = 'pointer';
        topbarAvatar.addEventListener('click', () => switchView('profile-view'));
    }
    if (topbarUserInfo) {
        topbarUserInfo.style.cursor = 'pointer';
        topbarUserInfo.addEventListener('click', () => switchView('profile-view'));
    }
}

function switchView(viewId) {
    const sections = document.querySelectorAll('.view-section');
    const navItems = document.querySelectorAll('.nav-item');

    sections.forEach(s => s.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));

    const targetSection = document.getElementById(viewId);
    const targetNav = document.querySelector(`.nav-item[data-view="${viewId}"]`);

    if (targetSection) targetSection.classList.add('active');
    if (targetNav) targetNav.classList.add('active');

    // Title Updates
    const titleEl = document.getElementById('view-title');
    const subtitleEl = document.getElementById('view-subtitle');

    if (viewId === 'dashboard-view') {
        if (titleEl) titleEl.textContent = 'Student Dashboard';
        if (subtitleEl) subtitleEl.textContent = 'Attendance analytics and session overview';
        loadDashboardData();
    } else if (viewId === 'scan-view') {
        if (titleEl) titleEl.textContent = 'Camera QR Scanner';
        if (subtitleEl) subtitleEl.textContent = 'Scan live attendance QR code displayed by teacher';
        startCameraScan();
    } else if (viewId === 'history-view') {
        if (titleEl) titleEl.textContent = 'Attendance & Analytics';
        if (subtitleEl) subtitleEl.textContent = 'Detailed subject breakdown and session logs';
        stopCameraScan();
        loadAttendanceAnalytics();
        loadAttendanceHistory();
    } else if (viewId === 'leaves-alerts-view') {
        if (titleEl) titleEl.textContent = 'Leaves & Alerts';
        if (subtitleEl) subtitleEl.textContent = 'Apply for leave and view system notifications';
        stopCameraScan();
        loadLeaveHistory();
        loadNotifications();
    } else if (viewId === 'profile-view') {
        if (titleEl) titleEl.textContent = 'Student Profile & Security';
        if (subtitleEl) subtitleEl.textContent = 'Academic details, profile photo, and password updates';
        stopCameraScan();
        loadProfile();
    } else if (viewId === 'reports-view') {
        if (titleEl) titleEl.textContent = 'Reports & Exports';
        if (subtitleEl) subtitleEl.textContent = 'Generate professional attendance reports in PDF and Print format';
        stopCameraScan();
        loadReportData();
    } else if (viewId === 'materials-view') {
        if (titleEl) titleEl.textContent = 'Course Study Materials';
        if (subtitleEl) subtitleEl.textContent = 'Download lecture notes, PPTs, and study materials shared for your course and term';
        stopCameraScan();
        fetchStudentMaterials();
    }
}

/**
 * --------------------------------------------------------------------------
 * MODULE 6: COURSE STUDY MATERIALS & NOTES
 * --------------------------------------------------------------------------
 */
async function fetchStudentMaterials() {
    const tbody = document.getElementById('student-materials-tbody');
    if (!tbody) return;

    try {
        const userStr = localStorage.getItem('studentUser') || localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : {};

        const course_id = user.course_id;
        const semester_id = user.semester_id;

        let queryParams = '';
        if (course_id && semester_id) {
            queryParams = `?course_id=${course_id}&semester_id=${semester_id}`;
        }

        const token = localStorage.getItem('studentToken') || localStorage.getItem('token');
        const response = await fetch(`${SERVER_URL}/api/materials/student${queryParams}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            const materials = resData.data;

            if (materials.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">No study materials uploaded for your course and semester yet.</td></tr>`;
            } else {
                tbody.innerHTML = materials.map(m => `
                    <tr>
                        <td><strong>${m.title}</strong></td>
                        <td><span style="background: rgba(99, 102, 241, 0.15); color: var(--accent-primary); padding: 3px 10px; border-radius: 12px; font-size: 11.5px; font-weight: 700;">${m.subject_name} (${m.subject_code || ''})</span></td>
                        <td>${m.faculty_name}</td>
                        <td>${new Date(m.upload_date).toLocaleDateString()}</td>
                        <td>
                            <a href="${m.download_url}" download target="_blank" class="btn btn-primary" style="padding: 6px 14px; font-size: 12px; border-radius: 6px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-download"></i> Download
                            </a>
                        </td>
                    </tr>
                `).join('');
            }
        } else {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #ef4444; padding: 24px;">${resData.message || 'Failed to load materials.'}</td></tr>`;
        }
    } catch (err) {
        console.error('Error fetching student study materials:', err);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #ef4444; padding: 24px;">Error connecting to server.</td></tr>`;
    }
}

/**
 * --------------------------------------------------------------------------
 * MODULE 1: DASHBOARD DATA & SUMMARY
 * --------------------------------------------------------------------------
 */
async function loadDashboardData() {
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard-summary`, { headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            const { student, todayStatus, stats, recentHistory } = resData.data;

            // Update Top Bar & Header Profile
            if (student) {
                const nameEl = document.getElementById('student-name-display');
                const enrollEl = document.getElementById('student-enrollment-display');
                if (nameEl) nameEl.textContent = student.name;
                if (enrollEl) enrollEl.textContent = `Enrollment: ${student.enrollment_no}`;
            }

            // Update Today's Status Banner
            const titleBanner = document.getElementById('today-status-title');
            const subBanner = document.getElementById('today-status-subtitle');
            if (titleBanner && subBanner) {
                if (todayStatus.marked) {
                    titleBanner.textContent = `✅ Marked Present: ${todayStatus.subject}`;
                    subBanner.textContent = `Attendance recorded at ${new Date(todayStatus.time).toLocaleTimeString()}`;
                    titleBanner.style.color = '#10b981';
                } else {
                    titleBanner.textContent = `⚡ Ready for Attendance Scan`;
                    subBanner.textContent = `Point camera at projected session QR code when class begins.`;
                    titleBanner.style.color = '#f8fafc';
                }
            }

            // Update Stats Counters
            const percEl = document.getElementById('stat-percentage');
            const totalEl = document.getElementById('stat-total-classes');
            const attEl = document.getElementById('stat-attended-classes');

            if (percEl) percEl.textContent = `${stats.attendancePercentage}%`;
            if (totalEl) totalEl.textContent = stats.totalClasses;
            if (attEl) attEl.textContent = stats.attendedClasses;

            // Update Recent Activity Table
            const recentTbody = document.getElementById('recent-attendance-tbody');
            if (recentTbody) {
                if (recentHistory.length === 0) {
                    recentTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No attendance records found yet.</td></tr>`;
                } else {
                    recentTbody.innerHTML = recentHistory.map(row => `
                        <tr>
                            <td><strong>${row.subject_name}</strong> <span style="font-size:11px; color:var(--text-muted);">(${row.subject_code})</span></td>
                            <td>${row.teacher_name}</td>
                            <td>${new Date(row.scanned_at).toLocaleString()}</td>
                            <td>
                                <span class="badge-present" style="background: rgba(16, 185, 129, 0.15); color: var(--accent-emerald); padding: 4px 10px; border-radius: 12px; font-weight: 700; font-size: 11px;">
                                    ${row.status}
                                </span>
                            </td>
                        </tr>
                    `).join('');
                }
            }
        }
    } catch (err) {
        console.error('Error loading dashboard summary:', err);
    }
}

/**
 * --------------------------------------------------------------------------
 * MODULE 2: QR SCANNER ENGINE
 * --------------------------------------------------------------------------
 */
function initScannerControls() {
    const startBtn = document.getElementById('start-scan-btn');
    const stopBtn = document.getElementById('stop-scan-btn');

    if (startBtn) startBtn.addEventListener('click', startCameraScan);
    if (stopBtn) stopBtn.addEventListener('click', stopCameraScan);
}

function startCameraScan() {
    const feedbackEl = document.getElementById('scan-feedback-message');

    if (isScanning) return;

    if (!html5QrcodeScanner) {
        html5QrcodeScanner = new Html5Qrcode("qr-reader");
    }

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrcodeScanner.start(
        { facingMode: "environment" },
        config,
        onQrCodeScanned,
        onQrScanError
    ).then(() => {
        isScanning = true;
        if (feedbackEl) {
            feedbackEl.textContent = 'Camera active. Align QR code within scanner box.';
            feedbackEl.style.color = '#10b981';
        }
    }).catch(err => {
        console.error("Camera access error:", err);
        if (feedbackEl) {
            feedbackEl.textContent = 'Camera access denied or device camera unavailable.';
            feedbackEl.style.color = '#f43f5e';
        }
    });
}

function stopCameraScan() {
    if (html5QrcodeScanner && isScanning) {
        html5QrcodeScanner.stop().then(() => {
            isScanning = false;
            const feedbackEl = document.getElementById('scan-feedback-message');
            if (feedbackEl) {
                feedbackEl.textContent = 'Camera scan stopped.';
                feedbackEl.style.color = 'var(--text-secondary)';
            }
        }).catch(err => console.error("Error stopping camera:", err));
    }
}

async function onQrCodeScanned(decodedText, decodedResult) {
    if (typeof onScanSuccess === 'function') {
        return await onScanSuccess(decodedText, decodedResult);
    }

    if (isProcessingScan) return;
    isProcessingScan = true;

    showToast('QR Code Detected! Validating session...', 'info');

    try {
        let parsedData = null;
        try {
            parsedData = JSON.parse(decodedText);
        } catch (e) {
            throw new Error('Invalid JSON format');
        }

        const sessionId = parsedData.session_id || parsedData.sessionId;
        const courseId = parsedData.course_id || parsedData.courseId;
        const timestamp = parsedData.timestamp;

        if (!sessionId || !courseId) {
            throw new Error('Missing required QR keys: session_id or course_id.');
        }

        if (timestamp) {
            const ageInMs = Date.now() - timestamp;
            if (isNaN(ageInMs) || ageInMs > 120000) {
                throw new Error('QR code expired (older than 2 minutes).');
            }
        }

        const response = await fetch(`${API_BASE_URL}/mark-attendance`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                sessionId: sessionId,
                qrHash: parsedData.qrHash || parsedData.qr_hash || sessionId
            })
        });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            showToast(resData.message || 'Attendance marked successfully!');
            stopCameraScan();
            setTimeout(() => switchView('dashboard-view'), 1200);
        } else {
            const errMsg = resData.message || 'Failed to mark attendance.';
            if (typeof triggerGlassmorphismErrorPopup === 'function') {
                triggerGlassmorphismErrorPopup(errMsg);
            } else {
                showToast(errMsg, 'error');
            }
        }
    } catch (err) {
        console.error('QR Scanner Validation Error:', err.message);
        const errorMessage = "Invalid QR Format. Please scan a valid live attendance QR code generated by your Faculty.";
        if (typeof triggerGlassmorphismErrorPopup === 'function') {
            triggerGlassmorphismErrorPopup(errorMessage);
        } else {
            showToast(errorMessage, 'error');
        }
    } finally {
        setTimeout(() => { isProcessingScan = false; }, 3000);
    }
}

function onQrScanError(error) {
    // Silent scanning frame errors
}

/**
 * --------------------------------------------------------------------------
 * MODULE 2: ATTENDANCE ANALYTICS & HISTORY
 * --------------------------------------------------------------------------
 */
async function loadAttendanceAnalytics() {
    const tbody = document.getElementById('subject-attendance-tbody');
    const barEl = document.getElementById('analytics-progress-bar');
    const textEl = document.getElementById('analytics-percentage-text');
    if (!tbody) return;

    try {
        const response = await fetch(`${API_BASE_URL}/attendance-analytics`, { headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            const data = resData.data;

            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No subject breakdown available.</td></tr>`;
            } else {
                let totalAtt = 0;
                let totalSess = 0;

                tbody.innerHTML = data.map(item => {
                    totalAtt += item.attended_classes;
                    totalSess += item.total_classes;
                    return `
                        <tr>
                            <td><strong>${item.subject_name}</strong></td>
                            <td>${item.subject_code}</td>
                            <td><span style="background: rgba(99,102,241,0.15); color:#818cf8; padding:2px 8px; border-radius:10px; font-size:11px;">${item.subject_type || 'Theory'}</span></td>
                            <td>${item.attended_classes} / ${item.total_classes}</td>
                            <td>
                                <strong style="color: ${item.percentage >= 75 ? 'var(--accent-emerald)' : 'var(--accent-rose)'}">
                                    ${item.percentage}%
                                </strong>
                            </td>
                        </tr>
                    `;
                }).join('');

                const overall = totalSess > 0 ? Math.round((totalAtt / totalSess) * 100) : 100;
                if (barEl) barEl.style.width = `${overall}%`;
                if (textEl) textEl.textContent = `${overall}% Overall`;
            }
        }
    } catch (err) {
        console.error('Error loading attendance analytics:', err);
    }
}

async function loadAttendanceHistory() {
    const tbody = document.getElementById('full-history-tbody');
    if (!tbody) return;

    try {
        const response = await fetch(`${API_BASE_URL}/attendance-history`, { headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            const history = resData.data;

            if (history.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No attendance history records found.</td></tr>`;
            } else {
                tbody.innerHTML = history.map(row => `
                    <tr>
                        <td><strong>${row.subject_name}</strong> (${row.subject_code})</td>
                        <td>${row.teacher_name}</td>
                        <td>${new Date(row.scanned_at).toLocaleString()}</td>
                        <td>
                            <span class="badge-present" style="background: rgba(16, 185, 129, 0.15); color: var(--accent-emerald); padding: 4px 10px; border-radius: 12px; font-weight: 700; font-size: 11px;">
                                ${row.status}
                            </span>
                        </td>
                    </tr>
                `).join('');
            }
        }
    } catch (err) {
        console.error('Error loading full history:', err);
    }
}

/**
 * --------------------------------------------------------------------------
 * MODULE 3: PROFILE & IDENTITY MANAGEMENT
 * --------------------------------------------------------------------------
 */
async function loadProfile() {
    try {
        const response = await fetch(`${API_BASE_URL}/profile`, { headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            const p = resData.data;

            const nameEl = document.getElementById('prof-name');
            const enrollEl = document.getElementById('prof-enrollment');
            const emailEl = document.getElementById('prof-email');
            const rollEl = document.getElementById('prof-roll');
            const deptEl = document.getElementById('prof-dept');
            const courseEl = document.getElementById('prof-course');
            const secEl = document.getElementById('prof-section');
            const secHeaderEl = document.getElementById('prof-header-section');
            const phoneEl = document.getElementById('prof-phone');

            if (nameEl) nameEl.textContent = p.name;
            if (enrollEl) enrollEl.textContent = `Enrollment No: ${p.enrollment_no}`;
            if (emailEl) emailEl.textContent = p.email || '-';
            if (rollEl) rollEl.textContent = p.roll_no || 'N/A';
            if (deptEl) deptEl.textContent = p.department_name || 'General Academic';
            if (courseEl) courseEl.textContent = `${p.course_name || 'Degree Program'} (Sem ${p.semester_number || 1})`;
            if (secEl) secEl.textContent = p.section_name ? `Section ${p.section_name}` : 'Unassigned';
            if (secHeaderEl) secHeaderEl.textContent = p.section_name ? `Section ${p.section_name}` : 'Unassigned';
            if (phoneEl) phoneEl.textContent = p.phone || 'Not Provided';

            const imgPreview = document.getElementById('profile-img-preview');
            if (imgPreview) {
                imgPreview.src = p.profile_pic ? `${SERVER_URL}${p.profile_pic}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=10b981&color=fff`;
            }

            // Sync Topbar Avatar & LocalStorage
            updateTopbarAvatar(p.profile_pic, p.name);
            const userStr = localStorage.getItem('studentUser') || localStorage.getItem('user');
            if (userStr) {
                try {
                    const u = JSON.parse(userStr);
                    u.profile_pic = p.profile_pic;
                    localStorage.setItem('studentUser', JSON.stringify(u));
                } catch (e) {}
            }
        }
    } catch (err) {
        console.error('Error loading profile:', err);
    }
}

/**
 * --------------------------------------------------------------------------
 * MODULE 4: LEAVE MANAGEMENT & NOTIFICATIONS
 * --------------------------------------------------------------------------
 */
async function loadLeaveHistory() {
    const tbody = document.getElementById('leave-history-tbody');
    const totalEl = document.getElementById('leave-stat-total');
    const appEl = document.getElementById('leave-stat-approved');
    const pendEl = document.getElementById('leave-stat-pending');

    if (!tbody) return;

    try {
        let response = await fetch(`${API_BASE_URL}/student/leaves`, { headers: getAuthHeaders() });
        if (!response.ok && response.status === 404) {
            response = await fetch(`${API_BASE_URL}/leaves`, { headers: getAuthHeaders() });
        }
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            const leaves = resData.data;

            const total = leaves.length;
            const approved = leaves.filter(l => l.status === 'Approved').length;
            const pending = leaves.filter(l => l.status === 'Pending').length;

            if (totalEl) totalEl.textContent = total;
            if (appEl) appEl.textContent = approved;
            if (pendEl) pendEl.textContent = pending;

            if (leaves.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">No leave requests submitted yet.</td></tr>`;
            } else {
                tbody.innerHTML = leaves.map(l => {
                    const start = new Date(l.start_date);
                    const end = new Date(l.end_date);
                    const diffTime = Math.abs(end - start);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

                    let badgeStyle = 'background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3);';
                    let icon = '<i class="fa-solid fa-hourglass-half" style="margin-right: 4px;"></i>';

                    if (l.status === 'Approved') {
                        badgeStyle = 'background: rgba(16, 185, 129, 0.15); color: var(--accent-emerald); border: 1px solid rgba(16, 185, 129, 0.3);';
                        icon = '<i class="fa-solid fa-circle-check" style="margin-right: 4px;"></i>';
                    } else if (l.status === 'Rejected') {
                        badgeStyle = 'background: rgba(244, 63, 94, 0.15); color: var(--accent-rose); border: 1px solid rgba(244, 63, 94, 0.3);';
                        icon = '<i class="fa-solid fa-circle-xmark" style="margin-right: 4px;"></i>';
                    }

                    return `
                        <tr>
                            <td>
                                <strong>${start.toLocaleDateString()}</strong> 
                                <span style="color: var(--text-muted); margin: 0 4px;">to</span> 
                                <strong>${end.toLocaleDateString()}</strong>
                            </td>
                            <td>
                                <span style="background: rgba(255,255,255,0.06); padding: 3px 10px; border-radius: 10px; font-weight: 700; font-size: 11.5px;">
                                    ${diffDays} ${diffDays === 1 ? 'Day' : 'Days'}
                                </span>
                            </td>
                            <td style="max-width: 220px; word-break: break-word;">${l.reason}</td>
                            <td>
                                <span style="${badgeStyle} padding: 5px 12px; border-radius: 14px; font-weight: 700; font-size: 11.5px; display: inline-flex; align-items: center;">
                                    ${icon} ${l.status}
                                </span>
                            </td>
                            <td style="color: ${l.admin_remark ? 'var(--text-primary)' : 'var(--text-muted)'}; font-size: 12.5px;">
                                ${l.admin_remark || '-'}
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }
    } catch (err) {
        console.error('Error loading leave history:', err);
    }
}

async function loadNotifications() {
    const listContainer = document.getElementById('notifications-list');
    const alertCountEl = document.getElementById('leave-stat-alerts');
    if (!listContainer) return;

    try {
        const response = await fetch(`${API_BASE_URL}/notifications`, { headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            const { notifications, unreadCount } = resData.data;

            if (alertCountEl) alertCountEl.textContent = unreadCount !== undefined ? unreadCount : notifications.length;

            if (notifications.length === 0) {
                listContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 24px;">No new notifications or system alerts.</div>`;
            } else {
                listContainer.innerHTML = notifications.map(n => {
                    let borderAccent = '#10b981';
                    let iconClass = 'fa-circle-check';
                    let iconBg = 'rgba(16, 185, 129, 0.15)';
                    let iconColor = '#10b981';

                    if (n.type === 'warning' || n.type === 'danger') {
                        borderAccent = '#f43f5e';
                        iconClass = 'fa-triangle-exclamation';
                        iconBg = 'rgba(244, 63, 94, 0.15)';
                        iconColor = '#f43f5e';
                    } else if (n.type === 'info') {
                        borderAccent = '#6366f1';
                        iconClass = 'fa-info-circle';
                        iconBg = 'rgba(99, 102, 241, 0.15)';
                        iconColor = '#6366f1';
                    }

                    return `
                        <div style="display: flex; gap: 12px; padding: 14px; background: rgba(15, 23, 42, 0.65); border: 1px solid var(--glass-border); border-radius: 14px; border-left: 4px solid ${borderAccent}; transition: transform 0.2s ease;">
                            <div style="width: 36px; height: 36px; border-radius: 10px; background: ${iconBg}; color: ${iconColor}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 16px;">
                                <i class="fa-solid ${iconClass}"></i>
                            </div>
                            <div style="flex: 1;">
                                <div style="font-size: 13px; color: var(--text-primary); font-weight: 600; line-height: 1.4;">${n.message}</div>
                                <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px; display: flex; align-items: center; gap: 6px;">
                                    <i class="fa-solid fa-clock" style="font-size: 10px;"></i> ${new Date(n.created_at).toLocaleString()}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
    } catch (err) {
        console.error('Error loading notifications:', err);
    }
}

async function markAllNotificationsRead() {
    try {
        await fetch(`${API_BASE_URL}/notifications/read`, { method: 'POST', headers: getAuthHeaders() });
        showToast('Notifications marked as read.');
        loadNotifications();
    } catch (err) {
        showToast('Error marking notifications as read.', 'error');
    }
}

/**
 * --------------------------------------------------------------------------
 * MODULE 5: REPORTING ENGINE (PDF & PRINT)
 * --------------------------------------------------------------------------
 */
async function loadReportData() {
    const tbody = document.getElementById('report-tbody');
    const selectFilter = document.getElementById('report-subject-filter');

    try {
        const response = await fetch(`${API_BASE_URL}/attendance-history`, { headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            currentReportData = resData.data;

            // Populate Subject Filter Options if empty
            if (selectFilter && selectFilter.options.length <= 1) {
                const uniqueSubjects = [];
                const seen = new Set();
                currentReportData.forEach(r => {
                    if (!seen.has(r.subject_id)) {
                        seen.add(r.subject_id);
                        uniqueSubjects.push({ id: r.subject_id, name: r.subject_name });
                    }
                });
                uniqueSubjects.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.textContent = s.name;
                    selectFilter.appendChild(opt);
                });
            }

            renderReportTable();
        }
    } catch (err) {
        console.error('Error loading report data:', err);
    }
}

function renderReportTable() {
    const tbody = document.getElementById('report-tbody');
    const filterVal = document.getElementById('report-subject-filter').value;
    if (!tbody) return;

    let filtered = currentReportData;
    if (filterVal) {
        filtered = currentReportData.filter(r => r.subject_id === parseInt(filterVal, 10));
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No records found for selected filter.</td></tr>`;
    } else {
        tbody.innerHTML = filtered.map(row => `
            <tr>
                <td><strong>${row.subject_name}</strong></td>
                <td>${row.subject_code}</td>
                <td>${row.teacher_name}</td>
                <td>${new Date(row.scanned_at).toLocaleString()}</td>
                <td><span style="color: var(--accent-emerald); font-weight: 700;">${row.status}</span></td>
            </tr>
        `).join('');
    }
}

/**
 * Generate & Download Attendance PDF
 */
function exportAttendancePDF() {
    if (!window.jspdf || !currentReportData || currentReportData.length === 0) {
        showToast('No report data available to export.', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Document Header
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('Smart QR Attendance System - Student Report', 14, 20);

    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

    const tableRows = currentReportData.map(r => [
        r.subject_name,
        r.subject_code,
        r.teacher_name,
        new Date(r.scanned_at).toLocaleString(),
        r.status
    ]);

    doc.autoTable({
        startY: 35,
        head: [['Subject Name', 'Code', 'Faculty Member', 'Date & Time', 'Status']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [99, 102, 241] }
    });

    doc.save(`Attendance_Report_${Date.now()}.pdf`);
    showToast('PDF Report generated and downloaded successfully!');
}

/**
 * Print Friendly Report
 */
function printAttendanceReport() {
    window.print();
}

/**
 * --------------------------------------------------------------------------
 * FORM SUBMIT LISTENERS
 * --------------------------------------------------------------------------
 */
function initFormListeners() {
    // Live Leave Duration Calculation
    const startDateInput = document.getElementById('leave-start-date');
    const endDateInput = document.getElementById('leave-end-date');
    const durationBadge = document.getElementById('leave-duration-badge');

    const updateDurationPill = () => {
        if (startDateInput && endDateInput && durationBadge && startDateInput.value && endDateInput.value) {
            const start = new Date(startDateInput.value);
            const end = new Date(endDateInput.value);
            if (end >= start) {
                const diffTime = Math.abs(end - start);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                durationBadge.textContent = `${diffDays} ${diffDays === 1 ? 'Day' : 'Days'}`;
                durationBadge.style.display = 'inline-block';
            } else {
                durationBadge.style.display = 'none';
            }
        }
    };

    if (startDateInput) startDateInput.addEventListener('change', updateDurationPill);
    if (endDateInput) endDateInput.addEventListener('change', updateDurationPill);

    // Leave Request Submission
    const leaveForm = document.getElementById('apply-leave-form');
    if (leaveForm) {
        leaveForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const start_date = document.getElementById('leave-start-date').value;
            const end_date = document.getElementById('leave-end-date').value;
            const leaveTypeEl = document.getElementById('leave-type');
            const leaveType = leaveTypeEl ? leaveTypeEl.value : '';
            const rawReason = document.getElementById('leave-reason').value.trim();
            const reason = leaveType ? `[${leaveType}] ${rawReason}` : rawReason;

            if (new Date(end_date) < new Date(start_date)) {
                showToast('End date cannot be earlier than start date.', 'error');
                return;
            }

            try {
                let response = await fetch(`${API_BASE_URL}/student/leaves`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ start_date, end_date, reason })
                });
                if (!response.ok && response.status === 404) {
                    response = await fetch(`${API_BASE_URL}/leaves`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({ start_date, end_date, reason })
                    });
                }
                const resData = await response.json();

                if (response.ok && resData.status === 'success') {
                    showToast('Leave request submitted successfully!');
                    leaveForm.reset();
                    if (durationBadge) durationBadge.style.display = 'none';
                    loadLeaveHistory();
                } else {
                    showToast(resData.message || 'Failed to submit leave request.', 'error');
                }
            } catch (err) {
                showToast('Error submitting leave application.', 'error');
            }
        });
    }

    // Live Profile Image Preview on File Selection
    const fileInput = document.getElementById('profile-pic-input');
    const imgPreview = document.getElementById('profile-img-preview');

    if (fileInput && imgPreview) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files && fileInput.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    imgPreview.src = e.target.result;
                };
                reader.readAsDataURL(fileInput.files[0]);
            }
        });
    }

    // Password Show/Hide Eye Toggles
    const toggleCurrPass = document.getElementById('toggleCurrPass');
    const currPassInput = document.getElementById('curr-pass');
    if (toggleCurrPass && currPassInput) {
        toggleCurrPass.addEventListener('click', () => {
            const type = currPassInput.getAttribute('type') === 'password' ? 'text' : 'password';
            currPassInput.setAttribute('type', type);
            toggleCurrPass.className = type === 'password' ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
        });
    }

    const toggleNewPass = document.getElementById('toggleNewPass');
    const newPassInput = document.getElementById('new-pass');
    if (toggleNewPass && newPassInput) {
        toggleNewPass.addEventListener('click', () => {
            const type = newPassInput.getAttribute('type') === 'password' ? 'text' : 'password';
            newPassInput.setAttribute('type', type);
            toggleNewPass.className = type === 'password' ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
        });
    }

    // Profile Pic Form
    const picForm = document.getElementById('profile-pic-form');
    if (picForm) {
        picForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('profile-pic-input');
            if (!input.files || input.files.length === 0) return;

            const submitBtn = document.getElementById('pic-upload-btn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Uploading...`;
            }

            const formData = new FormData();
            formData.append('profile_pic', input.files[0]);

            const token = localStorage.getItem('studentToken') || localStorage.getItem('token');

            try {
                const response = await fetch(`${API_BASE_URL}/profile-pic`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                const resData = await response.json();

                if (response.ok && resData.status === 'success') {
                    showToast('Profile picture updated successfully!');
                    const newPhotoUrl = resData.data ? resData.data.profile_pic : null;

                    // Immediately sync localStorage & Topbar Avatar
                    const userStr = localStorage.getItem('studentUser') || localStorage.getItem('user');
                    let userName = 'Student';
                    if (userStr) {
                        try {
                            const u = JSON.parse(userStr);
                            u.profile_pic = newPhotoUrl;
                            userName = u.name || userName;
                            localStorage.setItem('studentUser', JSON.stringify(u));
                        } catch (e) {}
                    }

                    if (newPhotoUrl) {
                        updateTopbarAvatar(newPhotoUrl, userName);
                    }

                    picForm.reset();
                    loadProfile();
                } else {
                    showToast(resData.message || 'Failed to upload profile image.', 'error');
                }
            } catch (err) {
                showToast('Error uploading profile picture.', 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Upload & Save Picture`;
                }
            }
        });
    }

    // Password Change Form
    const passForm = document.getElementById('change-password-form');
    if (passForm) {
        passForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentPassword = document.getElementById('curr-pass').value;
            const newPassword = document.getElementById('new-pass').value;
            const submitBtn = document.getElementById('pass-submit-btn');

            if (newPassword.length < 6) {
                showToast('New password must be at least 6 characters.', 'error');
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Updating...`;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/change-password`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ currentPassword, newPassword })
                });
                const resData = await response.json();

                if (response.ok && resData.status === 'success') {
                    showToast('Password updated successfully!');
                    passForm.reset();
                } else {
                    showToast(resData.message || 'Failed to change password.', 'error');
                }
            } catch (err) {
                showToast('Error updating password.', 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Update Password`;
                }
            }
        });
    }
}
