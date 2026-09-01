const bcrypt = require('bcrypt');
const pool = require('../config/db');

/**
 * Get Dashboard Summary Statistics
 * GET /api/admin/dashboard-stats
 */
exports.getDashboardStats = async (req, res) => {
    try {
        const [[{ totalStudents }]] = await pool.query('SELECT COUNT(*) AS totalStudents FROM Students');
        const [[{ totalTeachers }]] = await pool.query('SELECT COUNT(*) AS totalTeachers FROM Teachers');
        const [[{ totalDepartments }]] = await pool.query('SELECT COUNT(*) AS totalDepartments FROM Departments');
        const [[{ totalCourses }]] = await pool.query('SELECT COUNT(*) AS totalCourses FROM Courses');
        const [[{ totalSubjects }]] = await pool.query('SELECT COUNT(*) AS totalSubjects FROM Subjects');
        const [[{ totalMaterials }]] = await pool.query('SELECT COUNT(*) AS totalMaterials FROM StudyMaterials');
        const [[{ activeClasses }]] = await pool.query('SELECT COUNT(*) AS activeClasses FROM Sections');

        const [[{ todayAttendance }]] = await pool.query("SELECT COUNT(*) AS todayAttendance FROM Attendance WHERE DATE(scanned_at) = CURDATE() AND status = 'Present'");
        const [[{ totalScans }]] = await pool.query("SELECT COUNT(*) AS totalScans FROM Attendance");
        const [[{ totalPresent }]] = await pool.query("SELECT COUNT(*) AS totalPresent FROM Attendance WHERE status = 'Present'");

        const overallPercentage = totalScans > 0 ? Math.round((totalPresent / totalScans) * 100) : 100;

        res.status(200).json({
            status: 'success',
            data: {
                totalStudents: totalStudents || 0,
                totalTeachers: totalTeachers || 0,
                totalDepartments: totalDepartments || 0,
                totalCourses: totalCourses || 0,
                totalSubjects: totalSubjects || 0,
                totalMaterials: totalMaterials || 0,
                activeClasses: activeClasses || 0,
                todayAttendance: todayAttendance || 0,
                overallPercentage
            }
        });
    } catch (error) {
        console.error('Get Dashboard Stats Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching dashboard statistics.' });
    }
};

/* ==========================================================================
   DEPARTMENT CONTROLLERS
   ========================================================================== */

/**
 * Fetch All Departments
 * GET /api/admin/departments
 */
exports.getDepartments = async (req, res) => {
    try {
        const [departments] = await pool.query('SELECT * FROM Departments ORDER BY id DESC');
        res.status(200).json({
            status: 'success',
            data: departments
        });
    } catch (error) {
        console.error('Get Departments Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching departments.' });
    }
};

/**
 * Create New Department
 * POST /api/admin/departments
 */
exports.createDepartment = async (req, res) => {
    const { name, code } = req.body;

    if (!name || !code) {
        return res.status(400).json({ status: 'fail', message: 'Department name and code are required.' });
    }

    try {
        const [result] = await pool.query(
            'INSERT INTO Departments (name, code) VALUES (?, ?)',
            [name.trim(), code.trim().toUpperCase()]
        );

        res.status(201).json({
            status: 'success',
            message: 'Department created successfully.',
            data: {
                id: result.insertId,
                name: name.trim(),
                code: code.trim().toUpperCase()
            }
        });
    } catch (error) {
        console.error('Create Department Error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ status: 'fail', message: 'A department with this code already exists.' });
        }
        res.status(500).json({ status: 'error', message: 'Internal server error while creating department.' });
    }
};

/**
 * Delete Department
 * DELETE /api/admin/departments/:id
 */
exports.deleteDepartment = async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await pool.query('DELETE FROM Departments WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 'fail', message: 'Department not found.' });
        }

        res.status(200).json({ status: 'success', message: 'Department deleted successfully.' });
    } catch (error) {
        console.error('Delete Department Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while deleting department.' });
    }
};

/* ==========================================================================
   TEACHER CONTROLLERS
   ========================================================================== */

/**
 * Fetch All Teachers
 * GET /api/admin/teachers
 */
exports.getTeachers = async (req, res) => {
    try {
        const [teachers] = await pool.query(`
            SELECT t.id, t.employee_id, t.name, t.email, t.phone, t.status, t.department_id, d.name AS department_name, t.created_at
            FROM Teachers t
            LEFT JOIN Departments d ON t.department_id = d.id
            ORDER BY t.id DESC
        `);

        res.status(200).json({
            status: 'success',
            data: teachers
        });
    } catch (error) {
        console.error('Get Teachers Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching teachers.' });
    }
};

/**
 * Create New Teacher
 * POST /api/admin/teachers
 */
exports.createTeacher = async (req, res) => {
    const { department_id, employee_id, name, email, password, phone, status } = req.body;

    if (!employee_id || !name || !email || !password) {
        return res.status(400).json({
            status: 'fail',
            message: 'Employee ID, Name, Email, and Password are required.'
        });
    }

    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const [result] = await pool.query(
            `INSERT INTO Teachers (department_id, employee_id, name, email, password, phone, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                department_id || null,
                employee_id.trim(),
                name.trim(),
                email.trim().toLowerCase(),
                hashedPassword,
                phone ? phone.trim() : null,
                status || 'Active'
            ]
        );

        res.status(201).json({
            status: 'success',
            message: 'Teacher account created successfully.',
            data: {
                id: result.insertId,
                employee_id: employee_id.trim(),
                name: name.trim(),
                email: email.trim().toLowerCase(),
                department_id: department_id || null,
                status: status || 'Active'
            }
        });
    } catch (error) {
        console.error('Create Teacher Error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                status: 'fail',
                message: 'A teacher with this Employee ID or Email already exists.'
            });
        }
        res.status(500).json({ status: 'error', message: 'Internal server error while creating teacher account.' });
    }
};

/**
 * Delete Teacher
 * DELETE /api/admin/teachers/:id
 */
exports.deleteTeacher = async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await pool.query('DELETE FROM Teachers WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 'fail', message: 'Teacher account not found.' });
        }

        res.status(200).json({ status: 'success', message: 'Teacher deleted successfully.' });
    } catch (error) {
        console.error('Delete Teacher Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while deleting teacher account.' });
    }
};

/* ==========================================================================
   STUDENT CONTROLLERS
   ========================================================================== */

/**
 * Fetch All Students
 * GET /api/admin/students
 */
exports.getStudents = async (req, res) => {
    const { department_id } = req.query;
    try {
        let sql = `
            SELECT s.id, s.enrollment_no, s.roll_no, s.name, s.email, s.phone, s.status, s.profile_pic, s.created_at,
                   s.course_id, s.semester_id, s.section_id,
                   s.semester_id AS semester,
                   c.name AS course_name, c.code AS course_code,
                   d.name AS department_name, d.code AS department_code,
                   sec.name AS section_name,
                   sem.semester_number,
                   COALESCE(sem.semester_number, s.semester_id) AS display_semester
            FROM Students s
            LEFT JOIN Courses c ON s.course_id = c.id
            LEFT JOIN Departments d ON c.department_id = d.id
            LEFT JOIN Sections sec ON s.section_id = sec.id
            LEFT JOIN Semesters sem ON s.semester_id = sem.id
        `;
        const params = [];

        if (department_id) {
            sql += ` WHERE c.department_id = ? OR d.id = ? `;
            params.push(parseInt(department_id, 10), parseInt(department_id, 10));
        }

        sql += ` ORDER BY s.id DESC`;

        const [students] = await pool.query(sql, params);

        res.status(200).json({
            status: 'success',
            data: students
        });
    } catch (error) {
        console.error('Get Students Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching students.' });
    }
};

/**
 * Create New Student
 * POST /api/admin/students
 */
exports.createStudent = async (req, res) => {
    let { section_id, section, course_id, semester_id, semester, department_id, enrollment_no, roll_no, name, email, password, phone, status } = req.body;

    if (!enrollment_no || !name || !email || !password) {
        return res.status(400).json({
            status: 'fail',
            message: 'Enrollment Number, Name, Email, and Password are required.'
        });
    }

    let parsedCourseId = (course_id && !isNaN(parseInt(course_id, 10))) ? parseInt(course_id, 10) : null;
    let parsedSemesterId = (semester_id || semester) && !isNaN(parseInt(semester_id || semester, 10)) ? parseInt(semester_id || semester, 10) : null;
    let parsedSectionId = section_id || section || null;

    try {
        if (parsedSectionId && isNaN(parseInt(parsedSectionId, 10))) {
            const secName = parsedSectionId.toString().trim();
            const [secRows] = await pool.query('SELECT id FROM Sections WHERE name = ? LIMIT 1', [secName]);
            if (secRows.length > 0) {
                parsedSectionId = secRows[0].id;
            } else {
                const [insertSec] = await pool.query('INSERT INTO Sections (name) VALUES (?)', [secName]);
                parsedSectionId = insertSec.insertId;
            }
        } else if (parsedSectionId) {
            parsedSectionId = parseInt(parsedSectionId, 10);
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const [result] = await pool.query(
            `INSERT INTO Students (section_id, course_id, semester_id, enrollment_no, roll_no, name, email, password, phone, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                parsedSectionId || null,
                parsedCourseId || null,
                parsedSemesterId || null,
                enrollment_no.trim(),
                roll_no ? roll_no.trim() : null,
                name.trim(),
                email.trim().toLowerCase(),
                hashedPassword,
                phone ? phone.trim() : null,
                status || 'Active'
            ]
        );

        res.status(201).json({
            status: 'success',
            message: 'Student account created successfully.',
            data: {
                id: result.insertId,
                enrollment_no: enrollment_no.trim(),
                roll_no: roll_no ? roll_no.trim() : null,
                name: name.trim(),
                email: email.trim().toLowerCase(),
                phone: phone ? phone.trim() : null,
                section_id: parsedSectionId || null,
                course_id: parsedCourseId || null,
                semester_id: parsedSemesterId || null,
                status: status || 'Active'
            }
        });
    } catch (error) {
        console.error('Create Student Error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                status: 'fail',
                message: 'A student with this Enrollment Number or Email already exists.'
            });
        }
        res.status(500).json({ status: 'error', message: 'Internal server error while creating student account.' });
    }
};

/**
 * Delete Student
 * DELETE /api/admin/students/:id
 */
exports.deleteStudent = async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await pool.query('DELETE FROM Students WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 'fail', message: 'Student account not found.' });
        }

        res.status(200).json({ status: 'success', message: 'Student deleted successfully.' });
    } catch (error) {
        console.error('Delete Student Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while deleting student account.' });
    }
};

/* ==========================================================================
   CLASS ASSIGNMENT CONTROLLERS
   ========================================================================== */

/**
 * Fetch Teachers, Subjects, and Sections for Assignment Dropdowns
 * GET /api/admin/assignment-form-data
 */
exports.getAssignmentFormData = async (req, res) => {
    try {
        const [departments] = await pool.query("SELECT id, name, code FROM Departments ORDER BY name ASC");
        const [teachers] = await pool.query("SELECT id, name, employee_id FROM Teachers WHERE status = 'Active' ORDER BY name ASC");
        const [subjects] = await pool.query("SELECT id, name, code FROM Subjects ORDER BY name ASC");
        const [sections] = await pool.query("SELECT id, name FROM Sections ORDER BY name ASC");

        res.status(200).json({
            status: 'success',
            data: {
                departments,
                teachers,
                subjects,
                sections
            }
        });
    } catch (error) {
        console.error('Get Assignment Form Data Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching assignment form options.' });
    }
};

/**
 * Fetch Active Faculty Teachers filtered by Department
 * GET /api/admin/faculty/department/:department_id
 */
exports.getFacultyByDepartment = async (req, res) => {
    const { department_id } = req.params;
    try {
        const [teachers] = await pool.query(
            "SELECT id, name FROM Teachers WHERE department_id = ? AND status = 'Active' ORDER BY name ASC",
            [department_id]
        );
        res.status(200).json({
            status: 'success',
            data: teachers
        });
    } catch (error) {
        console.error('Get Faculty By Department Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching faculty by department.' });
    }
};

/**
 * Fetch Subjects filtered by Department
 * GET /api/admin/subjects/department/:department_id
 */
exports.getSubjectsByDepartment = async (req, res) => {
    const { department_id } = req.params;
    try {
        const [subjects] = await pool.query(
            "SELECT id, name, code FROM Subjects WHERE department_id = ? ORDER BY name ASC",
            [department_id]
        );
        res.status(200).json({
            status: 'success',
            data: subjects
        });
    } catch (error) {
        console.error('Get Subjects By Department Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching subjects by department.' });
    }
};

/**
 * Assign Subject & Section to Teacher
 * POST /api/admin/assign-class
 */
exports.assignClass = async (req, res) => {
    let { teacher_id, subject_id, section_id, section } = req.body;

    if (!teacher_id || !subject_id) {
        return res.status(400).json({
            status: 'fail',
            success: false,
            message: 'Teacher and Subject selection are required.'
        });
    }

    let finalSectionId = section_id || section || null;

    try {
        // If section is provided as a letter name like 'A', 'B', 'C', 'D', 'E'
        if (finalSectionId && isNaN(parseInt(finalSectionId, 10))) {
            const sectionName = finalSectionId.toString().trim();
            const [secRows] = await pool.query('SELECT id FROM Sections WHERE name = ? LIMIT 1', [sectionName]);
            if (secRows.length > 0) {
                finalSectionId = secRows[0].id;
            } else {
                const [insertSec] = await pool.query('INSERT INTO Sections (name) VALUES (?)', [sectionName]);
                finalSectionId = insertSec.insertId;
            }
        } else if (finalSectionId) {
            finalSectionId = parseInt(finalSectionId, 10);
        }

        const [result] = await pool.query(
            'INSERT INTO Classes (teacher_id, subject_id, section_id) VALUES (?, ?, ?)',
            [teacher_id, subject_id, finalSectionId || null]
        );

        res.status(201).json({
            status: 'success',
            success: true,
            message: 'Class assigned successfully.',
            data: {
                id: result.insertId,
                mapping_id: result.insertId,
                class_id: result.insertId,
                teacher_id,
                subject_id,
                section_id: finalSectionId || null
            }
        });
    } catch (error) {
        console.error('Assign Class Error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                status: 'fail',
                success: false,
                message: 'This exact class assignment (Teacher, Subject, Section) already exists.'
            });
        }
        res.status(500).json({ status: 'error', success: false, message: 'Internal server error while assigning class.' });
    }
};

/**
 * Fetch All Assigned Classes
 * GET /api/admin/assigned-classes
 */
exports.getAllAssignedClasses = async (req, res) => {
    try {
        const [assignedClasses] = await pool.query(`
            SELECT c.id, c.id AS mapping_id, c.id AS class_id,
                   c.teacher_id, t.name AS teacher_name, t.employee_id,
                   c.subject_id, sub.name AS subject_name, sub.code AS subject_code,
                   c.section_id, sec.name AS section_name, c.created_at
            FROM Classes c
            JOIN Teachers t ON c.teacher_id = t.id
            JOIN Subjects sub ON c.subject_id = sub.id
            LEFT JOIN Sections sec ON c.section_id = sec.id
            ORDER BY c.id DESC
        `);

        res.status(200).json({
            status: 'success',
            success: true,
            data: assignedClasses
        });
    } catch (error) {
        console.error('Get All Assigned Classes Error:', error);
        res.status(500).json({ status: 'error', success: false, message: 'Internal server error while fetching assigned classes.' });
    }
};

/**
 * Delete Assigned Class Mapping
 * DELETE /api/admin/assigned-classes/:id
 */
exports.deleteAssignedClass = async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await pool.query('DELETE FROM Classes WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 'fail', message: 'Class assignment mapping not found.' });
        }

        res.status(200).json({ status: 'success', message: 'Class assignment deleted successfully.' });
    } catch (error) {
        console.error('Delete Assigned Class Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while deleting class assignment.' });
    }
};

/* ==========================================================================
   SUBJECT MANAGEMENT CONTROLLERS
   ========================================================================== */

/**
 * Fetch Courses and Semesters for Subject Form Dropdowns
 * GET /api/admin/subject-form-data
 */
exports.getSubjectFormData = async (req, res) => {
    try {
        const [courses] = await pool.query('SELECT id, name, code, duration_years FROM Courses ORDER BY name ASC');
        const [semesters] = await pool.query('SELECT id, course_id, semester_number FROM Semesters ORDER BY semester_number ASC');

        res.status(200).json({
            status: 'success',
            data: {
                courses,
                semesters
            }
        });
    } catch (error) {
        console.error('Get Subject Form Data Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching subject form options.' });
    }
};

/**
 * Create New Subject
 * POST /api/admin/subjects
 */
exports.createSubject = async (req, res) => {
    console.log("Received body:", req.body);
    const { course_id, semester_id, department_id, name, code, type } = req.body;

    // 1. Explicit Payload Validation
    if (!name || !name.toString().trim() || !code || !code.toString().trim()) {
        return res.status(400).json({
            status: 'fail',
            message: 'Validation Error: Subject Name and Code are required.'
        });
    }

    // 2. Type Casting & Sanitization
    const parsedCourseId = (course_id !== undefined && course_id !== null && course_id !== '' && !isNaN(parseInt(course_id, 10))) ? parseInt(course_id, 10) : null;
    const parsedSemesterId = (semester_id !== undefined && semester_id !== null && semester_id !== '' && !isNaN(parseInt(semester_id, 10))) ? parseInt(semester_id, 10) : null;
    const parsedDepartmentId = (department_id !== undefined && department_id !== null && department_id !== '' && !isNaN(parseInt(department_id, 10))) ? parseInt(department_id, 10) : null;
    const cleanName = name.toString().trim();
    const cleanCode = code.toString().trim().toUpperCase();
    const cleanType = (type && ['Theory', 'Practical'].includes(type)) ? type : 'Theory';

    try {
        const [result] = await pool.query(
            `INSERT INTO Subjects (department_id, course_id, semester_id, name, code, type) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [parsedDepartmentId, parsedCourseId, parsedSemesterId, cleanName, cleanCode, cleanType]
        );

        res.status(201).json({
            status: 'success',
            message: 'Subject created successfully.',
            data: {
                id: result.insertId,
                department_id: parsedDepartmentId,
                course_id: parsedCourseId,
                semester_id: parsedSemesterId,
                name: cleanName,
                code: cleanCode,
                type: cleanType
            }
        });
    } catch (error) {
        // 3. Detailed Logging
        console.error("MySQL Error:", error.message);
        console.error("Database Error details:", error);

        // 4. Graceful Error Response
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                status: 'fail',
                message: `Duplicate Entry Error: A subject with code '${cleanCode}' already exists.`
            });
        }

        if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_NO_REFERENCED_ROW') {
            return res.status(400).json({
                status: 'fail',
                message: 'Foreign Key Violation: The specified Department, Course ID or Semester ID does not exist in the database.'
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Internal server error while creating subject.',
            details: error.message
        });
    }
};

/**
 * Fetch All Subjects with Course, Semester and Department Details
 * GET /api/admin/subjects
 */
exports.getAllSubjects = async (req, res) => {
    try {
        const [subjects] = await pool.query(`
            SELECT s.id, s.name, s.name AS subject_name, s.code, s.type, s.created_at,
                   s.semester_id, s.semester_id AS semester, s.course_id, s.department_id,
                   d.name AS department_name,
                   c.name AS course_name, c.code AS course_code,
                   sem.semester_number,
                   COALESCE(sem.semester_number, s.semester_id) AS display_semester
            FROM Subjects s
            LEFT JOIN Departments d ON s.department_id = d.id
            LEFT JOIN Courses c ON s.course_id = c.id
            LEFT JOIN Semesters sem ON s.semester_id = sem.id
            ORDER BY s.id DESC
        `);

        res.status(200).json({
            status: 'success',
            data: subjects
        });
    } catch (error) {
        console.error('Get All Subjects Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching subjects.' });
    }
};

/**
 * Delete Subject
 * DELETE /api/admin/subjects/:id
 */
exports.deleteSubject = async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await pool.query('DELETE FROM Subjects WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 'fail', message: 'Subject not found.' });
        }

        res.status(200).json({ status: 'success', message: 'Subject deleted successfully.' });
    } catch (error) {
        console.error('Delete Subject Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while deleting subject.' });
    }
};

/* ==========================================================================
   COURSE MANAGEMENT CONTROLLERS
   ========================================================================== */

/**
 * Create New Course Program
 * POST /api/admin/courses
 */
exports.createCourse = async (req, res) => {
    console.log("Received body:", req.body);
    const { department_id, name, code, duration_years } = req.body;

    // 1. Explicit Validation
    if (!name || !name.toString().trim() || !code || !code.toString().trim()) {
        return res.status(400).json({
            status: 'fail',
            message: 'Course Name and Code are required.'
        });
    }

    // 2. Hard Number Casting & Strict Validation
    const durationInt = Number(duration_years);
    const deptInt = Number(department_id);

    if (isNaN(durationInt) || isNaN(deptInt) || deptInt <= 0 || durationInt <= 0) {
        return res.status(400).json({
            status: 'fail',
            message: 'Department ID and Duration must be valid positive numbers.'
        });
    }

    const cleanName = name.toString().trim();
    const cleanCode = code.toString().trim().toUpperCase();

    try {
        const [result] = await pool.query(
            'INSERT INTO Courses (department_id, name, code, duration_years) VALUES (?, ?, ?, ?)',
            [deptInt, cleanName, cleanCode, durationInt]
        );

        res.status(201).json({
            status: 'success',
            message: 'Course program created successfully.',
            data: {
                id: result.insertId,
                department_id: deptInt,
                name: cleanName,
                code: cleanCode,
                duration_years: durationInt
            }
        });
    } catch (error) {
        console.error("MySQL Error:", error.message);
        console.error("Database Error details:", error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                status: 'fail',
                message: `Duplicate Entry Error: A course program with code '${cleanCode}' already exists.`
            });
        }

        if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_NO_REFERENCED_ROW') {
            return res.status(400).json({
                status: 'fail',
                message: 'Foreign Key Violation: The selected Department ID does not exist in the database.'
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Internal server error while creating course.',
            details: error.message
        });
    }
};

/**
 * Fetch All Courses with Department Details
 * GET /api/admin/courses
 */
exports.getAllCourses = async (req, res) => {
    try {
        const [courses] = await pool.query(`
            SELECT c.id, c.department_id, c.name, c.code, c.duration_years, c.created_at,
                   d.name AS department_name, d.code AS department_code
            FROM Courses c
            LEFT JOIN Departments d ON c.department_id = d.id
            ORDER BY c.id DESC
        `);

        res.status(200).json({
            status: 'success',
            data: courses
        });
    } catch (error) {
        console.error('Get All Courses Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching courses.' });
    }
};

/**
 * Update Course Program
 * PUT /api/admin/courses/:id
 */
exports.updateCourse = async (req, res) => {
    const { id } = req.params;
    const { department_id, name, code, duration_years } = req.body;

    if (!name || !code || !department_id) {
        return res.status(400).json({ status: 'fail', message: 'Course name, code, and department are required.' });
    }

    const deptInt = parseInt(department_id, 10);
    const durationInt = duration_years ? parseInt(duration_years, 10) : 4;
    const cleanName = name.toString().trim();
    const cleanCode = code.toString().trim().toUpperCase();

    try {
        const [result] = await pool.query(
            'UPDATE Courses SET department_id = ?, name = ?, code = ?, duration_years = ? WHERE id = ?',
            [deptInt, cleanName, cleanCode, durationInt, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 'fail', message: 'Course program not found.' });
        }

        res.status(200).json({
            status: 'success',
            message: 'Course program updated successfully.'
        });
    } catch (error) {
        console.error('Update Course Error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ status: 'fail', message: `A course program with code '${cleanCode}' already exists.` });
        }
        res.status(500).json({ status: 'error', message: 'Internal server error while updating course.' });
    }
};

/**
 * Delete Course
 * DELETE /api/admin/courses/:id
 */
exports.deleteCourse = async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await pool.query('DELETE FROM Courses WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 'fail', message: 'Course program not found.' });
        }

        res.status(200).json({ status: 'success', message: 'Course program deleted successfully.' });
    } catch (error) {
        console.error('Delete Course Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while deleting course.' });
    }
};

/* ==========================================================================
   APPROVAL WORKFLOW CONTROLLERS
   ========================================================================== */

/**
 * Fetch All Pending Teacher & Student Registrations
 * GET /api/admin/approvals/pending
 */
exports.getPendingApprovals = async (req, res) => {
    try {
        const [teachers] = await pool.query(`
            SELECT t.id, t.name, t.email, t.employee_id AS identifier, t.phone, 'Teacher' AS role, t.created_at, d.name AS department_name
            FROM Teachers t
            LEFT JOIN Departments d ON t.department_id = d.id
            WHERE t.status = 'Pending'
            ORDER BY t.id DESC
        `);

        const [students] = await pool.query(`
            SELECT s.id, s.name, s.email, s.enrollment_no AS identifier, s.phone, 'Student' AS role, s.created_at, sec.name AS section_name
            FROM Students s
            LEFT JOIN Sections sec ON s.section_id = sec.id
            WHERE s.status = 'Pending'
            ORDER BY s.id DESC
        `);

        res.status(200).json({
            status: 'success',
            data: {
                teachers,
                students,
                totalPending: teachers.length + students.length
            }
        });
    } catch (error) {
        console.error('Get Pending Approvals Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching pending approvals.' });
    }
};

/**
 * Approve Pending Registration
 * POST /api/admin/approvals/approve
 */
exports.approveUser = async (req, res) => {
    const { userType, userId } = req.body;

    if (!userType || !userId) {
        return res.status(400).json({ status: 'fail', message: 'User type and User ID are required.' });
    }

    try {
        const table = userType === 'Teacher' ? 'Teachers' : 'Students';
        const [result] = await pool.query(`UPDATE ${table} SET status = 'Active' WHERE id = ?`, [userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 'fail', message: `${userType} record not found.` });
        }

        res.status(200).json({
            status: 'success',
            message: `${userType} account approved successfully.`
        });
    } catch (error) {
        console.error('Approve User Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while approving user.' });
    }
};

/**
 * Reject Pending Registration
 * POST /api/admin/approvals/reject
 */
exports.rejectUser = async (req, res) => {
    const { userType, userId } = req.body;

    if (!userType || !userId) {
        return res.status(400).json({ status: 'fail', message: 'User type and User ID are required.' });
    }

    try {
        const table = userType === 'Teacher' ? 'Teachers' : 'Students';
        const [result] = await pool.query(`DELETE FROM ${table} WHERE id = ?`, [userId]);

        res.status(200).json({
            status: 'success',
            message: `${userType} account rejected and deleted.`
        });
    } catch (error) {
        console.error('Reject User Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while rejecting user.' });
    }
};

/**
 * Fetch Pending Faculty Registrations
 * GET /api/admin/pending-faculty
 */
exports.getPendingFaculty = async (req, res) => {
    try {
        const [pendingFaculty] = await pool.query(`
            SELECT t.id, t.employee_id, t.name, t.email, t.phone, t.created_at,
                   d.name AS department_name
            FROM Teachers t
            LEFT JOIN Departments d ON t.department_id = d.id
            WHERE t.status = 'Pending'
            ORDER BY t.id DESC
        `);

        res.status(200).json({
            status: 'success',
            data: pendingFaculty
        });
    } catch (error) {
        console.error('Get Pending Faculty Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching pending faculty.' });
    }
};

/**
 * Approve Pending Faculty
 * POST /api/admin/approve-faculty or POST /api/admin/pending-faculty/approve
 */
exports.approveFaculty = async (req, res) => {
    const teacher_id = req.body.teacher_id || req.body.userId || req.params.id;

    if (!teacher_id) {
        return res.status(400).json({ status: 'fail', message: 'Teacher ID is required for approval.' });
    }

    try {
        const [result] = await pool.query("UPDATE Teachers SET status = 'Active' WHERE id = ?", [teacher_id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 'fail', message: 'Teacher record not found.' });
        }

        res.status(200).json({
            status: 'success',
            message: 'Faculty account approved successfully.'
        });
    } catch (error) {
        console.error('Approve Faculty Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while approving faculty.' });
    }
};

/**
 * Reject Pending Faculty
 * DELETE /api/admin/reject-faculty/:teacher_id or POST /api/admin/reject-faculty
 */
exports.rejectFaculty = async (req, res) => {
    const teacher_id = req.params.teacher_id || req.body.teacher_id || req.body.userId;

    if (!teacher_id) {
        return res.status(400).json({ status: 'fail', message: 'Teacher ID is required for rejection.' });
    }

    try {
        const [result] = await pool.query('DELETE FROM Teachers WHERE id = ?', [teacher_id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 'fail', message: 'Teacher record not found.' });
        }

        res.status(200).json({
            status: 'success',
            message: 'Faculty application rejected and record removed.'
        });
    } catch (error) {
        console.error('Reject Faculty Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while rejecting faculty.' });
    }
};

/**
 * Fetch All Pending Student Registrations
 * GET /api/admin/pending-students
 */
exports.getPendingStudents = async (req, res) => {
    try {
        const [pendingStudents] = await pool.query(`
            SELECT s.id, s.enrollment_no, s.roll_no, s.name, s.email, s.phone, s.status, s.created_at,
                   s.course_id, s.semester_id, s.section_id,
                   c.name AS course_name, c.code AS course_code,
                   sec.name AS section_name
            FROM Students s
            LEFT JOIN Courses c ON s.course_id = c.id
            LEFT JOIN Sections sec ON s.section_id = sec.id
            WHERE s.status = 'Pending'
            ORDER BY s.id DESC
        `);

        res.status(200).json({
            status: 'success',
            success: true,
            data: pendingStudents
        });
    } catch (error) {
        console.error('Get Pending Students Error:', error.message);
        res.status(500).json({
            status: 'error',
            success: false,
            message: 'Internal server error while fetching pending student registrations.'
        });
    }
};

/**
 * Update Student Status (Active / Inactive)
 * PATCH /api/admin/students/:id/status or PUT /api/admin/students/:id/status
 */
exports.updateStudentStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['Active', 'Inactive', 'Pending'].includes(status)) {
        return res.status(400).json({
            status: 'fail',
            success: false,
            message: "Invalid status value. Must be 'Active', 'Inactive', or 'Pending'."
        });
    }

    try {
        const [result] = await pool.query(
            'UPDATE Students SET status = ? WHERE id = ?',
            [status, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                status: 'fail',
                success: false,
                message: 'Student record not found.'
            });
        }

        const actionText = status === 'Active' ? 'approved' : status === 'Inactive' ? 'rejected/deactivated' : 'updated';

        res.status(200).json({
            status: 'success',
            success: true,
            message: `Student account ${actionText} successfully.`,
            data: { id: parseInt(id, 10), status }
        });
    } catch (error) {
        console.error('Update Student Status Error:', error.message);
        res.status(500).json({
            status: 'error',
            success: false,
            message: 'Internal server error while updating student status.'
        });
    }
};

/**
 * Approve Pending Student
 * POST /api/admin/approve-student or POST /api/admin/pending-students/approve
 */
exports.approveStudent = async (req, res) => {
    const student_id = req.body.student_id || req.body.userId || req.params.id;

    if (!student_id) {
        return res.status(400).json({ status: 'fail', message: 'Student ID is required for approval.' });
    }

    try {
        const [result] = await pool.query("UPDATE Students SET status = 'Active' WHERE id = ?", [student_id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 'fail', message: 'Student record not found.' });
        }

        res.status(200).json({
            status: 'success',
            success: true,
            message: 'Student account approved successfully.'
        });
    } catch (error) {
        console.error('Approve Student Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while approving student.' });
    }
};

/**
 * Reject Pending Student
 * DELETE /api/admin/reject-student/:student_id or POST /api/admin/reject-student
 */
exports.rejectStudent = async (req, res) => {
    const student_id = req.params.student_id || req.params.id || req.body.student_id || req.body.userId;

    if (!student_id) {
        return res.status(400).json({ status: 'fail', message: 'Student ID is required for rejection.' });
    }

    try {
        const [result] = await pool.query("UPDATE Students SET status = 'Inactive' WHERE id = ?", [student_id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 'fail', message: 'Student record not found.' });
        }

        res.status(200).json({
            status: 'success',
            success: true,
            message: 'Student registration rejected.'
        });
    } catch (error) {
        console.error('Reject Student Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while rejecting student.' });
    }
};

/**
 * --------------------------------------------------------------------------
 * USER MANAGEMENT & SECURITY
 * --------------------------------------------------------------------------
 */

// Reset Password for Teacher or Student
exports.resetUserPassword = async (req, res) => {
    const { userType, userId, newPassword } = req.body;
    if (!userType || !userId || !newPassword) {
        return res.status(400).json({ status: 'fail', message: 'User type, User ID, and new password are required.' });
    }

    try {
        const table = userType === 'Teacher' ? 'Teachers' : 'Students';
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const [result] = await pool.query(`UPDATE ${table} SET password = ? WHERE id = ?`, [hashedPassword, userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 'fail', message: `${userType} not found.` });
        }

        res.status(200).json({ status: 'success', message: `${userType} password reset successfully.` });
    } catch (error) {
        console.error('Reset User Password Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while resetting password.' });
    }
};

// Toggle User Account Status (Active / Inactive)
exports.toggleUserStatus = async (req, res) => {
    const { userType, userId, status } = req.body;
    if (!userType || !userId || !status) {
        return res.status(400).json({ status: 'fail', message: 'User type, User ID, and status are required.' });
    }

    try {
        const table = userType === 'Teacher' ? 'Teachers' : 'Students';
        const [result] = await pool.query(`UPDATE ${table} SET status = ? WHERE id = ?`, [status, userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 'fail', message: `${userType} not found.` });
        }

        res.status(200).json({ status: 'success', message: `${userType} account status updated to ${status}.` });
    } catch (error) {
        console.error('Toggle User Status Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while updating status.' });
    }
};

/**
 * Update Faculty Teacher Details
 * PUT /api/admin/teachers/:id
 */
exports.updateTeacherDetails = async (req, res) => {
    const { id } = req.params;
    const { employee_id, name, email, phone, department_id, status } = req.body;

    if (!name || !email) {
        return res.status(400).json({ status: 'fail', message: 'Name and Email are required.' });
    }

    try {
        const parsedDeptId = department_id ? parseInt(department_id, 10) : null;
        const [result] = await pool.query(`
            UPDATE Teachers 
            SET employee_id = ?, name = ?, email = ?, phone = ?, department_id = ?, status = ?
            WHERE id = ?
        `, [employee_id ? employee_id.trim() : null, name.trim(), email.trim().toLowerCase(), phone ? phone.trim() : null, parsedDeptId, status || 'Active', id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 'fail', message: 'Teacher record not found.' });
        }

        res.status(200).json({ status: 'success', message: 'Faculty details updated successfully.' });
    } catch (error) {
        console.error('Update Teacher Details Error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ status: 'fail', message: 'An account with this Email or Employee ID already exists.' });
        }
        res.status(500).json({ status: 'error', message: 'Internal server error while updating faculty details.' });
    }
};

/**
 * Update Student Details
 * PUT /api/admin/students/:id
 */
exports.updateStudentDetails = async (req, res) => {
    const { id } = req.params;
    const { enrollment_no, roll_no, name, email, phone, section_id, status } = req.body;

    if (!name || !email) {
        return res.status(400).json({ status: 'fail', message: 'Name and Email are required.' });
    }

    try {
        const parsedSecId = section_id ? parseInt(section_id, 10) : null;
        const [result] = await pool.query(`
            UPDATE Students 
            SET enrollment_no = ?, roll_no = ?, name = ?, email = ?, phone = ?, status = ?
            WHERE id = ?
        `, [enrollment_no ? enrollment_no.trim() : null, roll_no ? roll_no.trim() : null, name.trim(), email.trim().toLowerCase(), phone ? phone.trim() : null, status || 'Active', id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 'fail', message: 'Student record not found.' });
        }

        res.status(200).json({ status: 'success', message: 'Student details updated successfully.' });
    } catch (error) {
        console.error('Update Student Details Error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ status: 'fail', message: 'An account with this Email or Enrollment No already exists.' });
        }
        res.status(500).json({ status: 'error', message: 'Internal server error while updating student details.' });
    }
};

/**
 * --------------------------------------------------------------------------
 * ACADEMIC MANAGEMENT (SEMESTERS & SECTIONS)
 * --------------------------------------------------------------------------
 */
exports.getSemesters = async (req, res) => {
    try {
        const [semesters] = await pool.query(`
            SELECT sem.id, sem.semester_number, c.name AS course_name, c.code AS course_code
            FROM Semesters sem
            JOIN Courses c ON sem.course_id = c.id
            ORDER BY sem.id DESC
        `);
        res.status(200).json({ status: 'success', data: semesters });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Error fetching semesters.' });
    }
};

exports.createSemester = async (req, res) => {
    const { course_id, semester_number } = req.body;
    if (!course_id || !semester_number) {
        return res.status(400).json({ status: 'fail', message: 'Course ID and Semester Number are required.' });
    }

    try {
        const [result] = await pool.query('INSERT INTO Semesters (course_id, semester_number) VALUES (?, ?)', [course_id, semester_number]);
        res.status(201).json({ status: 'success', message: 'Semester created successfully.', data: { id: result.insertId } });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Error creating semester.' });
    }
};

exports.getSections = async (req, res) => {
    try {
        const [sections] = await pool.query(`
            SELECT sec.id, sec.name AS section_name, d.name AS department_name
            FROM Sections sec
            LEFT JOIN Departments d ON sec.department_id = d.id
            ORDER BY sec.id DESC
        `);
        res.status(200).json({ status: 'success', data: sections });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Error fetching sections.' });
    }
};

exports.createSection = async (req, res) => {
    const { name, department_id, semester_id } = req.body;
    if (!name) {
        return res.status(400).json({ status: 'fail', message: 'Section name is required.' });
    }

    try {
        const [result] = await pool.query('INSERT INTO Sections (name, department_id, semester_id) VALUES (?, ?, ?)', [name, department_id || null, semester_id || null]);
        res.status(201).json({ status: 'success', message: 'Section created successfully.', data: { id: result.insertId } });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Error creating section.' });
    }
};

/**
 * --------------------------------------------------------------------------
 * ATTENDANCE RECORDS MANAGEMENT & CORRECTIONS
 * --------------------------------------------------------------------------
 */
exports.getAllAttendanceRecords = async (req, res) => {
    try {
        const [records] = await pool.query(`
            SELECT a.id, a.status, a.scanned_at,
                   s.name AS student_name, s.enrollment_no, s.roll_no,
                   sub.name AS subject_name, sub.code AS subject_code,
                   sec.name AS section_name,
                   t.name AS teacher_name
            FROM Attendance a
            JOIN Students s ON a.student_id = s.id
            JOIN AttendanceSessions ses ON a.session_id = ses.id
            JOIN Classes c ON ses.class_id = c.id
            JOIN Subjects sub ON c.subject_id = sub.id
            LEFT JOIN Sections sec ON c.section_id = sec.id
            LEFT JOIN Teachers t ON c.teacher_id = t.id
            ORDER BY a.scanned_at DESC
            LIMIT 300
        `);
        res.status(200).json({ status: 'success', data: records });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Error fetching attendance records.' });
    }
};

exports.updateAttendanceRecord = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) return res.status(400).json({ status: 'fail', message: 'Status is required.' });

    try {
        const [result] = await pool.query('UPDATE Attendance SET status = ? WHERE id = ?', [status, id]);
        if (result.affectedRows === 0) return res.status(404).json({ status: 'fail', message: 'Record not found.' });

        res.status(200).json({ status: 'success', message: 'Attendance record updated successfully.' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Error updating attendance record.' });
    }
};

exports.deleteAttendanceRecord = async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await pool.query('DELETE FROM Attendance WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ status: 'fail', message: 'Record not found.' });

        res.status(200).json({ status: 'success', message: 'Attendance record deleted successfully.' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Error deleting attendance record.' });
    }
};

/**
 * --------------------------------------------------------------------------
 * SYSTEM SETTINGS
 * --------------------------------------------------------------------------
 */
exports.getSystemSettings = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM SystemSettings WHERE id = 1');
        res.status(200).json({ status: 'success', data: rows[0] || {} });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Error fetching system settings.' });
    }
};

exports.updateSystemSettings = async (req, res) => {
    const { college_name, academic_session, qr_expiry_seconds } = req.body;

    try {
        await pool.query(`
            UPDATE SystemSettings 
            SET college_name = ?, academic_session = ?, qr_expiry_seconds = ?
            WHERE id = 1
        `, [college_name, academic_session, qr_expiry_seconds || 60]);

        res.status(200).json({ status: 'success', message: 'System settings updated successfully.' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Error updating system settings.' });
    }
};

/**
 * --------------------------------------------------------------------------
 * ABSENCE LEAVE MANAGEMENT (ADMIN REVIEW)
 * --------------------------------------------------------------------------
 */

/**
 * Fetch All Student Leave Requests (For Admin Review)
 * GET /api/admin/leaves
 */
exports.getAllLeaveRequests = async (req, res) => {
    try {
        const [leaves] = await pool.query(`
            SELECT l.id, l.student_id, l.start_date, l.end_date, l.reason, l.status, l.admin_remark, l.created_at,
                   s.name AS student_name, s.enrollment_no, s.roll_no, s.email,
                   c.name AS course_name, sec.name AS section_name
            FROM LeaveRequests l
            JOIN Students s ON l.student_id = s.id
            LEFT JOIN Courses c ON s.course_id = c.id
            LEFT JOIN Sections sec ON s.section_id = sec.id
            ORDER BY l.id DESC
        `);

        res.status(200).json({
            status: 'success',
            data: leaves
        });
    } catch (error) {
        console.error('Get All Leave Requests Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching leave requests.' });
    }
};

/**
 * Update Leave Request Status (Approve / Reject)
 * PUT /api/admin/leaves/:id/status
 */
exports.updateLeaveStatus = async (req, res) => {
    const { id } = req.params;
    const { status, admin_remark } = req.body;

    if (!status || !['Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({ status: 'fail', message: 'Valid status (Approved or Rejected) is required.' });
    }

    try {
        const [[leave]] = await pool.query('SELECT student_id, start_date, end_date FROM LeaveRequests WHERE id = ?', [id]);
        if (!leave) {
            return res.status(404).json({ status: 'fail', message: 'Leave request not found.' });
        }

        await pool.query(
            'UPDATE LeaveRequests SET status = ?, admin_remark = ? WHERE id = ?',
            [status, admin_remark ? admin_remark.trim() : null, id]
        );

        // Auto notification for the student
        const notifType = status === 'Approved' ? 'success' : 'danger';
        const notifMsg = `Your leave application (${leave.start_date} to ${leave.end_date}) has been ${status}.${admin_remark ? ` Remark: ${admin_remark}` : ''}`;
        
        await pool.query(
            `INSERT INTO Notifications (student_id, user_id, user_role, title, message, type)
             VALUES (?, ?, 'Student', 'Leave Application Update', ?, ?)`,
            [leave.student_id, leave.student_id, notifMsg, notifType]
        );

        res.status(200).json({
            status: 'success',
            message: `Leave request ${status.toLowerCase()} successfully.`
        });
    } catch (error) {
        console.error('Update Leave Status Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while updating leave status.' });
    }
};

// ============================================================================
// SYSTEM SETTINGS MANAGEMENT (Rule 2: Prepared Statements, Rule 4: Try-Catch)
// ============================================================================

/**
 * Get System Settings
 * GET /api/admin/system-settings
 */
exports.getSystemSettings = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT college_name, academic_session, qr_expiry_seconds FROM SystemSettings WHERE id = 1');
        
        if (rows.length === 0) {
            // Default settings fallback if table is somehow empty
            return res.status(200).json({
                status: 'success',
                data: {
                    college_name: 'Smart Institute of Technology',
                    academic_session: '2025 - 2026',
                    qr_expiry_seconds: 60
                }
            });
        }

        res.status(200).json({
            status: 'success',
            data: rows[0]
        });
    } catch (error) {
        console.error('❌ Get System Settings Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching system settings.' });
    }
};

/**
 * Update System Settings
 * PUT /api/admin/system-settings
 */
exports.updateSystemSettings = async (req, res) => {
    const { college_name, academic_session, qr_expiry_seconds } = req.body;

    if (!college_name || !academic_session || !qr_expiry_seconds) {
        return res.status(400).json({ status: 'fail', message: 'All setting fields are required.' });
    }

    if (isNaN(qr_expiry_seconds) || qr_expiry_seconds < 10 || qr_expiry_seconds > 600) {
        return res.status(400).json({ status: 'fail', message: 'QR Expiry must be a valid number between 10 and 600 seconds.' });
    }

    try {
        await pool.query(
            `INSERT INTO SystemSettings (id, college_name, academic_session, qr_expiry_seconds) 
             VALUES (1, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE 
             college_name = VALUES(college_name), 
             academic_session = VALUES(academic_session), 
             qr_expiry_seconds = VALUES(qr_expiry_seconds)`,
            [college_name.trim(), academic_session.trim(), Number(qr_expiry_seconds)]
        );

        res.status(200).json({
            status: 'success',
            message: 'System settings updated successfully.'
        });
    } catch (error) {
        console.error('❌ Update System Settings Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while updating system settings.' });
    }
};
