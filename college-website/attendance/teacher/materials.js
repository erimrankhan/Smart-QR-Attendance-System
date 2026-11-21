/**
 * Smart QR Attendance System - Faculty Material Upload Logic
 */

// Localhost Backend Configuration
// Auto-detect Localhost vs Live Render URL
window.BACKEND_API_URL = window.API_BASE_URL || 
    (window.location.protocol.startsWith('http') 
        ? window.location.origin 
        : "http://localhost:5000");

var BASE_SERVER_URL = window.BACKEND_API_URL;
var SERVER_URL = BASE_SERVER_URL;
var API_BASE_URL = `${SERVER_URL}/api`;

// Utility helper to get JWT Authorization headers
function getAuthHeaders() {
    const token = localStorage.getItem('teacherToken') || localStorage.getItem('token') || localStorage.getItem('authToken');
    return {
        'Authorization': `Bearer ${token}`
    };
}

// Utility Toast Notification helper
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) {
        alert(message);
        return;
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        padding: 12px 20px;
        margin-top: 10px;
        border-radius: 8px;
        color: #fff;
        font-weight: 600;
        font-size: 13px;
        background: ${type === 'success' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)'};
        backdrop-filter: blur(10px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transition: all 0.3s ease;
    `;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

document.addEventListener('DOMContentLoaded', async () => {
    const courseSelect = document.getElementById('material-course-select');
    const semesterSelect = document.getElementById('material-semester-select');
    const subjectSelect = document.getElementById('material-subject-select');
    const uploadForm = document.getElementById('material-upload-form');

    // 1. Initial Load: Fetch All Courses for Course Dropdown
    async function loadCourses() {
        if (!courseSelect) return;
        try {
            // Fetch courses belonging to teacher's specific department
            let res = await fetch(`${SERVER_URL}/api/teacher/my-courses`, { headers: getAuthHeaders() });
            if (!res.ok) {
                res = await fetch(`${API_BASE_URL}/materials/courses`, { headers: getAuthHeaders() });
            }
            const resData = await res.json();

            if (res.ok && resData.status === 'success') {
                const courses = resData.data;
                if (courses.length === 0) {
                    courseSelect.innerHTML = '<option value="">No department courses available</option>';
                } else {
                    courseSelect.innerHTML = '<option value="">Select Course *</option>' +
                        courses.map(c => `<option value="${c.id}">${c.name} (${c.code})</option>`).join('');
                }
            } else {
                courseSelect.innerHTML = '<option value="">Failed to load courses</option>';
            }
        } catch (err) {
            console.error('Error fetching courses:', err);
            courseSelect.innerHTML = '<option value="">Error loading courses</option>';
        }
    }

    await loadCourses();

    // 2. Cascading Event 1: Course Change -> Fetch Semesters for selected Course
    if (courseSelect) {
        courseSelect.addEventListener('change', async (e) => {
            const courseId = e.target.value;

            // Reset Semester & Subject dropdowns if course deselected
            if (!courseId) {
                semesterSelect.disabled = true;
                semesterSelect.innerHTML = '<option value="">Select Course First</option>';
                subjectSelect.disabled = true;
                subjectSelect.innerHTML = '<option value="">Select Semester First</option>';
                return;
            }

            // Enable Semester Dropdown & Show Loading State
            semesterSelect.disabled = false;
            semesterSelect.innerHTML = '<option value="">Loading semesters...</option>';
            subjectSelect.disabled = true;
            subjectSelect.innerHTML = '<option value="">Select Semester First</option>';

            try {
                const res = await fetch(`${API_BASE_URL}/materials/semesters/${courseId}`, { headers: getAuthHeaders() });
                const resData = await res.json();

                if (res.ok && resData.status === 'success') {
                    const semesters = resData.data;
                    if (semesters.length === 0) {
                        semesterSelect.innerHTML = '<option value="">No semesters found for course</option>';
                    } else {
                        semesterSelect.innerHTML = '<option value="">Select Semester *</option>' +
                            semesters.map(s => `<option value="${s.id}">Semester ${s.semester_number}</option>`).join('');
                    }
                } else {
                    semesterSelect.innerHTML = '<option value="">Failed to load semesters</option>';
                }
            } catch (err) {
                console.error('Error fetching semesters:', err);
                semesterSelect.innerHTML = '<option value="">Error loading semesters</option>';
            }
        });
    }

    // 3. Cascading Event 2: Semester Change -> Fetch Subjects for selected Course & Semester
    if (semesterSelect) {
        semesterSelect.addEventListener('change', async (e) => {
            const courseId = courseSelect.value;
            const semesterId = e.target.value;

            if (!semesterId || !courseId) {
                subjectSelect.disabled = true;
                subjectSelect.innerHTML = '<option value="">Select Semester First</option>';
                return;
            }

            // Enable Subject Dropdown & Show Loading State
            subjectSelect.disabled = false;
            subjectSelect.innerHTML = '<option value="">Loading subjects...</option>';

            try {
                const res = await fetch(`${API_BASE_URL}/materials/subjects/${courseId}/${semesterId}`, { headers: getAuthHeaders() });
                const resData = await res.json();

                if (res.ok && resData.status === 'success') {
                    const subjects = resData.data;
                    if (subjects.length === 0) {
                        subjectSelect.innerHTML = '<option value="">No subjects mapped for this term</option>';
                    } else {
                        subjectSelect.innerHTML = '<option value="">Select Subject *</option>' +
                            subjects.map(sub => `<option value="${sub.id}">${sub.name} (${sub.code})</option>`).join('');
                    }
                } else {
                    subjectSelect.innerHTML = '<option value="">Failed to load subjects</option>';
                }
            } catch (err) {
                console.error('Error fetching subjects:', err);
                subjectSelect.innerHTML = '<option value="">Error loading subjects</option>';
            }
        });
    }

    // 4. Form Submission: Submit FormData containing file & dropdown selections
    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const titleInput = document.getElementById('material-title');
            const fileInput = document.getElementById('material-file-input');
            const submitBtn = document.getElementById('upload-submit-btn');

            const title = titleInput.value.trim();
            const course_id = courseSelect.value;
            const semester_id = semesterSelect.value;
            const subject_id = subjectSelect.value;
            const file = fileInput.files[0];

            if (!title || !course_id || !semester_id || !subject_id || !file) {
                showToast('Please fill in all required fields and attach a file.', 'error');
                return;
            }

            // Create multipart/form-data payload
            const formData = new FormData();
            formData.append('title', title);
            formData.append('course_id', course_id);
            formData.append('semester_id', semester_id);
            formData.append('subject_id', subject_id);
            formData.append('file', file);

            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';

                const response = await fetch(`${API_BASE_URL}/materials/upload`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: formData
                });

                const resData = await response.json();

                if (response.ok && resData.status === 'success') {
                    showToast('Study material uploaded successfully!', 'success');
                    uploadForm.reset();
                    semesterSelect.disabled = true;
                    semesterSelect.innerHTML = '<option value="">Select Course First</option>';
                    subjectSelect.disabled = true;
                    subjectSelect.innerHTML = '<option value="">Select Semester First</option>';
                } else {
                    showToast(resData.message || 'Failed to upload study material.', 'error');
                }
            } catch (err) {
                console.error('Upload Submission Error:', err);
                showToast('Error connecting to backend server during file upload.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Upload & Share Material';
            }
        });
    }
});