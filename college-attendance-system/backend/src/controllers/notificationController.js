const pool = require('../config/db');

/**
 * Fetch Unread Notifications for Logged-In User
 * GET /api/notifications
 */
exports.getNotifications = async (req, res) => {
    const user_id = req.user.id;
    const user_role = req.user.role;

    try {
  const [notifications] = await pool.query(
            `SELECT id, COALESCE(title, 'Notification') AS title, message, is_read, created_at 
             FROM Notifications 
             WHERE (user_id = ? AND user_role = ?) OR (user_id = ? AND ? = 'Student') 
             ORDER BY id DESC LIMIT 10`,
            [user_id, user_role, user_id, user_role]
        );
        const unreadCount = notifications.filter(n => n.is_read === 0 || !n.is_read).length;

        res.status(200).json({
            status: 'success',
            data: {
                unreadCount,
                notifications
            }
        });
    } catch (error) {
        console.error('Get Notifications Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching notifications.' });
    }
};

/**
 * Mark Notification as Read
 * PUT /api/notifications/:id/read
 */
exports.markAsRead = async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;

    try {
        await pool.query(
            'UPDATE Notifications SET is_read = 1 WHERE id = ? AND (user_id = ? OR student_id = ?)',
            [id, user_id, user_id]
        );

        res.status(200).json({
            status: 'success',
            message: 'Notification marked as read.'
        });
    } catch (error) {
        console.error('Mark Notification Read Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while updating notification.' });
    }
};

/**
 * Mark All Notifications as Read for Logged-In User
 * PUT /api/notifications/read-all
 */
exports.markAllAsRead = async (req, res) => {
    const user_id = req.user.id;
    const user_role = req.user.role;

    try {
        await pool.query(
            `UPDATE Notifications SET is_read = 1 
             WHERE (user_id = ? AND user_role = ?) OR (student_id = ? AND ? = 'Student')`,
            [user_id, user_role, user_id, user_role]
        );

        res.status(200).json({
            status: 'success',
            message: 'All notifications marked as read.'
        });
    } catch (error) {
        console.error('Mark All Notifications Read Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while updating notifications.' });
    }
};

