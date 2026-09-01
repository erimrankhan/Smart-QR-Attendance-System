const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

// Apply JWT verification and strict Admin role authorization to ALL admin routes
router.use(verifyToken);
router.use(authorizeRoles('Admin'));

// Dashboard Stats
router.get('/dashboard-stats', adminController.getDashboardStats);

// Department Routes
router.get('/departments', adminController.getDepartments);
router.post('/departments', adminController.createDepartment);
router.delete('/departments/:id', adminController.deleteDepartment);

// Teacher Routes
router.get('/teachers', adminController.getTeachers);
router.post('/teachers', adminController.createTeacher);
router.delete('/teachers/:id', adminController.deleteTeacher);

// Student Routes
router.get('/students', adminController.getStudents);
router.post('/students', adminController.createStudent);
router.delete('/students/:id', adminController.deleteStudent);
router.patch('/students/:id/status', adminController.updateStudentStatus);
router.put('/students/:id/status', adminController.updateStudentStatus);

// Class Assignment Routes
router.get('/assignment-form-data', adminController.getAssignmentFormData);
router.get('/faculty/department/:department_id', adminController.getFacultyByDepartment);
router.get('/teachers/department/:department_id', adminController.getFacultyByDepartment);
router.get('/subjects/department/:department_id', adminController.getSubjectsByDepartment);
router.post('/assign-class', adminController.assignClass);
router.get('/assigned-classes', adminController.getAllAssignedClasses);
router.delete('/assigned-classes/:id', adminController.deleteAssignedClass);

// Subject Management Routes
router.get('/subject-form-data', adminController.getSubjectFormData);
router.post('/subjects', adminController.createSubject);
router.get('/subjects', adminController.getAllSubjects);
router.delete('/subjects/:id', adminController.deleteSubject);

// Course Management Routes
router.post('/courses', adminController.createCourse);
router.get('/courses', adminController.getAllCourses);
router.put('/courses/:id', adminController.updateCourse);
router.delete('/courses/:id', adminController.deleteCourse);

// Approval Workflow Routes (Combined & Specific)
router.get('/approvals/pending', adminController.getPendingApprovals);
router.post('/approvals/approve', adminController.approveUser);
router.post('/approvals/reject', adminController.rejectUser);

// Pending Students Routes
router.get('/pending-students', adminController.getPendingStudents);
router.post('/approve-student', adminController.approveStudent);
router.post('/pending-students/approve', adminController.approveStudent);
router.post('/reject-student', adminController.rejectStudent);
router.delete('/reject-student/:student_id', adminController.rejectStudent);

// Pending Faculty Routes
router.get('/pending-faculty', adminController.getPendingFaculty);
router.post('/approve-faculty', adminController.approveFaculty);
router.post('/pending-faculty/approve', adminController.approveFaculty);
router.post('/reject-faculty', adminController.rejectFaculty);
router.delete('/reject-faculty/:teacher_id', adminController.rejectFaculty);

// Absence Leave Management Routes
router.get('/leaves', adminController.getAllLeaveRequests);
router.put('/leaves/:id/status', adminController.updateLeaveStatus);

// User Management Routes (Edit, Password Reset & Status Toggle)
router.put('/teachers/:id', adminController.updateTeacherDetails);
router.put('/students/:id', adminController.updateStudentDetails);
router.post('/users/reset-password', adminController.resetUserPassword);
router.post('/users/toggle-status', adminController.toggleUserStatus);

// Academic Management Routes (Semesters & Sections)
router.get('/semesters', adminController.getSemesters);
router.post('/semesters', adminController.createSemester);
router.get('/sections', adminController.getSections);
router.post('/sections', adminController.createSection);

// Attendance Management Routes (View All, Edit, Delete Incorrect Records)
router.get('/attendance', adminController.getAllAttendanceRecords);
router.put('/attendance/:id', adminController.updateAttendanceRecord);
router.delete('/attendance/:id', adminController.deleteAttendanceRecord);

// System Settings Routes (College Name, Academic Session, QR Expiry)
router.get('/system-settings', adminController.getSystemSettings);
router.put('/system-settings', adminController.updateSystemSettings);

module.exports = router;
