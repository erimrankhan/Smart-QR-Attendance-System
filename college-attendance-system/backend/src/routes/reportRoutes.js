const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

// Protect all report routes with JWT verification
router.use(verifyToken);
router.use(authorizeRoles('Admin', 'Teacher'));

// Analytics & Export Routes
router.get('/analytics', reportController.getSystemAnalytics);
router.get('/export/excel', reportController.exportAttendanceExcel);
router.get('/export/pdf', reportController.exportAttendancePDF);

module.exports = router;
