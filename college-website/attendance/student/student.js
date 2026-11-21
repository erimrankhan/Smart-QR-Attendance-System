/**
 * Smart QR Attendance System - Complete Student Portal Logic
 * Modules 1-5: Dashboard, QR Scanner, Attendance Analytics, Profile, Leaves/Alerts, and Reports
 */

// Localhost Backend Configuration
window.BACKEND_API_URL = window.API_BASE_URL || 
    (window.location.protocol.startsWith('http') 
        ? window.location.origin 
        : "http://localhost:5000");

var BASE_SERVER_URL = window.BACKEND_API_URL;
var SERVER_URL = BASE_SERVER_URL;
var API_BASE_URL = window.STUDENT_API_BASE_URL || `${SERVER_URL}/api/student`;

let html5QrcodeScanner = null;
let isScanning = false;
let isProcessingScan = false;
let currentReportData = [];

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', async () => {
    // Dismiss any hanging loaders immediately on page entrance
    if (typeof hideLoading === 'function') hideLoading();
    const hungLoader = document.getElementById('global-loader');
    if (hungLoader) {
        hungLoader.classList.remove('active');
        hungLoader.style.display = 'none';
        hungLoader.style.pointerEvents = 'none';
    }

    checkAuth();
    initTheme();
    initNavigation();
    initScannerControls();
    initFormListeners();

    try {
        await Promise.allSettled([
            loadDashboardData(),
            loadNotifications()
        ]);
    } catch (err) {
        console.warn('Initial student data load warning:', err);
    } finally {
        if (typeof hideLoading === 'function') hideLoading();
    }

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
        const sidebarNameEl = document.getElementById('sidebar-student-name');
        const sidebarEnrollEl = document.getElementById('sidebar-student-enrollment');
        const sidebarSemEl = document.getElementById('sidebar-student-semester');
        const sidebarStatusEl = document.getElementById('sidebar-student-status');

        const displayName = user.name || user.enrollment_no || 'Student';
        if (nameEl) nameEl.textContent = displayName;
        if (enrollEl) enrollEl.textContent = `Enrollment: ${user.enrollment_no || 'N/A'}`;
        if (sidebarNameEl) sidebarNameEl.textContent = displayName;
        if (sidebarEnrollEl) sidebarEnrollEl.textContent = user.enrollment_no || 'EN2026-0000';
        if (sidebarSemEl) {
            const semNum = user.semester_id || user.semester || 1;
            sidebarSemEl.textContent = `Sem ${semNum}`;
        }
        if (sidebarStatusEl) {
            const statusText = user.status || 'Active';
            sidebarStatusEl.innerHTML = `<span class="status-pulse-dot"></span> ${statusText} Student`;
        }

        updateTopbarAvatar(user.profile_pic, displayName);

    } catch (e) {
        redirectToLogin();
    }
}

/**
 * Reusable Topbar & Sidebar Avatar Synchronizer
 */
function updateTopbarAvatar(photoUrl, name) {
    const avatarEl = document.getElementById('topbarAvatarContainer') || document.getElementById('student-avatar');
    const sidebarAvatarEl = document.getElementById('sidebarAvatarContainer');
    const sidebarNameEl = document.getElementById('sidebar-student-name');

    const displayName = name || 'Student';
    if (sidebarNameEl) sidebarNameEl.textContent = displayName;

    if (photoUrl) {
        const fullUrl = photoUrl.startsWith('http') ? photoUrl : `${SERVER_URL}${photoUrl}`;
        const imgHtml = `<img src="${fullUrl}" class="avatar-img" alt="${displayName}" style="width: 100%; height: 100%; object-fit: cover;">`;
        if (avatarEl) avatarEl.innerHTML = imgHtml;
        if (sidebarAvatarEl) sidebarAvatarEl.innerHTML = imgHtml;
    } else {
        const initial = (displayName && displayName.trim()) ? displayName.trim().charAt(0).toUpperCase() : 'S';
        if (avatarEl) avatarEl.textContent = initial;
        if (sidebarAvatarEl) sidebarAvatarEl.innerHTML = `<span id="sidebarAvatarInitial">${initial}</span>`;
    }
}

function getAuthHeaders() {
    const rawToken = localStorage.getItem('studentToken') || localStorage.getItem('token');
    const token = (rawToken && rawToken !== 'null' && rawToken !== 'undefined') ? rawToken.trim() : '';
    const headers = {
        'Content-Type': 'application/json'
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

function redirectToLogin() {
    window.location.href = 'login.html';
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
 * 4. SLIDE-IN NAVIGATION DRAWER CONTROLLER (EVENT DELEGATION)
 * --------------------------------------------------------------------------
 */
function initSidebarDrawer() {
    const sidebar = document.querySelector('.sidebar') || document.getElementById('sidebar');
    let backdrop = document.getElementById('sidebarBackdrop') || document.querySelector('.sidebar-backdrop');

    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'sidebarBackdrop';
        backdrop.className = 'sidebar-backdrop';
        document.body.appendChild(backdrop);
    }

    function toggleSidebar(e) {
        if (e && e.preventDefault) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (sidebar) {
            sidebar.classList.toggle('show-sidebar');
            sidebar.classList.toggle('sidebar-open');
            sidebar.classList.toggle('active');
            sidebar.classList.toggle('open');
        }
        if (backdrop) {
            backdrop.classList.toggle('active');
            backdrop.classList.toggle('open');
        }
        const isOpen = sidebar && (sidebar.classList.contains('show-sidebar') || sidebar.classList.contains('active'));
        document.body.style.overflow = isOpen ? 'hidden' : '';
    }
    window.toggleSidebar = toggleSidebar;
    window.toggleMobileSidebar = toggleSidebar;

    function openSidebar() {
        if (sidebar) {
            sidebar.classList.add('show-sidebar', 'sidebar-open', 'active', 'open');
        }
        if (backdrop) {
            backdrop.classList.add('active', 'open');
        }
        document.body.style.overflow = 'hidden';
    }
    window.openSidebar = openSidebar;

    function closeSidebar(e) {
        if (e && e.preventDefault) e.preventDefault();
        if (sidebar) {
            sidebar.classList.remove('show-sidebar', 'sidebar-open', 'active', 'open');
        }
        if (backdrop) {
            backdrop.classList.remove('active', 'open');
        }
        document.body.style.overflow = '';
    }
    window.closeSidebar = closeSidebar;
    window.closeMobileSidebar = closeSidebar;

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('#sidebarToggleBtn, #hamburgerBtn, #mobileMenuToggle, .menu-toggle, .hamburger-btn, .sidebar-toggle-btn');
        if (btn) {
            e.preventDefault();
            e.stopPropagation();
            toggleSidebar();
            return;
        }

        const closeBtn = e.target.closest('#sidebarCloseBtn, #mobileSidebarClose, .sidebar-close-btn, .mobile-sidebar-close');
        if (closeBtn) {
            e.preventDefault();
            e.stopPropagation();
            closeSidebar();
            return;
        }
    });

    backdrop.addEventListener('click', (e) => {
        e.preventDefault();
        closeSidebar();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
            closeSidebar();
        }
    });
}

function initNavigation() {
    initSidebarDrawer();

    const navItems = document.querySelectorAll('.nav-item[data-view]');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = item.getAttribute('data-view');
            if (typeof window.closeSidebar === 'function') window.closeSidebar();
            switchView(viewId);
        });
    });

    const handleLogout = (e) => {
        if (e) e.preventDefault();
        if (typeof window.closeSidebar === 'function') window.closeSidebar();
        
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
        loadStudyMaterials();
    }
}

/**
 * --------------------------------------------------------------------------
 * MODULE 6: COURSE STUDY MATERIALS & NOTES
 * --------------------------------------------------------------------------
 */
async function loadStudyMaterials() {
    const tableContainer = document.getElementById('student-materials-tbody') || 
                           document.querySelector('#materialsTableBody') || 
                           document.querySelector('#materials-view tbody');
    const token = localStorage.getItem('studentToken') || localStorage.getItem('token');

    if (!tableContainer) return;

    if (!token) {
        tableContainer.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 24px; color: var(--accent-rose, #ef4444);">
                    <i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i> Authentication required. Please log in again.
                </td>
            </tr>
        `;
        return;
    }

    try {
        tableContainer.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 24px; color: var(--text-muted, #94a3b8);">
                    <i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i> Loading course materials...
                </td>
            </tr>
        `;

        const response = await fetch(`${SERVER_URL}/api/resources/my-resources`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            const materials = Array.isArray(resData.data) ? resData.data : (resData.resources || []);

            if (materials.length > 0) {
                tableContainer.innerHTML = materials.map(item => {
                    const downloadUrl = item.downloadUrl || item.download_url || 
                                        (item.file_path ? (item.file_path.startsWith('http') ? item.file_path : `${SERVER_URL}${item.file_path}`) : '#');
                    const format = item.resource_type ? item.resource_type.toUpperCase() : 'DOC';
                    const uploadDate = item.created_at || item.uploaded_at || item.upload_date;
                    const dateDisplay = uploadDate ? new Date(uploadDate).toLocaleDateString() : 'N/A';
                    const subjectDisplay = item.subject_name ? `${item.subject_name} ${item.subject_code ? `(${item.subject_code})` : ''}` : (item.subject_code || 'General');
                    const facultyDisplay = item.faculty_name || item.teacher_name || 'Faculty Member';

                    return `
                        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
                            <td style="padding: 14px 16px;">
                                <div style="font-weight: 600; color: #fff;">${item.title}</div>
                                <small style="color: #94a3b8; font-size: 11px;"><i class="fa-solid fa-file-arrow-down" style="margin-right: 4px;"></i>Format: ${format}</small>
                            </td>
                            <td style="padding: 14px 16px; color: #cbd5e1;">${subjectDisplay}</td>
                            <td style="padding: 14px 16px; color: #cbd5e1;"><i class="fa-solid fa-user-tie" style="margin-right: 6px; font-size: 12px; color: #818cf8;"></i>${facultyDisplay}</td>
                            <td style="padding: 14px 16px; color: #94a3b8;"><i class="fa-solid fa-calendar-days" style="margin-right: 6px; font-size: 12px;"></i>${dateDisplay}</td>
                            <td style="padding: 14px 16px;">
                                <a href="${downloadUrl}" target="_blank" download
                                   style="background: #10b981; color: white; padding: 7px 14px; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: all 0.2s ease;">
                                   <i class="fa-solid fa-download"></i> Download
                                </a>
                            </td>
                        </tr>
                    `;
                }).join('');
            } else {
                tableContainer.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 32px; color: #94a3b8;">
                            <i class="fa-solid fa-folder-open" style="font-size: 28px; display: block; margin-bottom: 8px; opacity: 0.5;"></i>
                            No study materials uploaded for your enrolled course/semester yet.
                        </td>
                    </tr>
                `;
            }
        } else {
            tableContainer.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 24px; color: #ef4444;">
                        <i class="fa-solid fa-circle-exclamation" style="margin-right: 6px;"></i>
                        ${resData.message || 'Failed to load study materials.'}
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Error fetching study materials:', error);
        tableContainer.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 24px; color: #ef4444;">
                    <i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i>
                    Failed to load study materials. Please check server connection.
                </td>
            </tr>
        `;
    }
}

const fetchStudentMaterials = loadStudyMaterials;
document.addEventListener('DOMContentLoaded', () => {
    const materialsNav = document.querySelector('.nav-item[data-view="materials-view"]');
    if (materialsNav) {
        materialsNav.addEventListener('click', loadStudyMaterials);
    }
});

/**
 * --------------------------------------------------------------------------
 * MODULE 1: DASHBOARD DATA & SUMMARY
 * --------------------------------------------------------------------------
 */
async function loadDashboardData() {
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard-summary`, { headers: getAuthHeaders() });
        if (!response.ok && (response.status === 401 || response.status === 403)) {
            console.warn('Session expired or unauthorized.');
            redirectToLogin();
            return;
        }

        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            const { student, todayStatus, stats, recentHistory } = resData.data || {};

            if (student) {
                const nameEl = document.getElementById('student-name-display');
                const enrollEl = document.getElementById('student-enrollment-display');
                if (nameEl) nameEl.textContent = student.name;
                if (enrollEl) enrollEl.textContent = `Enrollment: ${student.enrollment_no}`;
            }

            const titleBanner = document.getElementById('today-status-title');
            const subBanner = document.getElementById('today-status-subtitle');
            if (titleBanner && subBanner && todayStatus) {
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

            const percEl = document.getElementById('stat-percentage');
            const totalEl = document.getElementById('stat-total-classes');
            const attEl = document.getElementById('stat-attended-classes');

            if (stats) {
                if (percEl) percEl.textContent = `${stats.attendancePercentage || 0}%`;
                if (totalEl) totalEl.textContent = stats.totalClasses || 0;
                if (attEl) attEl.textContent = stats.attendedClasses || 0;
            }

            const recentTbody = document.getElementById('recent-attendance-tbody');
            if (recentTbody) {
                if (!recentHistory || recentHistory.length === 0) {
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
    } finally {
        if (typeof hideLoading === 'function') hideLoading();
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

    initPinAttendanceHandler();
}

function initPinAttendanceHandler() {
    const pinForm = document.getElementById('pin-attendance-form');
    if (pinForm) {
        pinForm.addEventListener('submit', handlePinAttendanceSubmit);
    }
}

async function handlePinAttendanceSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    const pinInput = document.getElementById('studentPinInput');
    const submitBtn = document.getElementById('submitPinBtn');
    const feedbackMsg = document.getElementById('pin-feedback-msg');

    const pin = pinInput ? pinInput.value.trim() : '';

    if (!pin || pin.length !== 8 || isNaN(pin)) {
        showToast('Please enter a valid 8-digit numeric PIN.', 'error');
        if (feedbackMsg) {
            feedbackMsg.textContent = '❌ Please enter a valid 8-digit numeric PIN.';
            feedbackMsg.style.color = 'var(--accent-rose)';
        }
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
    }
    if (feedbackMsg) {
        feedbackMsg.textContent = 'Verifying PIN with live classroom session...';
        feedbackMsg.style.color = 'var(--accent-teal)';
    }

    try {
        const response = await fetch(`${API_BASE_URL}/mark-attendance`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ pin: pin })
        });
        const resData = await response.json();

        if (response.ok && (resData.status === 'success' || resData.success === true)) {
            showToast(resData.message || 'Attendance marked successfully via 8-Digit PIN!', 'success');
            if (feedbackMsg) {
                feedbackMsg.textContent = `✅ ${resData.message || 'Attendance recorded successfully!'}`;
                feedbackMsg.style.color = 'var(--accent-emerald)';
            }
            if (pinInput) pinInput.value = '';

            setTimeout(() => {
                loadDashboardData();
                switchView('dashboard-view');
            }, 1200);
        } else {
            const errMsg = resData.message || 'Failed to verify PIN. Please check screen.';
            showToast(errMsg, 'error');
            if (feedbackMsg) {
                feedbackMsg.textContent = `❌ ${errMsg}`;
                feedbackMsg.style.color = 'var(--accent-rose)';
            }
        }
    } catch (err) {
        console.error('PIN Attendance Error:', err);
        showToast('Network error while verifying PIN. Please try again.', 'error');
        if (feedbackMsg) {
            feedbackMsg.textContent = '❌ Connection failed. Check server connection.';
            feedbackMsg.style.color = 'var(--accent-rose)';
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit PIN';
        }
    }
}
window.handlePinAttendanceSubmit = handlePinAttendanceSubmit;

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
            const emailEl = document.getElementById('prof-email') || document.getElementById('acadEmail');
            const rollEl = document.getElementById('prof-roll') || document.getElementById('acadRoll');
            const deptEl = document.getElementById('prof-dept') || document.getElementById('acadDept');
            const courseEl = document.getElementById('acadCourse') || document.getElementById('prof-course');
            const semEl = document.getElementById('acadSemester') || document.getElementById('prof-semester');
            const secEl = document.getElementById('prof-section') || document.getElementById('acadSection');
            const secHeaderEl = document.getElementById('prof-header-section');
            const phoneEl = document.getElementById('prof-phone') || document.getElementById('acadPhone');

            if (nameEl) nameEl.textContent = p.name;
            if (enrollEl) enrollEl.textContent = `Enrollment No: ${p.enrollment_no}`;
            if (emailEl) emailEl.textContent = p.email || '-';
            if (rollEl) rollEl.textContent = p.roll_no || 'N/A';
            if (deptEl) deptEl.textContent = p.department_name || 'General Academic';
            if (courseEl) courseEl.textContent = p.course_name || '-';
            if (semEl) {
                const semNum = p.semester_id || p.semester_number || p.semester || '1';
                semEl.textContent = `Semester ${semNum}`;
            }
            if (secEl) secEl.textContent = p.section_name ? `Section ${p.section_name}` : 'Unassigned';
            if (secHeaderEl) secHeaderEl.textContent = p.section_name ? `Section ${p.section_name}` : 'Unassigned';
            if (phoneEl) phoneEl.textContent = p.phone || 'Not Provided';

            const sidebarNameEl = document.getElementById('sidebar-student-name');
            const sidebarEnrollEl = document.getElementById('sidebar-student-enrollment');
            const sidebarSemEl = document.getElementById('sidebar-student-semester');
            const sidebarStatusEl = document.getElementById('sidebar-student-status');

            if (sidebarNameEl) sidebarNameEl.textContent = p.name;
            if (sidebarEnrollEl) sidebarEnrollEl.textContent = p.enrollment_no || 'N/A';
            if (sidebarSemEl) sidebarSemEl.textContent = `Sem ${p.semester_number || 1}`;
            if (sidebarStatusEl) sidebarStatusEl.innerHTML = `<span class="status-pulse-dot"></span> Active Student`;

            const imgPreview = document.getElementById('profile-img-preview');
            if (imgPreview) {
                imgPreview.src = p.profile_pic ? `${SERVER_URL}${p.profile_pic}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=10b981&color=fff`;
            }

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
        const response = await fetch(`${API_BASE_URL}/leaves`, { headers: getAuthHeaders() });
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

async function loadStudentNotifications() {
    const listContainer = document.getElementById('notifications-list');
    const dropdownList = document.getElementById('notificationDropdownList');
    const alertCountEl = document.getElementById('leave-stat-alerts');
    const badgeEl = document.getElementById('notif-badge') || document.getElementById('notificationCount') || document.getElementById('notificationDot');
    const dropdownBadgeEl = document.getElementById('notifDropdownBadge');
    const modalBody = document.getElementById('systemNotifModalBody');

    try {
        const response = await fetch(`${API_BASE_URL}/notifications`, { headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && (resData.success || resData.status === 'success')) {
            const dataObj = resData.data || {};
            const notifications = Array.isArray(dataObj) ? dataObj : (dataObj.notifications || resData.notifications || []);
            const unreadCount = dataObj.unreadCount !== undefined ? dataObj.unreadCount : notifications.length;

            if (alertCountEl) alertCountEl.textContent = unreadCount;
            if (dropdownBadgeEl) dropdownBadgeEl.textContent = unreadCount;

            if (badgeEl) {
                if (unreadCount > 0) {
                    badgeEl.textContent = unreadCount > 9 ? '9+' : unreadCount;
                    badgeEl.style.display = 'inline-flex';
                } else {
                    badgeEl.style.display = 'none';
                }
            }

            const renderNotificationItem = (n) => {
                const priority = (n.priority || n.type || 'info').toLowerCase();
                let borderAccent = '#6366f1';
                let iconClass = 'fa-info-circle';
                let iconBg = 'rgba(99, 102, 241, 0.15)';
                let iconColor = '#6366f1';
                let badgeLabel = 'Notice';
                let badgeStyle = 'background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3);';

                if (priority === 'success') {
                    borderAccent = '#10b981';
                    iconClass = 'fa-circle-check';
                    iconBg = 'rgba(16, 185, 129, 0.15)';
                    iconColor = '#10b981';
                    badgeLabel = 'Exam / Assignment';
                    badgeStyle = 'background: rgba(16, 185, 129, 0.15); color: var(--accent-emerald); border: 1px solid rgba(16, 185, 129, 0.3);';
                } else if (priority === 'warning' || priority === 'urgent' || priority === 'danger' || priority === 'high') {
                    borderAccent = '#f43f5e';
                    iconClass = 'fa-triangle-exclamation';
                    iconBg = 'rgba(244, 63, 94, 0.15)';
                    iconColor = '#f43f5e';
                    badgeLabel = 'Urgent Alert';
                    badgeStyle = 'background: rgba(244, 63, 94, 0.15); color: var(--accent-rose); border: 1px solid rgba(244, 63, 94, 0.3);';
                }

                const facultyInfo = n.faculty_name ? `<span style="display: flex; align-items: center; gap: 4px;"><i class="fa-solid fa-user-tie"></i> ${n.faculty_name}</span>` : '';
                const subjectInfo = n.subject_name ? `<span style="display: flex; align-items: center; gap: 4px;"><i class="fa-solid fa-book-open"></i> ${n.subject_name}</span>` : '';
                const dateStr = n.created_at ? new Date(n.created_at).toLocaleString() : 'Recent';

                return `
                    <div style="display: flex; gap: 12px; padding: 14px; background: rgba(15, 23, 42, 0.65); border: 1px solid var(--glass-border); border-radius: 14px; border-left: 4px solid ${borderAccent}; transition: transform 0.2s ease;">
                        <div style="width: 36px; height: 36px; border-radius: 10px; background: ${iconBg}; color: ${iconColor}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 16px;">
                            <i class="fa-solid ${iconClass}"></i>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 4px;">
                                <span style="font-size: 13px; color: var(--text-primary); font-weight: 700;">${n.title || n.subject_name || 'Class Notification'}</span>
                                <span style="${badgeStyle} padding: 2px 8px; border-radius: 10px; font-size: 10.5px; font-weight: 700; text-transform: uppercase;">${badgeLabel}</span>
                            </div>
                            <div style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.5; word-break: break-word;">${n.message}</div>
                            <div style="font-size: 11px; color: var(--text-muted); margin-top: 8px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; border-top: 1px dashed var(--glass-border); padding-top: 6px;">
                                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                    ${facultyInfo}
                                    ${subjectInfo}
                                </div>
                                <span style="display: flex; align-items: center; gap: 4px;"><i class="fa-solid fa-clock" style="font-size: 10px;"></i> ${dateStr}</span>
                            </div>
                        </div>
                    </div>
                `;
            };

            const renderDropdownItem = (n) => {
                const priority = (n.priority || n.type || 'info').toLowerCase();
                let iconClass = 'fa-info-circle';
                let iconBg = 'rgba(99, 102, 241, 0.15)';
                let iconColor = '#818cf8';
                let badgeLabel = 'Notice';
                let badgeStyle = 'background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3);';

                if (priority === 'success') {
                    iconClass = 'fa-circle-check';
                    iconBg = 'rgba(16, 185, 129, 0.15)';
                    iconColor = 'var(--accent-emerald)';
                    badgeLabel = 'Exam / Notice';
                    badgeStyle = 'background: rgba(16, 185, 129, 0.15); color: var(--accent-emerald); border: 1px solid rgba(16, 185, 129, 0.3);';
                } else if (priority === 'warning' || priority === 'urgent' || priority === 'danger' || priority === 'high') {
                    iconClass = 'fa-triangle-exclamation';
                    iconBg = 'rgba(244, 63, 94, 0.15)';
                    iconColor = 'var(--accent-rose)';
                    badgeLabel = 'Urgent Alert';
                    badgeStyle = 'background: rgba(244, 63, 94, 0.15); color: var(--accent-rose); border: 1px solid rgba(244, 63, 94, 0.3);';
                }

                const titleText = n.title || (n.subject_name ? `[${n.subject_name}] Announcement` : 'Class Announcement');
                const facultyText = n.faculty_name ? `<span style="display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-user-tie" style="font-size: 10px;"></i> ${n.faculty_name}</span>` : '';
                const dateStr = n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Recent';

                return `
                    <div class="notif-item-card" onclick="navigateToLeavesAndAlerts()">
                        <div class="notif-item-icon" style="background: ${iconBg}; color: ${iconColor};">
                            <i class="fa-solid ${iconClass}"></i>
                        </div>
                        <div class="notif-item-content">
                            <div class="notif-item-top">
                                <span class="notif-item-title" title="${titleText}">${titleText}</span>
                                <span class="notif-item-badge" style="${badgeStyle}">${badgeLabel}</span>
                            </div>
                            <div class="notif-item-msg">${n.message}</div>
                            <div class="notif-item-meta">
                                ${facultyText}
                                <span style="display: inline-flex; align-items: center; gap: 4px; margin-left: auto;">
                                    <i class="fa-regular fa-clock" style="font-size: 10px;"></i> ${dateStr}
                                </span>
                            </div>
                        </div>
                    </div>
                `;
            };

            if (dropdownList) {
                if (notifications.length === 0) {
                    dropdownList.innerHTML = `
                        <div class="notif-empty-state">
                            <i class="fa-regular fa-bell-slash" style="font-size: 26px; color: var(--text-muted); margin-bottom: 8px;"></i>
                            <p style="margin: 0; color: var(--text-muted); font-size: 13px;">No new notifications</p>
                        </div>
                    `;
                } else {
                    dropdownList.innerHTML = notifications.map(renderDropdownItem).join('');
                }
            }

            if (listContainer) {
                if (notifications.length === 0) {
                    listContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 24px;">No new notifications or system alerts.</div>`;
                } else {
                    listContainer.innerHTML = notifications.map(renderNotificationItem).join('');
                }
            }

            if (modalBody) {
                if (notifications.length === 0) {
                    modalBody.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 24px;">No new notifications or system alerts.</div>`;
                } else {
                    modalBody.innerHTML = notifications.map(renderNotificationItem).join('');
                }
            }
        }
    } catch (err) {
        console.error('Error loading notifications:', err);
    }
}

const loadNotifications = loadStudentNotifications;
window.loadStudentNotifications = loadStudentNotifications;
window.loadNotifications = loadStudentNotifications;

function toggleNotificationDropdown(e) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    const dropdown = document.getElementById('notificationDropdown');
    if (!dropdown) return;

    const isVisible = dropdown.style.display === 'flex' || dropdown.style.display === 'block';
    if (isVisible) {
        dropdown.style.display = 'none';
    } else {
        dropdown.style.display = 'flex';
        loadStudentNotifications();
    }
}
window.toggleNotificationDropdown = toggleNotificationDropdown;
window.toggleSystemNotificationModal = toggleNotificationDropdown;

function navigateToLeavesAndAlerts() {
    const dropdown = document.getElementById('notificationDropdown');
    if (dropdown) dropdown.style.display = 'none';

    if (typeof switchView === 'function') {
        switchView('leaves-alerts-view');
    } else {
        const navBtn = document.getElementById('nav-leaves') || document.querySelector('[data-view="leaves-alerts-view"]');
        if (navBtn) navBtn.click();
    }
}
window.navigateToLeavesAndAlerts = navigateToLeavesAndAlerts;

document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notificationDropdown');
    const bellBtn = document.getElementById('notification-bell');
    if (!dropdown || dropdown.style.display === 'none') return;

    if (!dropdown.contains(e.target) && (!bellBtn || !bellBtn.contains(e.target))) {
        dropdown.style.display = 'none';
    }
});

async function markAllNotificationsRead(e) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    try {
        await fetch(`${API_BASE_URL}/notifications/read`, { method: 'POST', headers: getAuthHeaders() });
        showToast('Notifications marked as read.');

        const badgeEl = document.getElementById('notif-badge') || document.getElementById('notificationCount');
        const dropdownBadgeEl = document.getElementById('notifDropdownBadge');
        const alertCountEl = document.getElementById('leave-stat-alerts');
        if (badgeEl) badgeEl.style.display = 'none';
        if (dropdownBadgeEl) dropdownBadgeEl.textContent = '0';
        if (alertCountEl) alertCountEl.textContent = '0';

        loadStudentNotifications();
    } catch (err) {
        showToast('Error marking notifications as read.', 'error');
    }
}
window.markAllNotificationsRead = markAllNotificationsRead;

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

function exportAttendancePDF() {
    if (!window.jspdf || !currentReportData || currentReportData.length === 0) {
        showToast('No report data available to export.', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

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

function printAttendanceReport() {
    window.print();
}

/**
 * --------------------------------------------------------------------------
 * FORM SUBMIT LISTENERS
 * --------------------------------------------------------------------------
 */
function initFormListeners() {
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
                const response = await fetch(`${API_BASE_URL}/leaves`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ start_date, end_date, reason })
                });
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