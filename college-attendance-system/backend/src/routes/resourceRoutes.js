const express = require('express');
const router = express.Router();
const resourceController = require('../controllers/resourceController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

// Protect all resource routes with JWT verification
router.use(verifyToken);

// Teacher & Faculty Upload Endpoint
router.post('/upload', authorizeRoles('Teacher', 'Faculty'), resourceController.uploadMiddleware.single('file'), resourceController.uploadResource);

// Class Resources Endpoint
router.get('/class/:class_id', resourceController.getClassResources);

// Student Study Materials Endpoint
router.get('/my-resources', authorizeRoles('Student'), resourceController.getStudentResources);

module.exports = router;
