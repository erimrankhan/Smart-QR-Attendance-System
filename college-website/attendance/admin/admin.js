/**
 * Smart QR Attendance System - Admin Portal Logic (Full Suite)
 */

const API_BASE_URL = 'http://127.0.0.1:5000/api/admin';

document.addEventListener('DOMContentLoaded', () => {
    checkAdminAuth();
    initTheme();
    loadDashboardSummary();
    initNavigation();
    initFormSubmitListeners();
    initSubjectCourseChangeListener();
    fetchPendingFaculty();
    fetchPendingApprovals();
});

/**
 * 1. AUTHENTICATION CHECK
 */
function checkAdminAuth() {
    const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
    const userStr = localStorage.getItem('adminUser') || localStorage.getItem('user');

    if (!token || !userStr) {
        redirectToLogin();
        return;
    }

    try {
        const user = JSON.parse(userStr);
        if (user.role !== 'Admin') {
            showToast('Unauthorized access. Redirecting to Admin Login.', 'error');
            redirectToLogin();
            return;
        }

        const nameDisplay = document.getElementById('admin-username-display');
        if (nameDisplay) nameDisplay.textContent = user.username || user.name || 'Admin';

        if (user.profile_pic) {
            updateAdminTopbarAvatar(user.profile_pic, user.username);
        }

    } catch (e) {
        redirectToLogin();
    }
}

function updateAdminTopbarAvatar(photoUrl, name) {
    const avatarEl = document.getElementById('topbarAvatarContainer');
    if (!avatarEl) return;

    if (photoUrl) {
        const fullUrl = photoUrl.startsWith('http') ? photoUrl : `http://192.168.0.109:5000${photoUrl}`;
        avatarEl.innerHTML = `<img src="${fullUrl}" class="avatar-img" alt="${name || 'Admin'}">`;
    } else {
        avatarEl.textContent = 'A';
    }
}

function getAuthHeaders() {
    const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

function redirectToLogin() {
    window.location.href = '/attendance/admin/login.html';
}

function initTheme() {
    const themeBtn = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('adminTheme') || 'dark';

    document.body.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const currentTheme = document.body.getAttribute('data-theme') || 'dark';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

            document.body.setAttribute('data-theme', newTheme);
            localStorage.setItem('adminTheme', newTheme);
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
 * 2. NAVIGATION & SPA VIEW SWITCHER
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
                'Are you sure you want to log out of your Admin Portal account?',
                () => {
                    localStorage.removeItem('adminToken');
                    localStorage.removeItem('adminUser');
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
                localStorage.removeItem('adminToken');
                localStorage.removeItem('adminUser');
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
}

function switchView(viewId) {
    const views = document.querySelectorAll('.view-section');
    const navItems = document.querySelectorAll('.nav-item[data-view]');
    const titleEl = document.getElementById('view-title');
    const subtitleEl = document.getElementById('view-subtitle');

    views.forEach(v => v.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));

    const targetView = document.getElementById(viewId);
    const targetNav = document.querySelector(`.nav-item[data-view="${viewId}"]`);

    if (targetView) targetView.classList.add('active');
    if (targetNav) targetNav.classList.add('active');

    if (viewId === 'dashboard-view') {
        if (titleEl) titleEl.textContent = 'System Overview';
        if (subtitleEl) subtitleEl.textContent = 'College Smart QR Attendance Analytics & Administration';
        loadDashboardSummary();
    } else if (viewId === 'departments-view') {
        if (titleEl) titleEl.textContent = 'Department Management';
        if (subtitleEl) subtitleEl.textContent = 'Create and manage academic departments';
        fetchDepartments();
    } else if (viewId === 'courses-view') {
        if (titleEl) titleEl.textContent = 'Course Program Management';
        if (subtitleEl) subtitleEl.textContent = 'Create and manage degree & diploma course programs';
        fetchDepartments();
        fetchCourses();
    } else if (viewId === 'subjects-view') {
        if (titleEl) titleEl.textContent = 'Subject Curriculum Management';
        if (subtitleEl) subtitleEl.textContent = 'Create and manage theory & practical subjects for courses';
        fetchSubjectFormData();
        fetchSubjects();
    } else if (viewId === 'teachers-view') {
        if (titleEl) titleEl.textContent = 'Faculty Management';
        if (subtitleEl) subtitleEl.textContent = 'Manage teacher accounts, reset passwords, and toggle status';
        fetchTeachers();
    } else if (viewId === 'students-view') {
        if (titleEl) titleEl.textContent = 'Student Registry';
        if (subtitleEl) subtitleEl.textContent = 'Enroll students, reset passwords, and toggle account status';
        fetchStudentDepartmentFilterOptions();
        fetchStudents();
    } else if (viewId === 'assignments-view') {
        if (titleEl) titleEl.textContent = 'Class & Faculty Mapping';
        if (subtitleEl) subtitleEl.textContent = 'Assign subjects and sections to faculty members';
        fetchAssignmentFormData();
        fetchAssignedClasses();
    } else if (viewId === 'attendance-view') {
        if (titleEl) titleEl.textContent = 'Attendance Master Log';
        if (subtitleEl) subtitleEl.textContent = 'View, edit, or delete attendance records across all classes';
        fetchMasterAttendanceLogs();
    } else if (viewId === 'approvals-view') {
        if (titleEl) titleEl.textContent = 'Pending Approvals & Leave Requests';
        if (subtitleEl) subtitleEl.textContent = 'Review pending registrations and approve/reject student absence leaves';
        fetchPendingFaculty();
        fetchPendingApprovals();
        fetchLeaveRequests();
    } else if (viewId === 'settings-view') {
        if (titleEl) titleEl.textContent = 'System Configuration';
        if (subtitleEl) subtitleEl.textContent = 'Manage core institution settings and QR defaults';
        fetchSystemSettings();
    }
}

/**
 * 3. DASHBOARD SUMMARY & OVERALL ANALYTICS
 */
async function loadDashboardSummary() {
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard-stats`, { headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            const { totalStudents, totalTeachers, totalDepartments, activeClasses, todayAttendance, overallPercentage } = resData.data;

            const stEl = document.getElementById('dash-total-students');
            const tcEl = document.getElementById('dash-total-teachers');
            const dpEl = document.getElementById('dash-total-depts');
            const clEl = document.getElementById('dash-active-classes');
            const tdEl = document.getElementById('dash-today-attendance');
            const ovEl = document.getElementById('dash-overall-pct');

            if (stEl) stEl.textContent = totalStudents;
            if (tcEl) tcEl.textContent = totalTeachers;
            if (dpEl) dpEl.textContent = totalDepartments;
            if (clEl) clEl.textContent = activeClasses;
            if (tdEl) tdEl.textContent = `${todayAttendance || 0} Scans`;
            if (ovEl) ovEl.textContent = `${overallPercentage || 100}%`;
        }
    } catch (err) {
        console.error('Error loading dashboard summary:', err);
    }
}

/**
 * 4. DEPARTMENT MANAGEMENT
 */
async function fetchDepartments() {
    const tbody = document.getElementById('departments-tbody');
    const courseDeptSelect = document.getElementById('course-dept-select');
    const teacherDeptSelect = document.getElementById('teacher-dept-select');

    try {
        const response = await fetch(`${API_BASE_URL}/departments`, { headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            const departments = resData.data;

            if (tbody) {
                if (departments.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No departments created yet.</td></tr>`;
                } else {
                    tbody.innerHTML = departments.map(d => `
                        <tr>
                            <td>${d.id}</td>
                            <td><strong>${d.name}</strong></td>
                            <td><span style="background: rgba(99,102,241,0.15); color: var(--accent-primary); padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 700;">${d.code}</span></td>
                            <td>
                                <button class="btn btn-danger" style="padding: 4px 10px; font-size: 11px;" onclick="deleteDepartment(${d.id})">
                                    <i class="fa-solid fa-trash"></i> Delete
                                </button>
                            </td>
                        </tr>
                    `).join('');
                }
            }

            const options = '<option value="">Select Department *</option>' + departments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
            if (courseDeptSelect) courseDeptSelect.innerHTML = options;
            const editCourseDeptSelect = document.getElementById('edit-course-dept-select');
            if (editCourseDeptSelect) editCourseDeptSelect.innerHTML = options;
            if (teacherDeptSelect) teacherDeptSelect.innerHTML = options;
        }
    } catch (err) {
        console.error('Error fetching departments:', err);
    }
}

async function deleteDepartment(id) {
    if (!confirm('Are you sure you want to delete this department?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/departments/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            showToast('Department deleted successfully.');
            fetchDepartments();
            loadDashboardSummary();
        } else {
            showToast(resData.message || 'Failed to delete department.', 'error');
        }
    } catch (err) {
        showToast('Error deleting department.', 'error');
    }
}

/**
 * 5. COURSES PROGRAM MANAGEMENT
 */
async function fetchCourses() {
    const tbody = document.getElementById('courses-tbody');
    if (!tbody) return;

    try {
        const response = await fetch(`${API_BASE_URL}/courses`, { headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            const courses = resData.data;

            if (courses.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No courses created yet.</td></tr>`;
            } else {
                tbody.innerHTML = courses.map(c => {
                    const safeName = (c.name || '').replace(/'/g, "\\'");
                    const safeCode = (c.code || '').replace(/'/g, "\\'");
                    return `
                        <tr>
                            <td>${c.id}</td>
                            <td><strong>${c.name}</strong></td>
                            <td><span style="background: rgba(99,102,241,0.15); color: var(--accent-primary); padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 700;">${c.code}</span></td>
                            <td>${c.duration_years} Years</td>
                            <td>${c.department_name || 'General'}</td>
                            <td>
                                <div style="display: flex; gap: 6px;">
                                    <button class="btn btn-primary" style="padding: 4px 8px; font-size: 11px; background: var(--accent-cyan);" onclick="openEditCourseModal(${c.id}, '${safeName}', '${safeCode}', ${c.duration_years || 4}, ${c.department_id || 'null'})">
                                        <i class="fa-solid fa-pen-to-square"></i> Edit
                                    </button>
                                    <button class="btn btn-danger" style="padding: 4px 8px; font-size: 11px;" onclick="deleteCourse(${c.id})">
                                        <i class="fa-solid fa-trash"></i> Delete
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }
    } catch (err) {
        console.error('Error fetching courses:', err);
    }
}

function openEditCourseModal(id, name, code, duration, deptId) {
    const modal = document.getElementById('editCourseModal');
    if (!modal) return;

    document.getElementById('edit-course-id').value = id;
    document.getElementById('edit-course-name').value = name;
    document.getElementById('edit-course-code').value = code;
    document.getElementById('edit-course-duration').value = duration || 4;

    const deptSelect = document.getElementById('edit-course-dept-select');
    if (deptSelect && deptId) deptSelect.value = deptId;

    modal.style.display = 'flex';
}

function closeEditCourseModal() {
    const modal = document.getElementById('editCourseModal');
    if (modal) modal.style.display = 'none';
}

async function deleteCourse(id) {
    if (!confirm('Are you sure you want to delete this course program?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/courses/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            showToast('Course deleted successfully.');
            fetchCourses();
        } else {
            showToast(resData.message || 'Failed to delete course.', 'error');
        }
    } catch (err) {
        showToast('Error deleting course.', 'error');
    }
}

/**
 * 6. SUBJECTS CURRICULUM MANAGEMENT
 */
async function fetchSubjectFormData() {
    const deptSelect = document.getElementById('subject-dept-select');
    const courseSelect = document.getElementById('subject-course-select');
    const semesterSelect = document.getElementById('subject-semester-select');

    try {
        // 1. Fetch Departments
        const deptResponse = await fetch(`${API_BASE_URL}/departments`, { headers: getAuthHeaders() });
        const deptData = await deptResponse.json();
        if (deptResponse.ok && deptData.status === 'success' && deptSelect) {
            deptSelect.innerHTML = '<option value="">Select Department</option>' + deptData.data.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
        }

        // 2. Fetch Courses for Subject Form
        const formDataResponse = await fetch(`${API_BASE_URL}/subject-form-data`, { headers: getAuthHeaders() });
        const formDataRes = await formDataResponse.json();
        if (formDataResponse.ok && formDataRes.status === 'success') {
            const { courses } = formDataRes.data;

            if (courseSelect) {
                const currentVal = courseSelect.value;
                courseSelect.innerHTML = '<option value="">Select Course Program</option>' + 
                    courses.map(c => {
                        const duration = c.duration_years || 4;
                        return `<option value="${c.id}" data-duration="${duration}">${c.name} (${c.code}) - ${duration} Yrs</option>`;
                    }).join('');
                if (currentVal) courseSelect.value = currentVal;
            }

            // Ensure semester select is in default state if no course selected
            if (semesterSelect && (!courseSelect || !courseSelect.value)) {
                semesterSelect.disabled = true;
                semesterSelect.innerHTML = '<option value="">Select Semester</option>';
            }
        }
    } catch (err) {
        console.error('Error fetching subject form data:', err);
    }
}

function initSubjectCourseChangeListener() {
    const courseSelect = document.getElementById('subject-course-select');
    const semesterSelect = document.getElementById('subject-semester-select');

    if (!courseSelect || !semesterSelect) return;

    courseSelect.addEventListener('change', () => {
        const selectedOption = courseSelect.options[courseSelect.selectedIndex];
        const duration = selectedOption ? selectedOption.getAttribute('data-duration') : null;

        if (!courseSelect.value || !duration) {
            semesterSelect.disabled = true;
            semesterSelect.innerHTML = '<option value="">Select Semester</option>';
            return;
        }

        const totalSemesters = parseInt(duration, 10) * 2;
        semesterSelect.disabled = false;

        let options = '<option value="">Select Semester</option>';
        for (let i = 1; i <= totalSemesters; i++) {
            options += `<option value="${i}">Semester ${i}</option>`;
        }
        semesterSelect.innerHTML = options;
    });
}

async function fetchSubjects() {
    const tbody = document.getElementById('subjects-tbody');
    if (!tbody) return;

    try {
        const response = await fetch(`${API_BASE_URL}/subjects`, { headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            const subjects = resData.data;

            if (subjects.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No subjects created yet.</td></tr>`;
            } else {
                tbody.innerHTML = subjects.map(s => {
                    const courseDisplay = s.course_code ? `${s.course_code}` : (s.course_name || '-');
                    const semDisplay = s.semester_number ? `Semester ${s.semester_number}` : '-';

                    return `
                        <tr>
                            <td><strong>${s.code}</strong></td>
                            <td>${s.name}</td>
                            <td><span style="background: rgba(16,185,129,0.15); color: var(--accent-emerald); padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 700;">${s.type || 'Theory'}</span></td>
                            <td><span style="background: rgba(99,102,241,0.15); color: var(--accent-primary); padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 700;">${courseDisplay}</span></td>
                            <td>${semDisplay}</td>
                            <td>${s.department_name || 'General'}</td>
                            <td>
                                <button class="btn btn-danger" style="padding: 4px 10px; font-size: 11px;" onclick="deleteSubject(${s.id})">
                                    <i class="fa-solid fa-trash"></i> Delete
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }
    } catch (err) {
        console.error('Error fetching subjects:', err);
    }
}

async function deleteSubject(id) {
    if (!confirm('Are you sure you want to delete this subject?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/subjects/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            showToast('Subject deleted.');
            fetchSubjects();
        } else {
            showToast(resData.message || 'Failed to delete subject.', 'error');
        }
    } catch (err) {
        showToast('Error deleting subject.', 'error');
    }
}

let currentTeachersList = [];
let currentStudentsList = [];

/**
 * 7. USER MANAGEMENT (TEACHERS & STUDENTS CONTROLS)
 */
async function fetchTeachers() {
    const tbody = document.getElementById('teachers-tbody');
    if (!tbody) return;

    try {
        const response = await fetch(`${API_BASE_URL}/teachers`, { headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            const teachers = resData.data;
            currentTeachersList = teachers;

            if (teachers.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No faculty members registered.</td></tr>`;
            } else {
                tbody.innerHTML = teachers.map(t => {
                    const isPending = t.status === 'Pending';
                    const isInactive = t.status === 'Inactive';
                    let statusBadge = `<span class="badge-present">${t.status}</span>`;
                    if (isPending) statusBadge = `<span style="background: rgba(245,158,11,0.15); color: #f59e0b; padding: 3px 10px; border-radius: 12px; font-weight: 700; font-size: 11px;">Pending</span>`;
                    if (isInactive) statusBadge = `<span style="background: rgba(244,63,94,0.15); color: #f43f5e; padding: 3px 10px; border-radius: 12px; font-weight: 700; font-size: 11px;">Inactive</span>`;

                    return `
                        <tr>
                            <td><strong>${t.employee_id}</strong></td>
                            <td>${t.name}</td>
                            <td>${t.department_name || 'General'}</td>
                            <td>${t.email}</td>
                            <td>${statusBadge}</td>
                            <td>
                                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                    <button class="btn btn-primary" style="padding: 4px 8px; font-size: 11px;" onclick="openEditTeacherModal(${t.id})">
                                        <i class="fa-solid fa-pen-to-square"></i> Edit Details
                                    </button>
                                    <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="promptResetPassword('Teacher', ${t.id}, '${t.name}')">
                                        <i class="fa-solid fa-key"></i> Reset Pass
                                    </button>
                                    <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="toggleUserAccountStatus('Teacher', ${t.id}, '${t.status === 'Active' ? 'Inactive' : 'Active'}')">
                                        <i class="fa-solid fa-power-off"></i> ${t.status === 'Active' ? 'Deactivate' : 'Activate'}
                                    </button>
                                    <button class="btn btn-danger" style="padding: 4px 8px; font-size: 11px;" onclick="deleteTeacher(${t.id})">
                                        <i class="fa-solid fa-trash"></i> Delete
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }
    } catch (err) {
        console.error('Error fetching teachers:', err);
    }
}

async function deleteTeacher(id) {
    if (!confirm('Are you sure you want to delete this teacher account?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/teachers/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            showToast('Teacher account deleted.');
            fetchTeachers();
            loadDashboardSummary();
        } else {
            showToast(resData.message || 'Failed to delete teacher.', 'error');
        }
    } catch (err) {
        showToast('Error deleting teacher.', 'error');
    }
}

async function fetchStudentDepartmentFilterOptions() {
    const filterEl = document.getElementById('student-dept-filter');
    if (!filterEl) return;

    try {
        const response = await fetch(`${API_BASE_URL}/departments`, { headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            const departments = resData.data;
            const currentVal = filterEl.value;
            filterEl.innerHTML = '<option value="">All Departments</option>' +
                departments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
            if (currentVal) filterEl.value = currentVal;
        }
    } catch (e) {
        console.error('Error loading student department filter options:', e);
    }
}

async function fetchStudents(department_id = null) {
    const tbody = document.getElementById('students-tbody');
    if (!tbody) return;

    try {
        const filterEl = document.getElementById('student-dept-filter');
        const deptId = department_id || (filterEl ? filterEl.value : '');
        const queryStr = deptId ? `?department_id=${deptId}` : '';

        const response = await fetch(`${API_BASE_URL}/students${queryStr}`, { headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            const students = resData.data;
            currentStudentsList = students;

            if (students.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No students enrolled yet.</td></tr>`;
            } else {
                tbody.innerHTML = students.map(s => {
                    const isInactive = s.status === 'Inactive';
                    let statusBadge = `<span class="badge-present">${s.status}</span>`;
                    if (isInactive) statusBadge = `<span style="background: rgba(244,63,94,0.15); color: #f43f5e; padding: 3px 10px; border-radius: 12px; font-weight: 700; font-size: 11px;">Inactive</span>`;

                    return `
                        <tr>
                            <td><strong>${s.enrollment_no}</strong></td>
                            <td>${s.roll_no || '-'}</td>
                            <td>${s.name}</td>
                            <td><span style="background: rgba(99,102,241,0.15); color: var(--accent-primary); padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 700;">${s.course_name || '-'}</span></td>
                            <td>${s.department_name || 'General'}</td>
                            <td>${s.email}</td>
                            <td>${statusBadge}</td>
                            <td>
                                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                    <button class="btn btn-primary" style="padding: 4px 8px; font-size: 11px;" onclick="openEditStudentModal(${s.id})">
                                        <i class="fa-solid fa-pen-to-square"></i> Edit Details
                                    </button>
                                    <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="promptResetPassword('Student', ${s.id}, '${s.name}')">
                                        <i class="fa-solid fa-key"></i> Reset Pass
                                    </button>
                                    <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="toggleUserAccountStatus('Student', ${s.id}, '${s.status === 'Active' ? 'Inactive' : 'Active'}')">
                                        <i class="fa-solid fa-power-off"></i> ${s.status === 'Active' ? 'Deactivate' : 'Activate'}
                                    </button>
                                    <button class="btn btn-danger" style="padding: 4px 8px; font-size: 11px;" onclick="deleteStudent(${s.id})">
                                        <i class="fa-solid fa-trash"></i> Delete
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }
    } catch (err) {
        console.error('Error fetching students:', err);
    }
}

async function deleteStudent(id) {
    if (!confirm('Are you sure you want to delete this student account?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/students/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            showToast('Student account deleted.');
            fetchStudents();
            loadDashboardSummary();
        } else {
            showToast(resData.message || 'Failed to delete student.', 'error');
        }
    } catch (err) {
        showToast('Error deleting student.', 'error');
    }
}

/**
 * EDIT FACULTY MODAL HANDLERS
 */
async function openEditTeacherModal(id) {
    const teacher = currentTeachersList.find(t => t.id === id);
    if (!teacher) return;

    document.getElementById('edit-teacher-id').value = teacher.id;
    document.getElementById('edit-teacher-emp-id').value = teacher.employee_id || '';
    document.getElementById('edit-teacher-name').value = teacher.name || '';
    document.getElementById('edit-teacher-email').value = teacher.email || '';
    document.getElementById('edit-teacher-phone').value = teacher.phone || '';
    document.getElementById('edit-teacher-status').value = teacher.status || 'Active';

    // Populate department options
    const deptSelect = document.getElementById('edit-teacher-dept-select');
    if (deptSelect) {
        try {
            const response = await fetch(`${API_BASE_URL}/departments`, { headers: getAuthHeaders() });
            const resData = await response.json();
            if (response.ok && resData.status === 'success') {
                deptSelect.innerHTML = '<option value="">Select Department</option>' + 
                    resData.data.map(d => `<option value="${d.id}" ${d.id === teacher.department_id ? 'selected' : ''}>${d.name} (${d.code})</option>`).join('');
            }
        } catch (e) {}
    }

    const modal = document.getElementById('editTeacherModal');
    if (modal) modal.style.display = 'flex';
}

function closeEditTeacherModal() {
    const modal = document.getElementById('editTeacherModal');
    if (modal) modal.style.display = 'none';
}

/**
 * EDIT STUDENT MODAL HANDLERS
 */
function openEditStudentModal(id) {
    const student = currentStudentsList.find(s => s.id === id);
    if (!student) return;

    document.getElementById('edit-student-id').value = student.id;
    document.getElementById('edit-student-enrollment').value = student.enrollment_no || '';
    document.getElementById('edit-student-roll').value = student.roll_no || '';
    document.getElementById('edit-student-name').value = student.name || '';
    document.getElementById('edit-student-email').value = student.email || '';
    document.getElementById('edit-student-phone').value = student.phone || '';
    document.getElementById('edit-student-status').value = student.status || 'Active';

    const modal = document.getElementById('editStudentModal');
    if (modal) modal.style.display = 'flex';
}

function closeEditStudentModal() {
    const modal = document.getElementById('editStudentModal');
    if (modal) modal.style.display = 'none';
}

async function promptResetPassword(userType, userId, userName) {
    const newPassword = prompt(`Enter new password for ${userName} (${userType}):`);
    if (!newPassword || newPassword.trim().length < 6) {
        showToast('Password must be at least 6 characters.', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/users/reset-password`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ userType, userId, newPassword: newPassword.trim() })
        });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            showToast(`Password for ${userName} reset successfully!`);
        } else {
            showToast(resData.message || 'Failed to reset password.', 'error');
        }
    } catch (err) {
        showToast('Error resetting password.', 'error');
    }
}

async function toggleUserAccountStatus(userType, userId, status) {
    try {
        const response = await fetch(`${API_BASE_URL}/users/toggle-status`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ userType, userId, status })
        });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            showToast(`${userType} status set to ${status}.`);
            if (userType === 'Teacher') fetchTeachers();
            else fetchStudents();
        } else {
            showToast(resData.message || 'Failed to update status.', 'error');
        }
    } catch (err) {
        showToast('Error updating status.', 'error');
    }
}

/**
 * 8. CLASS & TEACHER MAPPING
 */
async function fetchAssignmentFormData() {
    const deptSelect = document.getElementById('assignDepartmentSelect');
    const facultySelect = document.getElementById('assignFacultySelect');
    const subjectSelect = document.getElementById('assignSubjectSelect');
    const sectionSelect = document.getElementById('assign-section-select');

    if (!deptSelect && !sectionSelect) return;

    try {
        const response = await fetch(`${API_BASE_URL}/assignment-form-data`, { headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            const { departments, sections } = resData.data;

            if (deptSelect && departments) {
                deptSelect.innerHTML = '<option value="">Select Department *</option>' + 
                    departments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
            }
            
            if (facultySelect) {
                facultySelect.disabled = true;
                facultySelect.innerHTML = '<option value="">Select Department First</option>';
            }

            if (subjectSelect) {
                subjectSelect.disabled = true;
                subjectSelect.innerHTML = '<option value="">Select Department First</option>';
            }

            if (sectionSelect && sections) {
                sectionSelect.innerHTML = '<option value="">Select Section (Optional)</option>' + 
                    sections.map(sec => `<option value="${sec.id}">${sec.section_name || sec.name}</option>`).join('');
            }
        }
    } catch (err) {
        console.error('Error fetching assignment options:', err);
    }
}

async function fetchAssignedClasses() {
    const tbody = document.getElementById('assigned-classes-tbody');
    if (!tbody) return;

    try {
        const response = await fetch(`${API_BASE_URL}/assigned-classes`, { headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            const assignments = resData.data;

            if (assignments.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No class mappings created yet.</td></tr>`;
            } else {
                tbody.innerHTML = assignments.map(a => `
                    <tr>
                        <td>#${a.class_id}</td>
                        <td><strong>${a.teacher_name}</strong></td>
                        <td>${a.subject_name} (${a.subject_code})</td>
                        <td>Section ${a.section_name || 'A'}</td>
                        <td>
                            <button class="btn btn-danger" style="padding: 4px 10px; font-size: 11px;" onclick="deleteAssignedClass(${a.class_id})">
                                <i class="fa-solid fa-trash"></i> Remove
                            </button>
                        </td>
                    </tr>
                `).join('');
            }
        }
    } catch (err) {
        console.error('Error fetching assigned classes:', err);
    }
}

async function deleteAssignedClass(id) {
    if (!confirm('Are you sure you want to remove this class mapping?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/assigned-classes/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            showToast('Class mapping removed.');
            fetchAssignedClasses();
        } else {
            showToast(resData.message || 'Failed to delete mapping.', 'error');
        }
    } catch (err) {
        showToast('Error removing class mapping.', 'error');
    }
}

/**
 * 9. ATTENDANCE MASTER LOG & EDIT RECORDS
 */
async function fetchMasterAttendanceLogs() {
    const tbody = document.getElementById('master-attendance-tbody');
    if (!tbody) return;

    try {
        const response = await fetch(`${API_BASE_URL}/attendance`, { headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            const records = resData.data;

            if (records.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px;">No master attendance records found.</td></tr>`;
            } else {
                tbody.innerHTML = records.map(r => `
                    <tr>
                        <td>${new Date(r.scanned_at).toLocaleString()}</td>
                        <td><strong>${r.student_name}</strong></td>
                        <td>${r.enrollment_no}</td>
                        <td>${r.subject_name} (${r.subject_code})</td>
                        <td>${r.teacher_name || 'Faculty'}</td>
                        <td><span style="color: ${r.status === 'Present' ? 'var(--accent-emerald)' : '#f43f5e'}; font-weight: 700;">${r.status}</span></td>
                        <td>
                            <div style="display: flex; gap: 6px;">
                                <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="editAttendanceRecord(${r.id}, '${r.status === 'Present' ? 'Absent' : 'Present'}')">
                                    <i class="fa-solid fa-pen-to-square"></i> Set ${r.status === 'Present' ? 'Absent' : 'Present'}
                                </button>
                                <button class="btn btn-danger" style="padding: 4px 8px; font-size: 11px;" onclick="deleteAttendanceRecord(${r.id})">
                                    <i class="fa-solid fa-trash"></i> Delete
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            }
        }
    } catch (err) {
        console.error('Error fetching master attendance logs:', err);
    }
}

async function editAttendanceRecord(id, newStatus) {
    try {
        const response = await fetch(`${API_BASE_URL}/attendance/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: newStatus })
        });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            showToast(`Attendance record updated to ${newStatus}!`);
            fetchMasterAttendanceLogs();
            loadDashboardSummary();
        } else {
            showToast(resData.message || 'Failed to edit record.', 'error');
        }
    } catch (err) {
        showToast('Error updating attendance record.', 'error');
    }
}

async function deleteAttendanceRecord(id) {
    if (!confirm('Are you sure you want to delete this attendance record?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/attendance/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            showToast('Attendance record deleted.');
            fetchMasterAttendanceLogs();
            loadDashboardSummary();
        } else {
            showToast(resData.message || 'Failed to delete record.', 'error');
        }
    } catch (err) {
        showToast('Error deleting record.', 'error');
    }
}

/**
 * 10. PENDING APPROVALS WORKFLOW
 */
async function fetchPendingFaculty() {
    const tbody = document.getElementById('pending-faculty-tbody');
    if (!tbody) return;

    try {
        const response = await fetch(`${API_BASE_URL}/pending-faculty`, { headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            const facultyList = resData.data;

            if (facultyList.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">No pending faculty registrations.</td></tr>`;
            } else {
                tbody.innerHTML = facultyList.map(f => `
                    <tr id="faculty-row-${f.id}">
                        <td><strong>${f.name}</strong></td>
                        <td>${f.email}</td>
                        <td>${f.phone || '-'}</td>
                        <td><span style="background: rgba(99,102,241,0.15); color: var(--accent-primary); padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 700;">${f.department_name || 'General'}</span></td>
                        <td>
                            <div style="display: flex; gap: 8px;">
                                <button class="btn btn-primary" style="padding: 4px 12px; font-size: 11px; background: var(--accent-emerald);" onclick="approveFaculty(${f.id}, this)">
                                    <i class="fa-solid fa-check"></i> Approve
                                </button>
                                <button class="btn btn-danger" style="padding: 4px 12px; font-size: 11px;" onclick="rejectFaculty(${f.id}, this)">
                                    <i class="fa-solid fa-xmark"></i> Reject
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            }
        }
    } catch (err) {
        console.error('Error fetching pending faculty:', err);
    }
}

async function approveFaculty(teacherId, btnElement) {
    if (!confirm('Are you sure you want to approve this faculty account?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/approve-faculty`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ teacher_id: teacherId })
        });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            showToast('Faculty account approved successfully!');
            const row = btnElement ? btnElement.closest('tr') : document.getElementById(`faculty-row-${teacherId}`);
            if (row) row.remove();
            fetchTeachers();
            loadDashboardSummary();
        } else {
            showToast(resData.message || 'Failed to approve faculty.', 'error');
        }
    } catch (err) {
        showToast('Error approving faculty account.', 'error');
    }
}

async function rejectFaculty(teacherId, btnElement) {
    if (!confirm('Are you sure you want to reject and remove this faculty application?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/reject-faculty/${teacherId}`, { method: 'DELETE', headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            showToast('Faculty application rejected.');
            const row = btnElement ? btnElement.closest('tr') : document.getElementById(`faculty-row-${teacherId}`);
            if (row) row.remove();
        } else {
            showToast(resData.message || 'Failed to reject faculty application.', 'error');
        }
    } catch (err) {
        showToast('Error rejecting faculty application.', 'error');
    }
}

async function fetchPendingApprovals() {
    const studentTableBody = document.getElementById('pending-approvals-tbody'); 
    
    if (!studentTableBody) return;

    try {
        const response = await fetch(`${API_BASE_URL}/pending-students`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        
        const result = await response.json();

        // Check if data is successful and is an array
        if (response.ok && (result.success || result.status === 'success') && Array.isArray(result.data)) {
            studentTableBody.innerHTML = ''; 
            
            if (result.data.length > 0) {
                result.data.forEach(student => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td><span style="background: rgba(99,102,241,0.15); color: var(--accent-primary); padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 700;">Student</span></td>
                        <td><strong>${student.enrollment_no || '-'}</strong></td>
                        <td>${student.name}</td>
                        <td>${student.email}</td>
                        <td>${new Date(student.created_at).toLocaleDateString()}</td>
                        <td>
                            <div style="display: flex; gap: 8px;">
                                <button class="btn btn-primary" style="padding: 4px 10px; font-size: 11px; background: var(--accent-emerald);" onclick="approveStudent(${student.id})">
                                    <i class="fa-solid fa-check"></i> Approve
                                </button>
                                <button class="btn btn-danger" style="padding: 4px 10px; font-size: 11px;" onclick="rejectStudent(${student.id})">
                                    <i class="fa-solid fa-xmark"></i> Reject
                                </button>
                            </div>
                        </td>
                    `;
                    studentTableBody.appendChild(row);
                });
            } else {
                studentTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No pending student registrations.</td></tr>';
            }
        } else {
            studentTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">${result.message || 'Error fetching pending students'}</td></tr>`;
        }
    } catch (error) {
        console.error("Error loading pending students:", error);
        studentTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Failed to connect to server.</td></tr>';
    }
}

async function approveStudent(studentId) {
    if (!confirm('Are you sure you want to approve this student?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/approve-student`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ student_id: studentId })
        });
        const resData = await response.json();

        if (response.ok && (resData.success || resData.status === 'success')) {
            showToast('Student approved successfully!');
            fetchPendingApprovals();
            fetchStudents();
            loadDashboardSummary();
        } else {
            showToast(resData.message || 'Failed to approve student.', 'error');
        }
    } catch (err) {
        showToast('Error approving student.', 'error');
    }
}

async function rejectStudent(studentId) {
    if (!confirm('Are you sure you want to reject and remove this pending student registration?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/reject-student/${studentId}`, { 
            method: 'DELETE', 
            headers: getAuthHeaders() 
        });
        const resData = await response.json();

        if (response.ok && (resData.success || resData.status === 'success')) {
            showToast('Student registration rejected.');
            fetchPendingApprovals();
        } else {
            showToast(resData.message || 'Failed to reject student.', 'error');
        }
    } catch (err) {
        showToast('Error rejecting student.', 'error');
    }
}


/**
 * 11. SYSTEM SETTINGS
 */
window.fetchSystemSettings = async function() {
    const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
    if (!token) {
        redirectToLogin();
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/system-settings`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const resData = await response.json().catch(() => null);

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                redirectToLogin();
                return;
            }
            throw new Error(resData?.message || `Server responded with status: ${response.status}`);
        }

        if (resData && resData.status === 'success' && resData.data) {
            const data = resData.data;
            document.getElementById('setting-college-name').value = data.college_name || '';
            document.getElementById('setting-academic-session').value = data.academic_session || '';
            document.getElementById('setting-qr-expiry').value = data.qr_expiry_seconds || 60;
        }
    } catch (err) {
        console.error('Fetch System Settings Error:', err);
        showToast('Unable to load current settings.', 'error');
    }
};

/**
 * 12. FORM SUBMIT LISTENERS
 */
function initFormSubmitListeners() {
    // Dept Form
    const deptForm = document.getElementById('create-dept-form');
    if (deptForm) {
        deptForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('dept-name').value;
            const code = document.getElementById('dept-code').value;

            try {
                const response = await fetch(`${API_BASE_URL}/departments`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ name, code })
                });
                const resData = await response.json();

                if (response.ok && resData.status === 'success') {
                    showToast('Department created successfully!');
                    deptForm.reset();
                    fetchDepartments();
                    loadDashboardSummary();
                } else {
                    showToast(resData.message || 'Failed to create department.', 'error');
                }
            } catch (err) {
                showToast('Error creating department.', 'error');
            }
        });
    }

    // Course Form
    const courseForm = document.getElementById('create-course-form');
    if (courseForm) {
        courseForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('course-name').value.trim();
            const code = document.getElementById('course-code').value.trim();
            const durationVal = document.getElementById('course-duration').value;
            const deptVal = document.getElementById('course-dept-select').value;

            try {
                const response = await fetch(`${API_BASE_URL}/courses`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ name, code, duration_years: Number(durationVal), department_id: Number(deptVal) })
                });
                const resData = await response.json();

                if (response.ok && resData.status === 'success') {
                    showToast('Course program created successfully!');
                    courseForm.reset();
                    fetchCourses();
                } else {
                    showToast(resData.message || 'Failed to create course.', 'error');
                }
            } catch (err) {
                showToast('Error creating course.', 'error');
            }
        });
    }

    // Subject Form
    const subjectForm = document.getElementById('create-subject-form');
    if (subjectForm) {
        subjectForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('subject-name').value;
            const code = document.getElementById('subject-code').value;
            const type = document.getElementById('subject-type').value;
            const course_id = document.getElementById('subject-course-select').value;
            const semester_id = document.getElementById('subject-semester-select').value;
            const department_id = document.getElementById('subject-dept-select').value;

            try {
                const response = await fetch(`${API_BASE_URL}/subjects`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ 
                        name, 
                        code, 
                        type, 
                        course_id: course_id || null, 
                        semester_id: semester_id || null, 
                        department_id: department_id || null 
                    })
                });
                const resData = await response.json();

                if (response.ok && resData.status === 'success') {
                    showToast('Subject created successfully!');
                    subjectForm.reset();
                    fetchSubjects();
                } else {
                    showToast(resData.message || 'Failed to create subject.', 'error');
                }
            } catch (err) {
                showToast('Error creating subject.', 'error');
            }
        });
    }

    // Teacher Form
    const teacherForm = document.getElementById('create-teacher-form');
    if (teacherForm) {
        teacherForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const employee_id = document.getElementById('teacher-emp-id').value;
            const name = document.getElementById('teacher-name').value;
            const email = document.getElementById('teacher-email').value;
            const password = document.getElementById('teacher-password').value;
            const phone = document.getElementById('teacher-phone').value;
            const department_id = document.getElementById('teacher-dept-select').value;

            try {
                const response = await fetch(`${API_BASE_URL}/teachers`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ employee_id, name, email, password, phone, department_id })
                });
                const resData = await response.json();

                if (response.ok && resData.status === 'success') {
                    showToast('Teacher account created successfully!');
                    teacherForm.reset();
                    fetchTeachers();
                    loadDashboardSummary();
                } else {
                    showToast(resData.message || 'Failed to create teacher.', 'error');
                }
            } catch (err) {
                showToast('Error creating teacher account.', 'error');
            }
        });
    }

    // Student Form
    const studentForm = document.getElementById('create-student-form');
    if (studentForm) {
        studentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const enrollment_no = document.getElementById('student-enrollment').value;
            const roll_no = document.getElementById('student-roll').value;
            const name = document.getElementById('student-name').value;
            const email = document.getElementById('student-email').value;
            const password = document.getElementById('student-password').value;
            const phone = document.getElementById('student-phone').value;

            try {
                const response = await fetch(`${API_BASE_URL}/students`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ enrollment_no, roll_no, name, email, password, phone })
                });
                const resData = await response.json();

                if (response.ok && resData.status === 'success') {
                    showToast('Student enrolled successfully!');
                    studentForm.reset();
                    fetchStudents();
                    loadDashboardSummary();
                } else {
                    showToast(resData.message || 'Failed to enroll student.', 'error');
                }
            } catch (err) {
                showToast('Error enrolling student.', 'error');
            }
        });
    }

    // Assign Class - Cascading Department Change Listener
    const assignDeptSelect = document.getElementById('assignDepartmentSelect');
    if (assignDeptSelect) {
        assignDeptSelect.addEventListener('change', async (e) => {
            const department_id = e.target.value;
            const facultySelect = document.getElementById('assignFacultySelect') || document.getElementById('assign-teacher-select');
            const subjectSelect = document.getElementById('assignSubjectSelect') || document.getElementById('assign-subject-select');

            if (!facultySelect || !subjectSelect) return;

            // 1. If no valid department selected, disable and reset dropdowns
            if (!department_id) {
                facultySelect.disabled = true;
                facultySelect.innerHTML = '<option value="">Select Department First</option>';
                subjectSelect.disabled = true;
                subjectSelect.innerHTML = '<option value="">Select Department First</option>';
                return;
            }

            // 2. Enable dropdowns and show loading state
            facultySelect.disabled = false;
            facultySelect.innerHTML = '<option value="">Loading faculty...</option>';
            subjectSelect.disabled = false;
            subjectSelect.innerHTML = '<option value="">Loading subjects...</option>';

            try {
                // 3. Concurrent fetch requests for faculty and subjects by department_id
                const [facultyRes, subjectRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/faculty/department/${department_id}`, { headers: getAuthHeaders() }),
                    fetch(`${API_BASE_URL}/subjects/department/${department_id}`, { headers: getAuthHeaders() })
                ]);

                const facultyData = await facultyRes.json();
                const subjectData = await subjectRes.json();

                // 4. Populate Faculty Dropdown
                if (facultyRes.ok && facultyData.status === 'success') {
                    const facultyList = facultyData.data;
                    if (facultyList.length === 0) {
                        facultySelect.innerHTML = '<option value="">No Active Faculty in this Department</option>';
                    } else {
                        facultySelect.innerHTML = '<option value="">Select Faculty Teacher *</option>' + 
                            facultyList.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
                    }
                } else {
                    facultySelect.innerHTML = '<option value="">Failed to load faculty</option>';
                }

                // 5. Populate Subject Dropdown
                if (subjectRes.ok && subjectData.status === 'success') {
                    const subjectList = subjectData.data;
                    if (subjectList.length === 0) {
                        subjectSelect.innerHTML = '<option value="">No Subjects in this Department</option>';
                    } else {
                        subjectSelect.innerHTML = '<option value="">Select Subject *</option>' + 
                            subjectList.map(s => `<option value="${s.id}">${s.name} (${s.code})</option>`).join('');
                    }
                } else {
                    subjectSelect.innerHTML = '<option value="">Failed to load subjects</option>';
                }
            } catch (err) {
                console.error('Error fetching cascading data:', err);
                facultySelect.innerHTML = '<option value="">Error loading faculty</option>';
                subjectSelect.innerHTML = '<option value="">Error loading subjects</option>';
            }
        });
    }

    // Assign Class Form
    const assignForm = document.getElementById('assign-class-form');
    if (assignForm) {
        assignForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const teacherSelect = document.getElementById('assignFacultySelect') || document.getElementById('assign-teacher-select');
            const subjectSelect = document.getElementById('assignSubjectSelect') || document.getElementById('assign-subject-select');
            const sectionSelect = document.getElementById('assign-section-select');

            const teacher_id = teacherSelect ? teacherSelect.value : '';
            const subject_id = subjectSelect ? subjectSelect.value : '';
            const section_id = sectionSelect ? sectionSelect.value : '';

            try {
                const response = await fetch(`${API_BASE_URL}/assign-class`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ teacher_id, subject_id, section_id: section_id || null })
                });
                const resData = await response.json();

                if (response.ok && resData.status === 'success') {
                    showToast('Class assigned to faculty successfully!');
                    assignForm.reset();
                    if (assignDeptSelect) {
                        assignDeptSelect.dispatchEvent(new Event('change'));
                    }
                    fetchAssignedClasses();
                } else {
                    showToast(resData.message || 'Failed to assign class.', 'error');
                }
            } catch (err) {
                showToast('Error assigning class mapping.', 'error');
            }
        });
    }

    // Student Registry - Department Filter Event Listener
    const studentDeptFilter = document.getElementById('student-dept-filter');
    if (studentDeptFilter) {
        studentDeptFilter.addEventListener('change', (e) => {
            fetchStudents(e.target.value);
        });
    }

    // System Settings Form
    const settingsForm = document.getElementById('system-settings-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
            if (!token) {
                showToast('Authentication error. Please log in again.', 'error');
                setTimeout(redirectToLogin, 1500);
                return;
            }

            const college_name = document.getElementById('setting-college-name').value;
            const academic_session = document.getElementById('setting-academic-session').value;
            const qr_expiry_seconds = document.getElementById('setting-qr-expiry').value;

            try {
                const response = await fetch(`${API_BASE_URL}/system-settings`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ college_name, academic_session, qr_expiry_seconds: Number(qr_expiry_seconds) })
                });
                
                const resData = await response.json().catch(() => null);

                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        showToast('Session expired. Please log in again.', 'error');
                        setTimeout(redirectToLogin, 1500);
                        return;
                    }
                    throw new Error(resData?.message || `Server responded with status: ${response.status}`);
                }

                if (resData && resData.status === 'success') {
                    showToast('System settings saved successfully!');
                } else {
                    showToast(resData?.message || 'Failed to save settings.', 'error');
                }
            } catch (err) {
                console.error('Save System Settings Error:', err);
                showToast('Unable to save settings. Please try again later.', 'error');
            }
        });
    }

    // Edit Teacher Form
    const editTeacherForm = document.getElementById('edit-teacher-form');
    if (editTeacherForm) {
        editTeacherForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-teacher-id').value;
            const employee_id = document.getElementById('edit-teacher-emp-id').value;
            const name = document.getElementById('edit-teacher-name').value;
            const email = document.getElementById('edit-teacher-email').value;
            const phone = document.getElementById('edit-teacher-phone').value;
            const department_id = document.getElementById('edit-teacher-dept-select').value;
            const status = document.getElementById('edit-teacher-status').value;

            try {
                const response = await fetch(`${API_BASE_URL}/teachers/${id}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ employee_id, name, email, phone, department_id, status })
                });
                const resData = await response.json();

                if (response.ok && resData.status === 'success') {
                    showToast('Faculty details updated successfully!');
                    closeEditTeacherModal();
                    fetchTeachers();
                } else {
                    showToast(resData.message || 'Failed to update faculty details.', 'error');
                }
            } catch (err) {
                showToast('Error updating faculty details.', 'error');
            }
        });
    }

    // Edit Student Form
    const editStudentForm = document.getElementById('edit-student-form');
    if (editStudentForm) {
        editStudentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-student-id').value;
            const enrollment_no = document.getElementById('edit-student-enrollment').value;
            const roll_no = document.getElementById('edit-student-roll').value;
            const name = document.getElementById('edit-student-name').value;
            const email = document.getElementById('edit-student-email').value;
            const phone = document.getElementById('edit-student-phone').value;
            const status = document.getElementById('edit-student-status').value;

            try {
                const response = await fetch(`${API_BASE_URL}/students/${id}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ enrollment_no, roll_no, name, email, phone, status })
                });
                const resData = await response.json();

                if (response.ok && resData.status === 'success') {
                    showToast('Student details updated successfully!');
                    closeEditStudentModal();
                    fetchStudents();
                } else {
                    showToast(resData.message || 'Failed to update student details.', 'error');
                }
            } catch (err) {
                showToast('Error updating student details.', 'error');
            }
        });
    }

    // Edit Course Form
    const editCourseForm = document.getElementById('edit-course-form');
    if (editCourseForm) {
        editCourseForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-course-id').value;
            const name = document.getElementById('edit-course-name').value;
            const code = document.getElementById('edit-course-code').value;
            const department_id = document.getElementById('edit-course-dept-select').value;
            const duration_years = document.getElementById('edit-course-duration').value;

            try {
                const response = await fetch(`${API_BASE_URL}/courses/${id}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ name, code, department_id, duration_years })
                });
                const resData = await response.json();

                if (response.ok && resData.status === 'success') {
                    showToast('Course program updated successfully!');
                    closeEditCourseModal();
                    fetchCourses();
                } else {
                    showToast(resData.message || 'Failed to update course program.', 'error');
                }
            } catch (err) {
                showToast('Error updating course program.', 'error');
            }
        });
    }
}

async function fetchLeaveRequests() {
    const tbody = document.getElementById('admin-leaves-tbody');
    if (!tbody) return;

    try {
        const response = await fetch(`${API_BASE_URL}/leaves`, { headers: getAuthHeaders() });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            const leaves = resData.data;

            if (leaves.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 18px;">No leave requests found.</td></tr>`;
            } else {
                tbody.innerHTML = leaves.map(l => {
                    const start = new Date(l.start_date).toLocaleDateString();
                    const end = new Date(l.end_date).toLocaleDateString();
                    let badgeStyle = 'background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3);';
                    if (l.status === 'Approved') badgeStyle = 'background: rgba(16, 185, 129, 0.15); color: var(--accent-emerald); border: 1px solid rgba(16, 185, 129, 0.3);';
                    if (l.status === 'Rejected') badgeStyle = 'background: rgba(244, 63, 94, 0.15); color: var(--accent-rose); border: 1px solid rgba(244, 63, 94, 0.3);';

                    return `
                        <tr>
                            <td><strong>${l.student_name}</strong><div style="font-size: 11px; color: var(--text-muted);">${l.email}</div></td>
                            <td>${l.enrollment_no}<div style="font-size: 11px; color: var(--accent-primary); font-weight: 700;">${l.course_name || '-'}</div></td>
                            <td><strong>${start}</strong> to <strong>${end}</strong></td>
                            <td style="max-width: 220px; word-break: break-word;">${l.reason}</td>
                            <td><span style="${badgeStyle} padding: 4px 10px; border-radius: 12px; font-weight: 700; font-size: 11px;">${l.status}</span></td>
                            <td>
                                ${l.status === 'Pending' ? `
                                    <div style="display: flex; gap: 6px;">
                                        <button class="btn btn-primary" style="padding: 4px 8px; font-size: 11px; background: var(--accent-emerald);" onclick="updateLeaveStatus(${l.id}, 'Approved')">
                                            <i class="fa-solid fa-check"></i> Approve
                                        </button>
                                        <button class="btn btn-danger" style="padding: 4px 8px; font-size: 11px;" onclick="updateLeaveStatus(${l.id}, 'Rejected')">
                                            <i class="fa-solid fa-xmark"></i> Reject
                                        </button>
                                    </div>
                                ` : `<span style="font-size: 11px; color: var(--text-muted);">${l.admin_remark || 'Reviewed'}</span>`}
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }
    } catch (err) {
        console.error('Error fetching leave requests:', err);
    }
}

async function updateLeaveStatus(id, status) {
    const remark = prompt(`Enter admin remark for ${status.toLowerCase()} leave request (optional):`);
    try {
        const response = await fetch(`${API_BASE_URL}/leaves/${id}/status`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status, admin_remark: remark })
        });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            showToast(`Leave request ${status.toLowerCase()}!`);
            fetchLeaveRequests();
        } else {
            showToast(resData.message || 'Failed to update leave status.', 'error');
        }
    } catch (err) {
        showToast('Error updating leave status.', 'error');
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
