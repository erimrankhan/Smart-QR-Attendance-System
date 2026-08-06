/**
 * Smart QR Attendance System - Shared Utility Functions (Toasts, Modals, Loading Overlay)
 */

// Initialize UI Container Elements on Load
document.addEventListener('DOMContentLoaded', () => {
    ensureGlobalContainers();
});

function ensureGlobalContainers() {
    // 1. Toast Container
    if (!document.getElementById('toast-container')) {
        const toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    // 2. Global Loader Overlay
    if (!document.getElementById('global-loader')) {
        const loader = document.createElement('div');
        loader.id = 'global-loader';
        loader.innerHTML = `
            <div class="spinner"></div>
            <div class="loader-text" id="global-loader-text">Processing request...</div>
        `;
        document.body.appendChild(loader);
    }

    // 3. Global Modal Dialog
    if (!document.getElementById('global-modal')) {
        const modal = document.createElement('div');
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
 * Show Full-Page Loading Spinner
 */
function showLoading(message = 'Processing request...') {
    ensureGlobalContainers();
    const loader = document.getElementById('global-loader');
    const loaderText = document.getElementById('global-loader-text');
    if (loaderText) loaderText.textContent = message;
    if (loader) loader.classList.add('active');
}

/**
 * Hide Full-Page Loading Spinner
 */
function hideLoading() {
    const loader = document.getElementById('global-loader');
    if (loader) loader.classList.remove('active');
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

    modal.classList.add('active');

    const closeModal = () => {
        modal.classList.remove('active');
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
    };

    cancelBtn.onclick = closeModal;

    confirmBtn.onclick = () => {
        closeModal();
        if (typeof onConfirm === 'function') {
            onConfirm();
        }
    };
}
