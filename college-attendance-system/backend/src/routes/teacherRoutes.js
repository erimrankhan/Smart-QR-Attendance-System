const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const teacherController = require('../controllers/teacherController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

// Ensure Uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads/profiles');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'teacher-' + req.user.id + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed.'));
        }
    }
});

// Protect all routes with JWT verification and strict Teacher role authorization
router.use(verifyToken);
router.use(authorizeRoles('Teacher'));

// 1. Dashboard & Overview
router.get('/dashboard-summary', teacherController.getTeacherDashboardSummary);
router.get('/classes', teacherController.getAssignedClasses);
router.get('/my-courses', teacherController.getMyCourses);

// 2. Dynamic QR Session Engine & Realtime Scans
router.post('/start-session', teacherController.startAttendanceSession);
router.post('/regenerate-qr/:session_id', teacherController.regenerateQRCode);
router.get('/live-attendance/:session_id', teacherController.getLiveAttendance);
router.post('/close-session/:session_id', teacherController.closeSession);
router.post('/manual-mark', teacherController.manualMarkAttendance);

// 3. Class Management, Student Directory & Timetable
router.get('/class-roster/:class_id', teacherController.getClassRoster);
router.get('/students-directory', teacherController.searchStudentsDirectory);
router.get('/timetable', teacherController.getClassTimetable);

// 4. Comprehensive Reports Engine
router.get('/reports', teacherController.getAttendanceReports);

// 5. Class Announcements Dispatcher
router.post('/send-announcement', teacherController.sendClassAnnouncement);
router.get('/announcements', teacherController.getTeacherAnnouncements);

// 6. Faculty Profile & Security
router.get('/profile', teacherController.getTeacherProfile);
router.post('/profile-pic', upload.single('profile_pic'), teacherController.updateTeacherProfilePic);
router.post('/change-password', teacherController.changeTeacherPassword);

module.exports = router;
