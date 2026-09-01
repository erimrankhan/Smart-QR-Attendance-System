const express = require('express');
const router = express.Router();
const resourceController = require('../controllers/resourceController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

// Protect all resource routes with JWT verification
router.use(verifyToken);

// 1. Teacher & Faculty Upload Endpoint
router.post(
    '/upload',
    authorizeRoles('Teacher', 'Faculty'),
    resourceController.uploadMiddleware.single('file'),
    resourceController.uploadResource
);

// 2. Teacher Uploaded Resources List Endpoint
router.get(
    '/teacher-list',
    authorizeRoles('Teacher', 'Faculty'),
    resourceController.getTeacherResources
);
router.get(
    '/teacher',
    authorizeRoles('Teacher', 'Faculty'),
    resourceController.getTeacherResources
);

// 3. Class Specific Resources Endpoint
router.get(
    '/class/:class_id',
    resourceController.getClassResources
);

// 4. Student Study Materials Endpoints
router.get(
    '/my-resources',
    authorizeRoles('Student', 'Admin', 'Teacher', 'Faculty'),
    resourceController.getStudentMaterials
);
router.get(
    '/student/materials',
    authorizeRoles('Student', 'Admin', 'Teacher', 'Faculty'),
    resourceController.getStudentMaterials
);
router.get(
    '/student',
    authorizeRoles('Student', 'Admin', 'Teacher', 'Faculty'),
    resourceController.getStudentMaterials
);

module.exports = router;