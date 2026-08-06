const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const studentController = require('../controllers/studentController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

// Ensure Uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads/profiles');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Disk Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'student-' + req.user.id + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB Limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files (JPG, PNG, WEBP) are allowed.'));
        }
    }
});

// Protect all routes with JWT verification and strict Student role authorization
router.use(verifyToken);
router.use(authorizeRoles('Student'));

// Module 1: Dashboard & Core
router.get('/dashboard-summary', studentController.getDashboardSummary);
router.get('/dashboard-stats', studentController.getDashboardSummary); // Backward compatibility

// Module 2: Attendance Engine & Analytics
router.post('/mark-attendance', studentController.markAttendance);
router.get('/attendance-history', studentController.getAttendanceHistory);
router.get('/attendance-analytics', studentController.getAttendanceAnalytics);
router.get('/subject-attendance', studentController.getAttendanceAnalytics); // Backward compatibility

// Module 3: Profile & Identity Management
router.get('/profile', studentController.getProfile);
router.post('/profile-pic', upload.single('profile_pic'), studentController.updateProfilePic);
router.post('/change-password', studentController.changePassword);

// Module 4: Leave Management & Notifications
router.post('/leaves', studentController.applyLeave);
router.get('/leaves', studentController.getLeaveHistory);
router.get('/notifications', studentController.getNotifications);
router.post('/notifications/read', studentController.markNotificationsRead);

module.exports = router;
