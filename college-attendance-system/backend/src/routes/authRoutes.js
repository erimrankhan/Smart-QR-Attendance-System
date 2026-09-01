const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Public Options Helpers (No Auth Required for Registration Dropdowns)
router.get('/public-departments', authController.getPublicDepartments);
router.get('/public-sections', authController.getPublicSections);
router.get('/public-courses', authController.getPublicCourses);
router.get('/courses', authController.getPublicCourses);

// Portal Independent Login Routes
router.post('/admin/login', authController.adminLogin);
router.post('/teacher/login', authController.teacherLogin);
router.post('/faculty/login', authController.facultyLogin);
router.post('/student/login', authController.studentLogin);

// Self-Registration Routes
router.post('/teacher/register', authController.teacherRegister);
router.post('/faculty/register', authController.facultyRegister);
router.post('/student/register', authController.studentRegister);

// Email OTP Verification Routes
router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);

module.exports = router;
