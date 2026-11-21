/**
 * Smart QR Attendance System - Faculty Portal Suite Logic (Updated & Fixed)
 */

// Localhost Backend Configuration
window.BACKEND_API_URL = window.API_BASE_URL || 
    (window.location.protocol.startsWith('http') 
        ? window.location.origin 
        : "http://localhost:5000");

var BASE_SERVER_URL = window.BACKEND_API_URL;
var SERVER_URL = BASE_SERVER_URL;
var API_BASE_URL = window.TEACHER_API_BASE_URL || `${SERVER_URL}/api/teacher`;
var RESOURCE_API_URL = `${SERVER_URL}/api/resources`;

let activeSessionId = null;
let countdownTimer = null;
let livePollingInterval = null;
let qrCodeInstance = null;
let remainingSeconds = 60;
let currentReportData = null;
let currentAssignedClasses = [];

// Initialize on Page Load
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof hideLoading === 'function') hideLoading();
    const hungLoader = document.getElementById('global-loader');
    if (hungLoader) {
        hungLoader.classList.remove('active');
        hungLoader.style.display = 'none';
        hungLoader.style.pointerEvents = 'none';
    }

    checkAuth();
    initTheme();
    initEventListeners();
    initResourceUpload();
    initProfileListeners();
    initAnnouncementForm();

    try {
        await Promise.allSettled([
            loadDashboardSummary(),
            loadTeacherAnnouncements(),
            loadTeacherProfile(),
            searchStudentDirectory()
        ]);
    } catch (err) {
        console.warn('Initial faculty data load warning:', err);
    } finally {
        if (typeof hideLoading === 'function') hideLoading();
    }

    if (sessionStorage.getItem('justLoggedIn') === 'true') {
        sessionStorage.removeItem('justLoggedIn');
        const userStr = localStorage.getItem('teacherUser') || localStorage.getItem('user');
        let displayName = 'Faculty Member';
        if (userStr) {
            try {
                const u = JSON.parse(userStr);
                displayName = u.name || u.employee_id || 'Faculty Member';
            } catch (e) {}
        }
        showToast(`Welcome back, ${displayName}! Logged in successfully.`, 'success');
    }
});

/**
 * 1. AUTHENTICATION & NAVIGATION
 */
function checkAuth() {
    const token = localStorage.getItem('teacherToken') || localStorage.getItem('token');
    const userStr = localStorage.getItem('teacherUser') || localStorage.getItem('user');

    if (!token || !userStr) {
        redirectToLogin();
        return;
    }

    try {
        const user = JSON.parse(userStr);
        if (user.role !== 'Teacher') {
            showToast('Unauthorized access. Redirecting to Teacher Login.', 'error');
            redirectToLogin();
            return;
        }

        const nameEl = document.getElementById('teacher-name-display');
        const displayName = user.name || user.employee_id || 'Teacher';
        if (nameEl) nameEl.textContent = displayName;

        updateTopbarAvatar(user.profile_pic, displayName);
    } catch (e) {
        redirectToLogin();
    }
}

function updateTopbarAvatar(photoUrl, name) {
    const avatarEl = document.getElementById('topbarAvatarContainer') || document.getElementById('teacher-avatar');
    const sidebarAvatarEl = document.getElementById('sidebarAvatarContainer');
    const sidebarNameEl = document.getElementById('sidebar-teacher-name');

    const displayName = name || 'Faculty Profile';
    if (sidebarNameEl) sidebarNameEl.textContent = displayName;

    if (photoUrl) {
        const fullUrl = photoUrl.startsWith('http') ? photoUrl : `${SERVER_URL}${photoUrl}`;
        const imgHtml = `<img src="${fullUrl}" class="avatar-img" alt="${name || 'Teacher'}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        if (avatarEl) avatarEl.innerHTML = imgHtml;
        if (sidebarAvatarEl) sidebarAvatarEl.innerHTML = imgHtml;
    } else {
        const initial = (name && name.trim()) ? name.trim().charAt(0).toUpperCase() : 'T';
        if (avatarEl) avatarEl.textContent = initial;
        if (sidebarAvatarEl) sidebarAvatarEl.textContent = initial;
    }
}

function getAuthHeaders() {
    const rawToken = localStorage.getItem('teacherToken') || localStorage.getItem('facultyToken') || localStorage.getItem('token');
    const token = (rawToken && rawToken !== 'null' && rawToken !== 'undefined') ? rawToken.trim() : '';
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

function redirectToLogin() {
    window.location.href = 'login.html';
}

function initTheme() {
    const themeBtn = document.getElementById('themeToggle');
    if (!themeBtn) return;

    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    themeBtn.addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('#themeToggle i');
    if (icon) {
        icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
}

function initPortalDrawer() {
    const sidebar = document.querySelector('.sidebar') || document.getElementById('sidebar');
    let backdrop = document.getElementById('portalBackdrop') || document.getElementById('sidebarBackdrop') || document.querySelector('.portal-backdrop') || document.getElementById('mobileOverlay');

    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'portalBackdrop';
        backdrop.className = 'portal-backdrop';
        document.body.appendChild(backdrop);
    }

    function toggleSidebar(e) {
        if (e && e.preventDefault) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (sidebar) {
            sidebar.classList.toggle('drawer-open');
            sidebar.classList.toggle('show-sidebar');
            sidebar.classList.toggle('active');
            sidebar.classList.toggle('open');
        }
        if (backdrop) {
            backdrop.classList.toggle('visible');
            backdrop.classList.toggle('active');
            backdrop.classList.toggle('open');
        }
        const isOpen = sidebar && (sidebar.classList.contains('drawer-open') || sidebar.classList.contains('active') || sidebar.classList.contains('open'));
        document.body.style.overflow = isOpen ? 'hidden' : '';
    }
    window.toggleSidebar = toggleSidebar;
    window.toggleMobileMenu = toggleSidebar;

    function closeSidebar(e) {
        if (e && e.preventDefault) e.preventDefault();
        if (sidebar) sidebar.classList.remove('drawer-open', 'show-sidebar', 'active', 'open');
        if (backdrop) backdrop.classList.remove('visible', 'active', 'open');
        document.body.style.overflow = '';
    }
    window.closeSidebar = closeSidebar;
    window.closeMobileMenu = closeSidebar;

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('#portalSidebarToggle, #sidebarToggleBtn, #hamburgerBtn, #mobileMenuToggle, .portal-sidebar-toggle, .menu-toggle, .hamburger-btn, .sidebar-toggle-btn');
        if (btn) {
            e.preventDefault();
            e.stopPropagation();
            toggleSidebar();
            return;
        }

        const closeBtn = e.target.closest('#portalSidebarClose, #sidebarCloseBtn, #mobileSidebarClose, .portal-sidebar-close, .sidebar-close-btn, .mobile-sidebar-close');
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
        if (e.key === 'Escape' || e.key === 'Esc') closeSidebar();
    });
}

function initEventListeners() {
    initPortalDrawer();

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('data-target') || item.getAttribute('data-view');
            if (typeof window.closeSidebar === 'function') window.closeSidebar();
            if (targetId) switchView(targetId);
        });
    });

    const handleLogout = (e) => {
        if (e) e.preventDefault();
        if (typeof window.closeSidebar === 'function') window.closeSidebar();
        
        const logoutAction = () => {
            localStorage.clear();
            sessionStorage.setItem('justLoggedOut', 'true');
            window.location.href = 'login.html';
        };

        if (typeof showConfirmModal === 'function') {
            showConfirmModal('Confirm Logout', 'Are you sure you want to log out of your Faculty Portal?', logoutAction, 'Logout', 'btn-danger');
        } else if (confirm('Are you sure you want to securely logout?')) {
            logoutAction();
        }
    };

    document.querySelectorAll('.logout-btn').forEach(btn => btn.addEventListener('click', handleLogout));

    const topbarAvatar = document.getElementById('topbarAvatarContainer');
    const topbarUserInfo = document.querySelector('.header-user .user-info');
    if (topbarAvatar) topbarAvatar.addEventListener('click', () => switchView('profile-section'));
    if (topbarUserInfo) topbarUserInfo.addEventListener('click', () => switchView('profile-section'));

    const startForm = document.getElementById('start-session-form');
    if (startForm) {
        startForm.addEventListener('submit', (e) => {
            e.preventDefault();
            startAttendanceSession();
        });
    }

    const closeBtn = document.getElementById('close-session-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeAttendanceSession);
}

function switchView(targetId) {
    document.querySelectorAll('.content-section, .view-section').forEach(sec => {
        sec.classList.add('hidden-section');
        sec.classList.remove('active');
    });
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));

    const activeSection = document.getElementById(targetId);
    const activeNav = document.querySelector(`.nav-item[data-target="${targetId}"], .nav-item[data-view="${targetId}"]`);

    if (activeSection) {
        activeSection.classList.remove('hidden-section');
        activeSection.classList.add('active');
    }
    if (activeNav) activeNav.classList.add('active');

    const titleEl = document.getElementById('view-title');
    const subtitleEl = document.getElementById('view-subtitle');

    if (targetId === 'dashboard-section' || targetId === 'dashboard-view') {
        if (titleEl) titleEl.textContent = 'Faculty Dashboard';
        if (subtitleEl) subtitleEl.textContent = "Today's assigned classes, reminders & alerts, and recent attendance sessions";
        loadDashboardSummary();
    } else if (targetId === 'classes-section' || targetId === 'classes-view') {
        if (titleEl) titleEl.textContent = 'QR Attendance Session';
        if (subtitleEl) subtitleEl.textContent = 'Initiate dynamic 60-second QR codes, present/absent tabs, & manual corrections';
    } else if (targetId === 'students-section' || targetId === 'students-view') {
        if (titleEl) titleEl.textContent = 'Student Information Directory';
        if (subtitleEl) subtitleEl.textContent = 'Search student roster and filter profiles by class/section';
        searchStudentDirectory();
    } else if (targetId === 'reports-section' || targetId === 'reports-view') {
        if (titleEl) titleEl.textContent = 'Attendance Reports & Exports';
        if (subtitleEl) subtitleEl.textContent = 'Generate Daily, Monthly, or Subject-Wise reports with PDF, Excel, and Print exports';
    } else if (targetId === 'resources-section' || targetId === 'resources-view') {
        if (titleEl) titleEl.textContent = 'Study Materials';
        if (subtitleEl) subtitleEl.textContent = 'Share lecture notes, syllabi, and presentation files with classes';
    } else if (targetId === 'announcements-section' || targetId === 'announcements-view') {
        if (titleEl) titleEl.textContent = 'Faculty Announcement Broadcast Portal';
        if (subtitleEl) subtitleEl.textContent = 'Broadcast priority notifications directly to enrolled class sections';
        loadTeacherAnnouncements();
        populateClassDropdowns();
    } else if (targetId === 'profile-section' || targetId === 'profile-view') {
        if (titleEl) titleEl.textContent = 'Faculty Profile & Security';
        if (subtitleEl) subtitleEl.textContent = 'Manage account details, upload profile picture, and change password';
        loadTeacherProfile();
    }
}
window.switchView = switchView;
window.switchSection = switchView;

/**
 * 2. DASHBOARD SUMMARY
 */
async function loadDashboardSummary() {
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard-summary`, { headers: getAuthHeaders() });
        if (!response.ok && (response.status === 401 || response.status === 403)) {
            redirectToLogin();
            return;
        }

        const resData = await response.json();
        if (response.ok && resData.status === 'success') {
            const { totalClasses, totalStudents, assignedClasses, todayClasses, recentSessions, activeSession } = resData.data || {};
            currentAssignedClasses = assignedClasses || [];
            const displayClasses = todayClasses || assignedClasses || [];

            const classesEl = document.getElementById('dash-total-classes');
            const studentsEl = document.getElementById('dash-total-students');
            const statusEl = document.getElementById('dash-session-status');

            if (classesEl) classesEl.textContent = displayClasses.length;
            if (studentsEl) studentsEl.textContent = totalStudents || 0;

            if (statusEl) {
                if (activeSession) {
                    statusEl.textContent = 'ACTIVE (Live)';
                    statusEl.style.color = '#10b981';

                    activeSessionId = activeSession.id || activeSession.session_id;

                    const pin = activeSession.session_pin || activeSession.sessionPin || activeSession.pin;
                    if (pin) {
                        updateSessionPinDisplay(pin);
                    }

                    const classSelect = document.getElementById('class-select');
                    if (classSelect && activeSession.class_id) {
                        classSelect.value = activeSession.class_id;
                    }

                    const activeContainer = document.getElementById('session-active-container');
                    if (activeContainer) activeContainer.style.display = 'block';

                    startLivePolling(activeSessionId);
                } else {
                    statusEl.textContent = 'Inactive';
                    statusEl.style.color = 'var(--accent-emerald)';
                    updateSessionPinDisplay(null);
                }
            }

            const classesTbody = document.getElementById('assigned-classes-tbody');
            if (classesTbody) {
                if (displayClasses.length === 0) {
                    classesTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No assigned classes found for today.</td></tr>`;
                } else {
                    classesTbody.innerHTML = displayClasses.map(c => `
                        <tr>
                            <td><strong>${c.subject_name}</strong> (${c.subject_code})</td>
                            <td>${c.course_name}</td>
                            <td>Semester ${c.semester_number}</td>
                            <td>Section ${c.section_name || 'A'}</td>
                            <td>
                                <button class="action-btn" onclick="startQuickSession('${c.class_id || c.id}')" style="background: rgba(13, 148, 136, 0.2); color: var(--accent-teal); padding: 5px 12px; font-size: 11px; font-weight: 700; border-radius: 6px; cursor: pointer;">
                                    <i class="fa-solid fa-play"></i> Start Session
                                </button>
                            </td>
                        </tr>
                    `).join('');
                }
            }

            populateClassDropdowns(assignedClasses);

            const sessionsTbody = document.getElementById('recent-sessions-tbody');
            if (sessionsTbody) {
                if (!recentSessions || recentSessions.length === 0) {
                    sessionsTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No recent sessions recorded yet.</td></tr>`;
                } else {
                    sessionsTbody.innerHTML = recentSessions.map(s => `
                        <tr>
                            <td><strong>${s.subject_name}</strong> (${s.subject_code})</td>
                            <td>Section ${s.section_name || 'A'}</td>
                            <td>${new Date(s.created_at).toLocaleString()}</td>
                            <td><span style="color: var(--accent-emerald); font-weight: 700;">${s.present_count} Present</span></td>
                            <td><span style="background: rgba(255,255,255,0.06); padding: 3px 10px; border-radius: 10px; font-size: 11px; font-weight: 700;">${s.session_status}</span></td>
                        </tr>
                    `).join('');
                }
            }
        }
    } catch (err) {
        console.error('Error loading dashboard summary:', err);
    }
}

function updateSessionPinDisplay(pin) {
    const pinEl = document.getElementById('session-pin-display');
    if (!pinEl) return;

    if (pin && String(pin).trim() !== '' && String(pin) !== 'undefined' && String(pin) !== 'null') {
        pinEl.textContent = String(pin).trim();
        pinEl.innerText = String(pin).trim();
    } else {
        pinEl.textContent = '--------';
        pinEl.innerText = '--------';
    }
}
window.updateSessionPinDisplay = updateSessionPinDisplay;

function populateClassDropdowns(classes = null) {
    const list = classes || currentAssignedClasses || [];
    if (!Array.isArray(list) || list.length === 0) return;

    const dropdowns = ['class-select', 'student-filter-class', 'report-class-select', 'resource-class-select', 'announcement-class-select'];
    dropdowns.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            const currentVal = select.value;
            select.innerHTML = '<option value="">Select a Class / Subject...</option>' +
                list.map(c => `<option value="${c.class_id || c.id}">${c.subject_name} (${c.subject_code || ''}) - Sec ${c.section_name || 'A'}</option>`).join('');
            if (currentVal) select.value = currentVal;
        }
    });
}

function startQuickSession(classId) {
    switchView('classes-section');
    const select = document.getElementById('class-select');
    if (select) {
        select.value = classId;
        startAttendanceSession();
    }
}
window.startQuickSession = startQuickSession;

/**
 * 3. ATTENDANCE & LIVE POLLING
 */
async function startAttendanceSession() {
    const select = document.getElementById('class-select');
    const classId = select ? select.value : '';
    if (!classId) {
        showToast('Please select a class first.', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/start-session`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ class_id: classId })
        });
        const resData = await response.json();

        if (response.ok && (resData.status === 'success' || resData.success)) {
            const sessionId = resData.sessionId || resData.session_id || resData.data?.sessionId || resData.data?.session_id;
            const qrHash = resData.qrHash || resData.qr_token || resData.data?.qrHash || resData.data?.qr_token;
            const sessionPin = resData.session_pin || resData.sessionPin || resData.pin || resData.data?.session_pin || resData.data?.sessionPin || resData.data?.pin;
            
            activeSessionId = sessionId;

            updateSessionPinDisplay(sessionPin);

            const selectedClass = (Array.isArray(currentAssignedClasses))
                ? (currentAssignedClasses.find(c => (c.class_id == classId || c.id == classId)) || {})
                : {};

            const qrPayload = {
                session_id: sessionId,
                course_id: selectedClass.course_id || 'CS-2026',
                subject_id: selectedClass.subject_id || selectedClass.subject_code || 'SUB-101',
                qrHash: qrHash,
                pin: sessionPin,
                timestamp: Date.now()
            };

            if (typeof generateFacultyQRCode === 'function') {
                generateFacultyQRCode(qrPayload);
            } else {
                renderQRCode(qrPayload);
            }

            const activeContainer = document.getElementById('session-active-container');
            if (activeContainer) activeContainer.style.display = 'block';

            const statusEl = document.getElementById('dash-session-status');
            if (statusEl) {
                statusEl.textContent = 'ACTIVE (Live)';
                statusEl.style.color = '#10b981';
            }

            startCountdown(60);
            startLivePolling(sessionId);
            showToast(`Attendance session initiated! PIN: ${sessionPin || 'Active'}`);
        } else {
            showToast(resData.message || 'Failed to start session.', 'error');
        }
    } catch (err) {
        showToast('Error initiating attendance session.', 'error');
    }
}

async function regenerateActiveQR() {
    if (!activeSessionId) {
        showToast('No active attendance session found to regenerate.', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/regenerate-qr/${activeSessionId}`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        const resData = await response.json();

        if (response.ok && (resData.status === 'success' || resData.success)) {
            const sessionPin = resData.session_pin 
                            || resData.pin 
                            || resData.sessionPin 
                            || (resData.data && (resData.data.session_pin || resData.data.pin || resData.data.sessionPin));

            const qrHash = resData.qrHash 
                        || resData.qr_token 
                        || (resData.data && (resData.data.qrHash || resData.data.qr_token));

            updateSessionPinDisplay(sessionPin);

            const selectedClassId = document.getElementById('class-select')?.value;
            const selectedClass = (Array.isArray(currentAssignedClasses))
                ? (currentAssignedClasses.find(c => c.class_id == selectedClassId || c.id == selectedClassId) || {})
                : {};

            const qrPayload = {
                session_id: activeSessionId,
                course_id: selectedClass.course_id || 'CS-2026',
                subject_id: selectedClass.subject_id || selectedClass.subject_code || 'SUB-101',
                qrHash: qrHash,
                pin: sessionPin,
                timestamp: Date.now()
            };

            if (typeof generateFacultyQRCode === 'function') {
                generateFacultyQRCode(qrPayload);
            } else {
                renderQRCode(qrPayload);
            }

            startCountdown(60);
            showToast(`QR & PIN regenerated! New PIN: ${sessionPin || 'Active'}`, 'success');
        } else {
            showToast(resData.message || 'Failed to regenerate QR & PIN.', 'error');
        }
    } catch (err) {
        console.error('Error regenerating QR code:', err);
        showToast('Error communicating with server.', 'error');
    }
}

function renderQRCode(qrData) {
    const container = document.getElementById('qrcode');
    if (!container) return;

    const textToEncode = (typeof qrData === 'object' && qrData !== null) ? JSON.stringify(qrData) : qrData;
    container.innerHTML = '';

    // Clean white quiet-zone border taaki dark background par camera turant focus kare
    container.style.display = 'inline-block';
    container.style.background = '#ffffff';
    container.style.padding = '12px';
    container.style.borderRadius = '10px';
    container.style.lineHeight = '0';

    if (typeof QRCode !== 'undefined') {
        qrCodeInstance = new QRCode(container, {
            text: textToEncode,
            width: 512,  // High-DPI internal resolution for razor-sharp edges
            height: 512,
            colorDark: '#000000',  // Pure black for maximum camera contrast
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M // Bade aur khule dots (door se instant scan ke liye)
        });

        // Display size wahi 220px rakhein, bina kisi blur ke
        setTimeout(() => {
            const qrElements = container.querySelectorAll('canvas, img');
            qrElements.forEach(el => {
                el.style.width = '220px';
                el.style.height = '220px';
                el.style.imageRendering = 'pixelated';
            });
        }, 0);
    }
}
function startCountdown(seconds) {
    clearInterval(countdownTimer);
    remainingSeconds = seconds;
    const timerDisplay = document.getElementById('timer-display');

    countdownTimer = setInterval(() => {
        remainingSeconds--;
        if (timerDisplay) timerDisplay.textContent = `${remainingSeconds}s`;

        if (remainingSeconds <= 0) {
            if (activeSessionId) {
                regenerateActiveQR();
            } else {
                clearInterval(countdownTimer);
            }
        }
    }, 1000);
}

function startLivePolling(sessionId) {
    clearInterval(livePollingInterval);
    fetchLiveScans(sessionId);
    livePollingInterval = setInterval(() => {
        fetchLiveScans(sessionId);
    }, 3000);
}

async function fetchLiveScans(sessionId) {
    if (!sessionId) return;
    try {
        const response = await fetch(`${API_BASE_URL}/live-attendance/${sessionId}?t=${Date.now()}`, { 
            headers: getAuthHeaders(),
            cache: 'no-store'
        });
        const resData = await response.json();

        if (response.ok && resData.status === 'success' && resData.data) {
            const livePin = resData.data.sessionPin || resData.data.session_pin;
            if (livePin) {
                updateSessionPinDisplay(livePin);
            }

            const presentStudents = resData.data.presentStudents || [];
            const absentStudents = resData.data.absentStudents || [];
            const totalScanned = resData.data.totalScanned || presentStudents.length;
            const totalAbsent = resData.data.totalAbsent || absentStudents.length;

            const pCountEl = document.getElementById('live-present-count');
            const aCountEl = document.getElementById('live-absent-count');
            if (pCountEl) pCountEl.textContent = totalScanned;
            if (aCountEl) aCountEl.textContent = totalAbsent;

            const pTbody = document.getElementById('live-present-tbody');
            if (pTbody) {
                if (presentStudents.length === 0) {
                    pTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 16px;">Waiting for student QR scans...</td></tr>`;
                } else {
                    pTbody.innerHTML = presentStudents.map(s => `
                        <tr>
                            <td><strong>${s.roll_no || 'N/A'}</strong></td>
                            <td>${s.student_name || s.name}</td>
                            <td>${s.enrollment_no || '-'}</td>
                            <td>${s.scanned_at ? new Date(s.scanned_at).toLocaleTimeString() : 'Just now'}</td>
                            <td>
                                <button class="btn btn-secondary" style="font-size: 11px; padding: 4px 10px; background: rgba(244,63,94,0.15); color: #f43f5e; border: 1px solid rgba(244,63,94,0.3); border-radius: 4px; cursor: pointer;" onclick="manualMarkStudent(${s.student_id || s.id}, 'Absent')">
                                    <i class="fa-solid fa-xmark"></i> Mark Absent
                                </button>
                            </td>
                        </tr>
                    `).join('');
                }
            }

            const aTbody = document.getElementById('live-absent-tbody');
            if (aTbody) {
                if (absentStudents.length === 0) {
                    aTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 16px;">All section students are present!</td></tr>`;
                } else {
                    aTbody.innerHTML = absentStudents.map(s => `
                        <tr>
                            <td><strong>${s.roll_no || 'N/A'}</strong></td>
                            <td>${s.student_name || s.name}</td>
                            <td>${s.enrollment_no || '-'}</td>
                            <td>${s.phone || '-'}</td>
                            <td>
                                <button class="btn btn-primary" style="font-size: 11px; padding: 4px 10px; background: rgba(16,185,129,0.2); color: var(--accent-emerald); border: 1px solid rgba(16,185,129,0.4); border-radius: 4px; cursor: pointer;" onclick="manualMarkStudent(${s.student_id || s.id}, 'Present')">
                                    <i class="fa-solid fa-check"></i> Mark Present
                                </button>
                            </td>
                        </tr>
                    `).join('');
                }
            }
        }
    } catch (err) {
        console.error('Error fetching live scans:', err);
    }
}

async function manualMarkStudent(studentId, status) {
    if (!activeSessionId) {
        showToast('Please initiate or select an attendance session first.', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/manual-mark`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ session_id: activeSessionId, student_id: studentId, status })
        });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            showToast(`Student marked as ${status}!`);
            fetchLiveScans(activeSessionId);
        } else {
            showToast(resData.message || 'Failed to mark status.', 'error');
        }
    } catch (err) {
        showToast('Error correcting attendance status.', 'error');
    }
}

async function closeAttendanceSession() {
    clearInterval(countdownTimer);
    clearInterval(livePollingInterval);

    if (!activeSessionId) return;

    try {
        await fetch(`${API_BASE_URL}/close-session/${activeSessionId}`, {
            method: 'POST',
            headers: getAuthHeaders()
        });

        showToast('Attendance session closed successfully.');
        activeSessionId = null;
        updateSessionPinDisplay(null);
        const statusEl = document.getElementById('dash-session-status');
        if (statusEl) {
            statusEl.textContent = 'Inactive';
            statusEl.style.color = 'var(--accent-emerald)';
        }
    } catch (err) {
        console.error('Error closing session:', err);
    }
}

/**
 * 4. STUDENT DIRECTORY SEARCH
 */
async function searchStudentDirectory() {
    const queryInput = document.getElementById('student-search-input');
    const classFilter = document.getElementById('student-filter-class');
    const tbody = document.getElementById('student-directory-tbody');

    if (!tbody) return;

    const query = queryInput ? queryInput.value.trim() : '';
    const class_id = classFilter ? classFilter.value : '';

    try {
        const response = await fetch(`${API_BASE_URL}/students-directory?query=${encodeURIComponent(query)}&class_id=${class_id}`, { headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            const students = resData.data;

            if (students.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">No matching student records found.</td></tr>`;
            } else {
                tbody.innerHTML = students.map(s => `
                    <tr>
                        <td><strong>${s.roll_no || 'N/A'}</strong></td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <img src="${s.profile_pic ? SERVER_URL + s.profile_pic : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(s.name)}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
                                <strong>${s.name}</strong>
                            </div>
                        </td>
                        <td>${s.enrollment_no}</td>
                        <td><span style="background: rgba(99,102,241,0.15); color: var(--accent-primary); padding: 2px 8px; border-radius: 10px; font-weight: 700; font-size: 11px;">Sec ${s.section_name || 'A'} - ${s.subject_name || 'Class'}</span></td>
                        <td>${s.email}</td>
                        <td>${s.phone || '-'}</td>
                    </tr>
                `).join('');
            }
        }
    } catch (err) {
        console.error('Error searching student directory:', err);
    }
}

/**
 * 5. COMPREHENSIVE ATTENDANCE REPORTS & EXPORTS
 */
function toggleReportFilters() {
    const type = document.getElementById('report-type-select').value;
    const dateBox = document.getElementById('report-date-box');
    const monthBox = document.getElementById('report-month-box');

    if (type === 'daily') {
        if (dateBox) dateBox.style.display = 'block';
        if (monthBox) monthBox.style.display = 'none';
    } else if (type === 'monthly') {
        if (dateBox) dateBox.style.display = 'none';
        if (monthBox) monthBox.style.display = 'block';
    } else {
        if (dateBox) dateBox.style.display = 'none';
        if (monthBox) monthBox.style.display = 'none';
    }
}

async function generateAttendanceReport() {
    const report_type = document.getElementById('report-type-select').value;
    const class_id = document.getElementById('report-class-select').value;
    const date = document.getElementById('report-date-input').value;
    const month = document.getElementById('report-month-input').value;
    const tbody = document.getElementById('reports-tbody');

    if (!tbody) return;

    try {
        let url = `${API_BASE_URL}/reports?report_type=${report_type}&class_id=${class_id}`;
        if (report_type === 'daily' && date) url += `&date=${date}`;
        if (report_type === 'monthly' && month) url += `&month=${month}`;

        const response = await fetch(url, { headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            const reports = resData.data;
            currentReportData = reports;

            if (reports.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">No matching attendance report records found.</td></tr>`;
            } else {
                tbody.innerHTML = reports.map(r => `
                    <tr>
                        <td>${new Date(r.scanned_at).toLocaleString()}</td>
                        <td><strong>${r.subject_name}</strong> (${r.subject_code})</td>
                        <td>Section ${r.section_name || 'A'}</td>
                        <td>${r.student_name}</td>
                        <td>${r.enrollment_no}</td>
                        <td><span style="color: var(--accent-emerald); font-weight: 700;">${r.status}</span></td>
                    </tr>
                `).join('');
            }
        }
    } catch (err) {
        console.error('Error generating report:', err);
    }
}

function exportReportPDF() {
    if (!window.jspdf || !currentReportData || currentReportData.length === 0) {
        showToast('Please generate a report first before exporting.', 'warning');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('Smart QR Attendance System - Faculty Attendance Report', 14, 20);

    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

    const tableRows = currentReportData.map(r => [
        new Date(r.scanned_at).toLocaleString(),
        r.subject_name,
        r.section_name || 'A',
        r.student_name,
        r.enrollment_no,
        r.status
    ]);

    doc.autoTable({
        startY: 35,
        head: [['Date & Time', 'Subject', 'Section', 'Student Name', 'Enrollment No', 'Status']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [99, 102, 241] }
    });

    doc.save(`Faculty_Attendance_Report_${Date.now()}.pdf`);
    showToast('Report PDF downloaded successfully!');
}

function exportReportExcel() {
    if (!currentReportData || currentReportData.length === 0) {
        showToast('Please generate a report first before exporting.', 'warning');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date & Time,Subject,Section,Student Name,Enrollment No,Status\n";

    currentReportData.forEach(r => {
        const row = [
            `"${new Date(r.scanned_at).toLocaleString()}"`,
            `"${r.subject_name}"`,
            `"${r.section_name || 'A'}"`,
            `"${r.student_name}"`,
            `"${r.enrollment_no}"`,
            `"${r.status}"`
        ].join(",");
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Faculty_Attendance_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Excel (CSV) report downloaded successfully!');
}

function printReport() {
    window.print();
}

function initResourceUpload() {
    const uploadForm = document.getElementById('upload-resource-form');
    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const class_id = document.getElementById('resource-class-select').value;
            const title = document.getElementById('resource-title').value;
            const fileInput = document.getElementById('resource-file');

            if (!class_id || !title || !fileInput.files[0]) {
                showToast('Please fill all required fields.', 'error');
                return;
            }

            const submitBtn = uploadForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Upload Resource';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
            }

            const formData = new FormData();
            formData.append('class_id', class_id);
            formData.append('title', title);
            formData.append('file', fileInput.files[0]);

            const token = localStorage.getItem('teacherToken') || localStorage.getItem('token');

            try {
                const response = await fetch(`${RESOURCE_API_URL}/upload`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                const resData = await response.json();

                if (response.ok && resData.status === 'success') {
                    showToast('Study material uploaded successfully!', 'success');
                    uploadForm.reset();
                    await fetchTeacherResources();
                } else {
                    showToast(resData.message || 'Failed to upload document.', 'error');
                }
            } catch (err) {
                console.error('Error uploading resource:', err);
                showToast('Error uploading resource.', 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnText;
                }
            }
        });
    }

    fetchTeacherResources();
}

async function fetchTeacherResources() {
    const tbody = document.getElementById('teacher-resources-tbody');
    if (!tbody) return;

    try {
        const response = await fetch(`${RESOURCE_API_URL}/teacher-list`, { headers: getAuthHeaders() });
        if (!response.ok) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 16px;">Failed to load study materials.</td></tr>`;
            return;
        }

        const resData = await response.json();
        if (resData.status === 'success') {
            const resources = resData.data || [];

            if (resources.length === 0) {
                tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 16px;">No study materials uploaded yet.</td></tr>`;
            } else {
                tbody.innerHTML = resources.map(r => {
                    const downloadUrl = r.downloadUrl || (r.file_path ? `${SERVER_URL}${r.file_path}` : `${SERVER_URL}${r.file_url}`);
                    const uploadDate = r.uploaded_at || r.created_at;
                    const dateDisplay = uploadDate ? new Date(uploadDate).toLocaleDateString() : 'Recent';
                    return `
                        <tr>
                            <td>
                                <a href="${downloadUrl}" target="_blank" download style="color: var(--accent-primary); font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
                                    <i class="fa-solid fa-file-pdf"></i> ${r.title}
                                </a>
                            </td>
                            <td>${r.subject_name || (r.subject_code ? `Subject (${r.subject_code})` : 'Class')}</td>
                            <td>${dateDisplay}</td>
                        </tr>
                    `;
                }).join('');
            }
        }
    } catch (err) {
        console.error('Error fetching teacher resources:', err);
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--accent-rose); padding: 16px;">Error loading uploaded materials.</td></tr>`;
    }
}

/**
 * 6. CLASS ANNOUNCEMENTS
 */
async function loadSentAnnouncements() {
    const listEl = document.getElementById('teacher-announcements-list') || document.getElementById('sentAnnouncementsList') || document.getElementById('announcements-log');
    if (!listEl) return;

    try {
        const response = await fetch(`${API_BASE_URL}/announcements`, { headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && (resData.success || resData.status === 'success')) {
            const announcements = resData.data;
            if (!announcements || announcements.length === 0) {
                listEl.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 28px;">No announcements sent yet. Broadcast one using the form!</div>`;
                return;
            }

            listEl.innerHTML = announcements.map(a => {
                const dateStr = a.created_at ? new Date(a.created_at).toLocaleString() : 'Just now';
                const pType = (a.type || a.priority || 'info').toLowerCase();

                let badgeStyle = 'background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3);';
                let badgeLabel = 'General Notice';
                if (pType === 'success') {
                    badgeStyle = 'background: rgba(16, 185, 129, 0.15); color: var(--accent-emerald); border: 1px solid rgba(16, 185, 129, 0.3);';
                    badgeLabel = 'Exam / Assignment';
                } else if (pType === 'warning' || pType === 'urgent' || pType === 'high') {
                    badgeStyle = 'background: rgba(244, 63, 94, 0.15); color: var(--accent-rose); border: 1px solid rgba(244, 63, 94, 0.3);';
                    badgeLabel = 'Urgent Alert';
                }

                const targetName = a.subject_name ? `${a.subject_name} (${a.section_name ? `Sec ${a.section_name}` : 'Section'})` : (a.title || 'Enrolled Class');

                return `
                    <div style="background: var(--input-bg); border: 1px solid var(--glass-border); border-radius: var(--radius-md); padding: 14px 16px; display: flex; flex-direction: column; gap: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
                            <span style="font-size: 13px; font-weight: 700; color: var(--text-primary);">${targetName}</span>
                            <span style="${badgeStyle} padding: 3px 9px; border-radius: 12px; font-size: 10.5px; font-weight: 700; text-transform: uppercase;">${badgeLabel}</span>
                        </div>
                        <p style="font-size: 12.5px; color: var(--text-secondary); margin: 0; line-height: 1.5; word-break: break-word;">${a.message}</p>
                        <div style="font-size: 11px; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--glass-border); padding-top: 6px; margin-top: 2px;">
                            <span><i class="fa-solid fa-chalkboard-user"></i> ${targetName}</span>
                            <span><i class="fa-solid fa-clock"></i> ${dateStr}</span>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            listEl.innerHTML = `<div style="text-align: center; color: var(--accent-rose); padding: 20px;">Failed to load announcements log.</div>`;
        }
    } catch (err) {
        console.error('Error fetching teacher announcements:', err);
        listEl.innerHTML = `<div style="text-align: center; color: var(--accent-rose); padding: 20px;">Error connecting to server.</div>`;
    }
}

const loadTeacherAnnouncements = loadSentAnnouncements;
window.loadTeacherAnnouncements = loadSentAnnouncements;
window.loadSentAnnouncements = loadSentAnnouncements;

function initAnnouncementForm() {
    const form = document.getElementById('announcement-form') || document.getElementById('announcementForm');
    const submitBtn = document.getElementById('announcement-submit-btn') || document.getElementById('broadcastAnnouncementBtn');

    if (!form && !submitBtn) return;

    const handleBroadcast = async (e) => {
        if (e) e.preventDefault();

        const classSelect = document.getElementById('announcement-class-select') || document.getElementById('announcementClassSelect') || document.getElementById('class-select');
        const typeSelect = document.getElementById('announcement-type') || document.getElementById('announcementPriority') || document.getElementById('alert-priority');
        const msgTextarea = document.getElementById('announcement-msg') || document.getElementById('announcementMessage') || document.getElementById('announcement-message');

        const class_id = classSelect ? classSelect.value : '';
        const priority = typeSelect ? typeSelect.value : 'info';
        const message = msgTextarea ? msgTextarea.value : '';

        if (!class_id || !class_id.trim()) {
            showToast('Please select a target class section.', 'error');
            if (classSelect) classSelect.focus();
            return;
        }

        if (!message || !message.trim()) {
            showToast('Please enter an announcement message.', 'error');
            if (msgTextarea) msgTextarea.focus();
            return;
        }

        const btn = submitBtn || (form ? form.querySelector('button[type="submit"]') : null);
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Broadcasting...';
        }

        try {
            const token = localStorage.getItem('teacherToken') || localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/announcements`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    class_id, 
                    type: priority, 
                    priority, 
                    message: message.trim() 
                })
            });
            const resData = await response.json();

            if (response.ok && (resData.success || resData.status === 'success')) {
                showToast(resData.message || 'Announcement broadcast successfully!', 'success');
                if (msgTextarea) msgTextarea.value = '';
                if (form) form.reset();
                loadSentAnnouncements();
            } else {
                showToast(resData.message || 'Failed to dispatch announcement.', 'error');
            }
        } catch (err) {
            console.error('Error broadcasting announcement:', err);
            showToast('Error broadcasting announcement to server.', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-bullhorn" style="margin-right: 8px;"></i> Broadcast Announcement Now';
            }
        }
    };

    if (form) {
        form.addEventListener('submit', handleBroadcast);
    }
    if (submitBtn && submitBtn.type !== 'submit') {
        submitBtn.addEventListener('click', handleBroadcast);
    }
}

/**
 * 7. FACULTY PROFILE & SECURITY
 */
async function loadTeacherProfile() {
    try {
        const response = await fetch(`${API_BASE_URL}/profile`, { headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            const p = resData.data;

            const nameEl = document.getElementById('teacher-prof-name');
            const empEl = document.getElementById('teacher-prof-emp-id');
            const emailEl = document.getElementById('teacher-prof-email');
            const cardEmpEl = document.getElementById('teacher-prof-empid-card');
            const deptEl = document.getElementById('teacher-prof-dept');
            const phoneEl = document.getElementById('teacher-prof-phone');

            if (nameEl) nameEl.textContent = p.name;
            if (empEl) empEl.textContent = `Employee ID: ${p.employee_id}`;
            if (emailEl) emailEl.textContent = p.email || '-';
            if (cardEmpEl) cardEmpEl.textContent = p.employee_id;
            if (deptEl) deptEl.textContent = p.department_name || 'General Academic';
            if (phoneEl) phoneEl.textContent = p.phone || 'Not Provided';

            const imgPreview = document.getElementById('teacher-profile-img-preview');
            if (imgPreview) {
                imgPreview.src = p.profile_pic ? `${SERVER_URL}${p.profile_pic}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=6366f1&color=fff`;
            }

            updateTopbarAvatar(p.profile_pic, p.name);
            const userStr = localStorage.getItem('teacherUser') || localStorage.getItem('user');
            if (userStr) {
                try {
                    const u = JSON.parse(userStr);
                    u.profile_pic = p.profile_pic;
                    localStorage.setItem('teacherUser', JSON.stringify(u));
                } catch (e) {}
            }
        }
    } catch (err) {
        console.error('Error loading teacher profile:', err);
    }
}

function initProfileListeners() {
    const fileInput = document.getElementById('teacher-profile-pic-input');
    const imgPreview = document.getElementById('teacher-profile-img-preview');

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

    const picForm = document.getElementById('teacher-pic-form');
    if (picForm) {
        picForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('teacher-profile-pic-input');
            if (!input.files || input.files.length === 0) return;

            const formData = new FormData();
            formData.append('profile_pic', input.files[0]);

            const token = localStorage.getItem('teacherToken') || localStorage.getItem('token');

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

                    const userStr = localStorage.getItem('teacherUser');
                    let userName = 'Teacher';
                    if (userStr) {
                        try {
                            const u = JSON.parse(userStr);
                            u.profile_pic = newPhotoUrl;
                            userName = u.name || userName;
                            localStorage.setItem('teacherUser', JSON.stringify(u));
                        } catch (err) {}
                    }

                    if (newPhotoUrl) updateTopbarAvatar(newPhotoUrl, userName);
                    picForm.reset();
                    loadTeacherProfile();
                } else {
                    showToast(resData.message || 'Failed to upload profile image.', 'error');
                }
            } catch (err) {
                showToast('Error uploading profile image.', 'error');
            }
        });
    }

    const passForm = document.getElementById('teacher-pass-form');
    if (passForm) {
        passForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentPassword = document.getElementById('t-curr-pass').value;
            const newPassword = document.getElementById('t-new-pass').value;

            try {
                const response = await fetch(`${API_BASE_URL}/change-password`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ currentPassword, newPassword })
                });
                const resData = await response.json();

                if (response.ok && resData.status === 'success') {
                    showToast('Password changed successfully!');
                    passForm.reset();
                } else {
                    showToast(resData.message || 'Failed to change password.', 'error');
                }
            } catch (err) {
                showToast('Error updating password.', 'error');
            }
        });
    }
}

/**
 * UTILITY TOAST ENGINE
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