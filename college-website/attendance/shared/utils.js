/**
 * Smart QR Attendance System - Shared Utility Functions (Toasts, Modals, Loading Overlay)
 */

// 1. Apna Live Render Backend URL yahan paste karein:
const PRODUCTION_BACKEND_URL = "https://smart-qr-attendance-system-8qzs.onrender.com"; 

// 2. Smart Environment Detection (Local vs Production)
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

window.API_BASE_URL = isLocal ? `http://${window.location.hostname}:5000` : PRODUCTION_BACKEND_URL;
window.SERVER_URL = window.API_BASE_URL;

// Base Endpoints for all Portals
window.ADMIN_API_BASE_URL = `${window.API_BASE_URL}/api/admin`;
window.TEACHER_API_BASE_URL = `${window.API_BASE_URL}/api/teacher`;
window.STUDENT_API_BASE_URL = `${window.API_BASE_URL}/api/student`;

let loaderSafetyTimeout = null;

// Initialize UI Container Elements on Load
document.addEventListener('DOMContentLoaded', () => {
    ensureGlobalContainers();
    // Safety check: always dismiss any hung loaders or overlays immediately on initial page load
    hideLoading();
    dismissHungOverlays();
});

function ensureGlobalContainers() {
    // 1. Toast Container
    if (!document.getElementById('toast-container')) {
        const toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    // 2. Global Loader Overlay
    let loader = document.getElementById('global-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'global-loader';
        loader.innerHTML = `
            <div class="spinner"></div>
            <div class="loader-text" id="global-loader-text">Processing request...</div>
        `;
        document.body.appendChild(loader);
    }
    // Ensure loader defaults to hidden and does not capture pointer events
    if (!loader.classList.contains('active')) {
        loader.style.display = 'none';
        loader.style.pointerEvents = 'none';
    }

    // 3. Global Modal Dialog
    let modal = document.getElementById('global-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'global-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="global-modal-title">Confirm Action</h3>
                </div>
                <div class="modal-body" id="global-modal-body">
                    Are you sure you want to proceed with this operation?
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" id="global-modal-cancel">Cancel</button>
                    <button class="btn btn-danger" id="global-modal-confirm">Confirm</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    if (!modal.classList.contains('active')) {
        modal.style.display = 'none';
        modal.style.pointerEvents = 'none';
    }
}

/**
 * Dismiss any hung modal or backdrop overlays that might block interaction
 */
function dismissHungOverlays() {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.classList.remove('active');
        loader.style.display = 'none';
        loader.style.pointerEvents = 'none';
    }

    const globalModal = document.getElementById('global-modal');
    if (globalModal && !globalModal.classList.contains('active')) {
        globalModal.style.display = 'none';
        globalModal.style.pointerEvents = 'none';
    }
}

/**
 * Trigger Sliding Toast Notification
 * @param {string} message - Message text to display
 * @param {string} type - 'success' | 'error' | 'warning' | 'info'
 * @param {number} duration - Auto dismiss time in milliseconds
 */
function showToast(message, type = 'success', duration = 4000) {
    ensureGlobalContainers();
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-exclamation';
    if (type === 'warning') icon = 'fa-triangle-exclamation';
    if (type === 'info') icon = 'fa-circle-info';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Show Full-Page Loading Spinner (with Auto-Dismiss Safety Guard)
 */
function showLoading(message = 'Processing request...') {
    ensureGlobalContainers();
    const loader = document.getElementById('global-loader');
    const loaderText = document.getElementById('global-loader-text');
    if (loaderText) loaderText.textContent = message;
    if (loader) {
        loader.style.display = 'flex';
        loader.style.pointerEvents = 'auto';
        loader.classList.add('active');
    }

    // Safety timeout: Auto-dismiss after 10s if network hangs to prevent permanent UI lock
    clearTimeout(loaderSafetyTimeout);
    loaderSafetyTimeout = setTimeout(() => {
        hideLoading();
    }, 10000);
}

/**
 * Hide Full-Page Loading Spinner
 */
function hideLoading() {
    clearTimeout(loaderSafetyTimeout);
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.classList.remove('active');
        loader.style.display = 'none';
        loader.style.pointerEvents = 'none';
    }
}

/**
 * Show Reusable Confirmation Modal
 */
function showConfirmModal(title, message, onConfirm, confirmText = 'Confirm', confirmBtnClass = 'btn-danger') {
    ensureGlobalContainers();
    const modal = document.getElementById('global-modal');
    const titleEl = document.getElementById('global-modal-title');
    const bodyEl = document.getElementById('global-modal-body');
    const cancelBtn = document.getElementById('global-modal-cancel');
    const confirmBtn = document.getElementById('global-modal-confirm');

    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.textContent = message;
    if (confirmBtn) {
        confirmBtn.textContent = confirmText;
        confirmBtn.className = `btn ${confirmBtnClass}`;
    }

    if (modal) {
        modal.style.display = 'flex';
        modal.style.pointerEvents = 'auto';
        modal.classList.add('active');
    }

    const closeModal = () => {
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
            modal.style.pointerEvents = 'none';
        }
        if (confirmBtn) confirmBtn.onclick = null;
        if (cancelBtn) cancelBtn.onclick = null;
    };

    if (cancelBtn) cancelBtn.onclick = closeModal;

    if (confirmBtn) {
        confirmBtn.onclick = () => {
            closeModal();
            if (typeof onConfirm === 'function') {
                onConfirm();
            }
        };
    }
}