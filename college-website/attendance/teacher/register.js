/**
 * Smart QR Attendance System - Faculty Registration Logic
 */

const HOST_IP = (window.location.hostname && window.location.hostname !== '') ? window.location.hostname : 'localhost';
const AUTH_API_URL = `http://${HOST_IP}:5000/api/auth`;

window.onload = async () => {
    await fetchDepartments();
    initRegistrationForm();
};

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
