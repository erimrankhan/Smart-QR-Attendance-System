/**
 * Smart QR Attendance System - Universal Notification Engine & Real-Time Poller
 */

(function () {
    // Production Cloud Backend Fallback Configuration
    const PRODUCTION_BACKEND_URL = "https://smart-qr-attendance-system-8qzs.onrender.com/"; // Apna Render Backend URL yahan replace karein

    const isLocalEnv = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const BASE_SERVER_URL = window.API_BASE_URL || (isLocalEnv ? `http://${window.location.hostname}:5000` : PRODUCTION_BACKEND_URL);

    const NOTIFICATION_API = `${BASE_SERVER_URL}/api/notifications`;

    let shownNotifIds = new Set();
    let isFirstFetch = true;
    let isToggling = false;

    function getUserToken() {
        return localStorage.getItem('adminToken') || localStorage.getItem('teacherToken') || localStorage.getItem('studentToken') || localStorage.getItem('token');
    }

    document.addEventListener('DOMContentLoaded', () => {
        initNotifications();
    });

    /**
     * Initialize Notification Poller & Event Listeners
     */
    function initNotifications() {
        const token = getUserToken();
        if (!token) return;

        // Fetch immediately
        fetchUnreadNotifications();

        // Poll every 10 seconds for real-time responsiveness
        setInterval(() => {
            fetchUnreadNotifications();
        }, 10000);

        // Backdrop / External click to close modal
        document.addEventListener('click', (e) => {
            const modal = document.getElementById('systemNotificationModal');
            if (!modal) return;

            if (modal.style.display === 'flex' || modal.style.display === 'block') {
                const container = modal.querySelector('.modal-container');
                const bellBtn = document.getElementById('notification-bell');

                if (container && !container.contains(e.target) && bellBtn && !bellBtn.contains(e.target)) {
                    modal.style.display = 'none';
                }
            }
        });
    }

    /**
     * Fetch Notifications from Backend API
     */
    async function fetchUnreadNotifications() {
        const token = getUserToken();
        if (!token) return;

        const badgeEl = document.getElementById('notif-badge');
        const modalBody = document.getElementById('systemNotifModalBody');

        try {
            const response = await fetch(NOTIFICATION_API, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) return;
            const resData = await response.json();

            if (resData.status === 'success' && resData.data) {
                const { unreadCount, notifications } = resData.data;

                // Update Badge Count
                if (badgeEl) {
                    if (unreadCount > 0) {
                        badgeEl.textContent = unreadCount > 9 ? '9+' : unreadCount;
                        badgeEl.style.display = 'inline-flex';
                    } else {
                        badgeEl.style.display = 'none';
                    }
                }

                // Check for new notifications to trigger popup
                if (notifications && notifications.length > 0) {
                    notifications.forEach(n => {
                        if (!n.is_read && !shownNotifIds.has(n.id)) {
                            shownNotifIds.add(n.id);

                            // Trigger floating popup for newly arrived notifications after initial fetch
                            if (!isFirstFetch) {
                                showNotificationPopup(n);
                            }
                        }
                    });
                }

                isFirstFetch = false;

                // Render Modal Body content if present
                if (modalBody) {
                    renderNotificationModalContent(modalBody, notifications);
                }
            }
        } catch (err) {
            console.error('Error fetching notifications:', err);
        }
    }

    /**
     * Render Notification Items inside Modal Window
     */
    function renderNotificationModalContent(container, notifications) {
        if (!notifications || notifications.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); padding: 32px 16px;">
                    <i class="fa-solid fa-bell-slash" style="font-size: 32px; margin-bottom: 12px; opacity: 0.5;"></i>
                    <div style="font-size: 14px; font-weight: 600;">No Notifications</div>
                    <div style="font-size: 12px; margin-top: 4px;">You're all caught up!</div>
                </div>
            `;
            return;
        }

        container.innerHTML = notifications.map(n => {
            const timeStr = new Date(n.created_at).toLocaleString();
            let borderStyle = 'border-left: 4px solid var(--accent-indigo); background: rgba(99, 102, 241, 0.08);';
            let iconClass = 'fa-solid fa-circle-info';
            let iconColor = 'var(--accent-indigo)';

            if (n.type === 'warning' || n.type === 'alert') {
                borderStyle = 'border-left: 4px solid var(--accent-amber); background: rgba(245, 158, 11, 0.08);';
                iconClass = 'fa-solid fa-triangle-exclamation';
                iconColor = 'var(--accent-amber)';
            } else if (n.type === 'success' || n.type === 'urgent') {
                borderStyle = 'border-left: 4px solid var(--accent-emerald); background: rgba(16, 185, 129, 0.08);';
                iconClass = 'fa-solid fa-circle-check';
                iconColor = 'var(--accent-emerald)';
            } else if (n.type === 'danger' || n.type === 'error') {
                borderStyle = 'border-left: 4px solid var(--accent-rose); background: rgba(244, 63, 94, 0.08);';
                iconClass = 'fa-solid fa-circle-exclamation';
                iconColor = 'var(--accent-rose)';
            }

            return `
                <div style="padding: 14px 16px; border: 1px solid var(--glass-border); border-radius: var(--radius-md); ${borderStyle} display: flex; flex-direction: column; gap: 6px; position: relative;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                        <span style="font-size: 13.5px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                            <i class="${iconClass}" style="color: ${iconColor};"></i> ${n.title || 'System Notification'}
                        </span>
                        ${!n.is_read ? `
                            <button onclick="markNotificationRead(${n.id})" title="Mark as read" style="background: none; border: none; color: var(--accent-teal); cursor: pointer; font-size: 11.5px; font-weight: 700;">
                                <i class="fa-solid fa-check"></i> Mark Read
                            </button>
                        ` : '<span style="font-size: 10.5px; color: var(--text-muted); font-weight: 600;">Read</span>'}
                    </div>
                    <div style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.4; word-break: break-word;">${n.message}</div>
                    <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 2px;"><i class="fa-solid fa-clock"></i> ${timeStr}</div>
                </div>
            `;
        }).join('');
    }

    /**
     * Display Floating Toast Popup when a live notification arrives
     */
    function showNotificationPopup(n) {
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 100000; display: flex; flex-direction: column; gap: 10px; max-width: 380px; width: 90%; pointer-events: none;';
            document.body.appendChild(toastContainer);
        }

        const popup = document.createElement('div');
        popup.style.cssText = `
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(13, 148, 136, 0.4);
            border-left: 5px solid var(--accent-teal);
            border-radius: 14px;
            padding: 14px 16px;
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
            pointer-events: auto;
            animation: slideInRight 0.35s ease forwards;
            display: flex;
            flex-direction: column;
            gap: 6px;
            cursor: pointer;
        `;

        popup.onclick = (e) => {
            if (e && e.stopPropagation) e.stopPropagation();
            toggleSystemNotificationModal(true);
            popup.remove();
        };

        popup.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 13px; font-weight: 800; color: #f8fafc; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-bell" style="color: var(--accent-teal);"></i> ${n.title || 'New Notification'}
                </span>
                <span style="font-size: 10px; color: var(--text-muted);">${new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4;">${n.message}</div>
            <div style="font-size: 10.5px; color: var(--accent-teal); font-weight: 700; text-align: right;">Click to view notifications</div>
        `;

        toastContainer.appendChild(popup);

        // Auto remove popup after 7 seconds
        setTimeout(() => {
            if (popup.parentNode) {
                popup.style.opacity = '0';
                popup.style.transition = 'opacity 0.4s ease';
                setTimeout(() => popup.remove(), 400);
            }
        }, 7000);
    }

    /**
     * Debounced & Safe Toggle Notification Modal
     */
    function toggleSystemNotificationModal(e) {
        if (e && e.stopPropagation) e.stopPropagation();

        if (isToggling) return;
        isToggling = true;
        setTimeout(() => { isToggling = false; }, 200);

        const modal = document.getElementById('systemNotificationModal');
        if (!modal) return;

        let forceOpen = false;
        if (typeof e === 'boolean') {
            forceOpen = e;
        }

        const isCurrentlyVisible = (modal.style.display === 'flex' || modal.style.display === 'block');

        if (forceOpen || !isCurrentlyVisible) {
            modal.style.display = 'flex';
            fetchUnreadNotifications();
        } else {
            modal.style.display = 'none';
        }
    }

    /**
     * Mark single notification as read
     */
    async function markNotificationRead(id) {
        const token = getUserToken();
        if (!token) return;

        try {
            await fetch(`${NOTIFICATION_API}/${id}/read`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchUnreadNotifications();
        } catch (err) {
            console.error('Error marking notification read:', err);
        }
    }

    /**
     * Mark all notifications as read
     */
    async function markAllNotificationsRead() {
        const token = getUserToken();
        if (!token) return;

        try {
            await fetch(`${NOTIFICATION_API}/read-all`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchUnreadNotifications();
        } catch (err) {
            console.error('Error marking all read:', err);
        }
    }

    // Export functions globally
    window.toggleSystemNotificationModal = toggleSystemNotificationModal;
    window.markNotificationRead = markNotificationRead;
    window.markAllNotificationsRead = markAllNotificationsRead;
    window.fetchUnreadNotifications = fetchUnreadNotifications;
})();