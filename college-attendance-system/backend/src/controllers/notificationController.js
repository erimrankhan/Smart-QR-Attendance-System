const pool = require('../config/db');

/**
 * Fetch Unread Notifications for Logged-In User
 * GET /api/notifications
 */
exports.getNotifications = async (req, res) => {
    const user_id = req.user.id;
    const user_role = req.user.role;

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    try {
        let notifications = [];
        if (user_role === 'Student') {
            const [announcements] = await pool.query(`
                SELECT a.id, a.title, a.message, a.type, 
                       COALESCE(a.type, 'info') AS priority, 
                       a.created_at, 0 AS is_read,
                       t.name AS faculty_name,
                       s.name AS subject_name
                FROM Announcements a
                LEFT JOIN Classes c ON a.class_id = c.id
                LEFT JOIN Teachers t ON a.teacher_id = t.id
                LEFT JOIN Subjects s ON c.subject_id = s.id
                WHERE (
                    a.class_id IN (
                        SELECT id FROM Classes 
                        WHERE section_id = (SELECT section_id FROM Students WHERE id = ?)
                           OR section_id IS NULL
                           OR subject_id IN (SELECT id FROM Subjects WHERE course_id = (SELECT course_id FROM Students WHERE id = ?))
                    )
                    OR a.class_id IS NULL
                )
                ORDER BY a.created_at DESC
                LIMIT 15
            `, [user_id, user_id]);

            const [systemNotifs] = await pool.query(`
                SELECT id, COALESCE(title, 'System Alert') AS title, message, is_read, created_at, type
                FROM Notifications 
                WHERE student_id = ? OR (user_id = ? AND user_role = 'Student')
                ORDER BY id DESC LIMIT 10
            `, [user_id, user_id]);

            notifications = [...announcements, ...systemNotifs].sort(
                (a, b) => new Date(b.created_at) - new Date(a.created_at)
            );
        } else {
            const [rows] = await pool.query(
                `SELECT id, COALESCE(title, 'Notification') AS title, message, is_read, created_at, type 
                 FROM Notifications 
                 WHERE user_id = ? AND user_role = ? 
                 ORDER BY id DESC LIMIT 15`,
                [user_id, user_role]
            );
            notifications = rows;
        }

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

