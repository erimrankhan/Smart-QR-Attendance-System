const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

/**
 * Helper: Generate Signed JWT Token
 */
const generateToken = (id, role, email) => {
    return jwt.sign(
        { id, role, email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );
};

/**
 * Public Helper: Fetch Courses for Registration Dropdown
 * GET /api/auth/public-courses
 */
exports.getPublicCourses = async (req, res) => {
    try {
        const [courses] = await pool.query('SELECT id, name, code, duration_years FROM Courses ORDER BY name ASC');
        res.status(200).json({
            status: 'success',
            data: courses
        });
    } catch (error) {
        console.error('Get Public Courses Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching courses.' });
    }
};

/**
 * Public Helper: Fetch Departments for Registration Dropdown
 * GET /api/auth/public-departments
 */
exports.getPublicDepartments = async (req, res) => {
    try {
        const [departments] = await pool.query('SELECT id, name, code FROM Departments ORDER BY name ASC');
        res.status(200).json({
            status: 'success',
            data: departments
        });
    } catch (error) {
        console.error('Get Public Departments Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching departments.' });
    }
};

/**
 * Public Helper: Fetch Sections for Registration Dropdown
 * GET /api/auth/public-sections
 */
exports.getPublicSections = async (req, res) => {
    try {
        const [sections] = await pool.query(`
            SELECT sec.id, sec.name AS section_name,
                   c.name AS course_name, c.code AS course_code,
                   sem.semester_number
            FROM Sections sec
            LEFT JOIN Semesters sem ON sec.semester_id = sem.id
            LEFT JOIN Courses c ON sem.course_id = c.id
            ORDER BY sec.id ASC
        `);
        res.status(200).json({
            status: 'success',
            data: sections
        });
    } catch (error) {
        console.error('Get Public Sections Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching sections.' });
    }
};

/**
 * Admin Login Handler
 * POST /api/auth/admin/login
 */
exports.adminLogin = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ status: 'fail', message: 'Username/Email and password are required.' });
    }

    try {
        const [rows] = await pool.query(
            'SELECT * FROM Admins WHERE username = ? OR email = ?',
            [username.trim(), username.trim()]
        );

        if (rows.length === 0) {
            return res.status(401).json({ status: 'fail', message: 'Invalid credentials.' });
        }

        const admin = rows[0];
        const isMatch = await bcrypt.compare(password, admin.password);

        if (!isMatch) {
            return res.status(401).json({ status: 'fail', message: 'Invalid credentials.' });
        }

        const token = generateToken(admin.id, 'Admin', admin.email);

        res.status(200).json({
            status: 'success',
            message: 'Admin authentication successful.',
            token,
            user: {
                id: admin.id,
                username: admin.username,
                email: admin.email,
                role: 'Admin',
                profile_pic: admin.profile_pic
            }
        });
    } catch (error) {
        console.error('Admin Login Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error during admin authentication.' });
    }
};

/**
 * Teacher/Faculty Register Handler (Self-Registration)
 * POST /api/auth/teacher/register or POST /api/auth/faculty/register
 */
exports.facultyRegister = exports.teacherRegister = async (req, res) => {
    let { employee_id, name, email, password, phone, department_id } = req.body;

    // Strict Validation
    if (!name || !email || !password || !department_id) {
        return res.status(400).json({
            status: 'fail',
            message: 'Validation Error: Name, Email, Password, and Department are required.'
        });
    }

    try {
        const parsedDeptId = parseInt(department_id, 10);
        if (isNaN(parsedDeptId)) {
            return res.status(400).json({ status: 'fail', message: 'Department ID must be a valid integer number.' });
        }

        if (!employee_id || !employee_id.trim()) {
            employee_id = 'EMP-' + Math.floor(1000 + Math.random() * 9000);
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.query(
            `INSERT INTO Teachers (employee_id, name, email, password, phone, department_id, status)
             VALUES (?, ?, ?, ?, ?, ?, 'Pending')`,
            [employee_id.trim(), name.trim(), email.trim().toLowerCase(), hashedPassword, phone ? phone.trim() : null, parsedDeptId]
        );

        res.status(201).json({
            status: 'success',
            message: 'Registration submitted successfully. You can log in once the Admin approves your account.'
        });
    } catch (error) {
        console.error('Teacher/Faculty Register Error:', error.message);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ status: 'fail', message: 'An account with this Email or Employee ID already exists.' });
        }
        if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_NO_REFERENCED_ROW') {
            return res.status(400).json({ status: 'fail', message: 'Selected Department ID does not exist in database.' });
        }
        res.status(500).json({ status: 'error', message: 'Internal server error during faculty registration.' });
    }
};

/**
 * Teacher/Faculty Login Handler
 * POST /api/auth/teacher/login or POST /api/auth/faculty/login
 */
exports.facultyLogin = exports.teacherLogin = async (req, res) => {
    const { employee_id, email, password } = req.body;
    const loginIdentifier = (employee_id || email || '').trim();

    if (!loginIdentifier || !password) {
        return res.status(400).json({ status: 'fail', message: 'Email/Employee ID and password are required.' });
    }

    try {
        const [rows] = await pool.query(
            'SELECT * FROM Teachers WHERE employee_id = ? OR email = ?',
            [loginIdentifier, loginIdentifier.toLowerCase()]
        );

        if (rows.length === 0) {
            return res.status(401).json({ status: 'fail', message: 'Invalid email or password.' });
        }

        const teacher = rows[0];

        const isMatch = await bcrypt.compare(password, teacher.password);
        if (!isMatch) {
            return res.status(401).json({ status: 'fail', message: 'Invalid email or password.' });
        }

        if (teacher.status === 'Pending') {
            return res.status(403).json({ status: 'fail', message: 'Your account is pending Admin approval.' });
        }

        if (teacher.status !== 'Active') {
            return res.status(403).json({ status: 'fail', message: 'Your account has been deactivated or rejected by administration.' });
        }

        if (!isMatch) {
            return res.status(401).json({ status: 'fail', message: 'Invalid credentials.' });
        }

        const token = generateToken(teacher.id, 'Teacher', teacher.email);

        res.status(200).json({
            status: 'success',
            message: 'Teacher authentication successful.',
            token,
            user: {
                id: teacher.id,
                employee_id: teacher.employee_id,
                name: teacher.name,
                email: teacher.email,
                role: 'Teacher',
                department_id: teacher.department_id,
                profile_pic: teacher.profile_pic
            }
        });
    } catch (error) {
        console.error('Teacher Login Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error during teacher authentication.' });
    }
};

/**
 * Student Register Handler (Self-Registration)
 * POST /api/auth/student/register
 */
exports.studentRegister = async (req, res) => {
    const { enrollment_no, roll_no, name, email, password, phone, section_id, course_id } = req.body;

    // Strict Validation
    if (!enrollment_no || !name || !email || !password) {
        return res.status(400).json({
            status: 'fail',
            message: 'Validation Error: Enrollment Number, Name, Email, and Password are required.'
        });
    }

    try {
        const parsedSectionId = section_id ? parseInt(section_id, 10) : null;
        const parsedCourseId = course_id ? parseInt(course_id, 10) : null;

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.query(
            `INSERT INTO Students (enrollment_no, roll_no, name, email, password, phone, section_id, course_id, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
            [
                enrollment_no.trim(),
                roll_no ? roll_no.trim() : null,
                name.trim(),
                email.trim().toLowerCase(),
                hashedPassword,
                phone ? phone.trim() : null,
                parsedSectionId,
                parsedCourseId
            ]
        );

        res.status(201).json({
            status: 'success',
            message: 'Registration successful. Your account is pending Admin approval.'
        });
    } catch (error) {
        console.error('Student Register Error:', error.message);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ status: 'fail', message: 'An account with this Email or Enrollment Number already exists.' });
        }
        if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_NO_REFERENCED_ROW') {
            return res.status(400).json({ status: 'fail', message: 'Selected Section or Course ID does not exist in database.' });
        }
        res.status(500).json({ status: 'error', message: 'Internal server error during student registration.' });
    }
};

/**
 * Student Login Handler
 * POST /api/auth/student/login
 */
exports.studentLogin = async (req, res) => {
    const { enrollment_no, password } = req.body;

    if (!enrollment_no || !password) {
        return res.status(400).json({ status: 'fail', message: 'Enrollment Number/Email and password are required.' });
    }

    try {
        const [rows] = await pool.query(
            'SELECT * FROM Students WHERE enrollment_no = ? OR email = ?',
            [enrollment_no.trim(), enrollment_no.trim()]
        );

        if (rows.length === 0) {
            return res.status(401).json({ status: 'fail', message: 'Invalid credentials.' });
        }

        const student = rows[0];

        if (student.status === 'Pending') {
            return res.status(403).json({ status: 'fail', message: 'Your account is pending Admin approval.' });
        }

        if (student.status !== 'Active') {
            return res.status(403).json({ status: 'fail', message: 'Account is inactive. Please contact administration.' });
        }

        const isMatch = await bcrypt.compare(password, student.password);

        if (!isMatch) {
            return res.status(401).json({ status: 'fail', message: 'Invalid credentials.' });
        }

        const token = generateToken(student.id, 'Student', student.email);

        res.status(200).json({
            status: 'success',
            message: 'Student authentication successful.',
            token,
            user: {
                id: student.id,
                enrollment_no: student.enrollment_no,
                roll_no: student.roll_no,
                name: student.name,
                email: student.email,
                role: 'Student',
                section_id: student.section_id,
                course_id: student.course_id,
                semester_id: student.semester_id,
                profile_pic: student.profile_pic
            }
        });
    } catch (error) {
        console.error('Student Login Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error during student authentication.' });
    }
};
