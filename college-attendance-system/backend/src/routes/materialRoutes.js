const express = require('express');
const router = express.Router();
const materialController = require('../controllers/materialController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

// Helper routes for dropdown options (Public / Authenticated)
router.get('/courses', materialController.getCourses);
router.get('/semesters/:course_id', materialController.getSemestersByCourse);
router.get('/subjects/:course_id/:semester_id', materialController.getSubjectsByCourseAndSemester);

// Student Route: GET Study Materials filtered by student's course_id & semester_id
router.get('/student', verifyToken, authorizeRoles('Student', 'Admin'), materialController.getStudentMaterials);

// Faculty Route: POST Upload Study Material (Requires Teacher/Admin role)
router.post(
    '/upload',
    verifyToken,
    authorizeRoles('Teacher', 'Admin'),
    materialController.uploadMiddleware.single('file'),
    materialController.uploadMaterial
);

module.exports = router;
