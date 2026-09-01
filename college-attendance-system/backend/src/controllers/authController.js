const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const pool = require('../config/db');

// In-Memory OTP Store: Map<normalizedEmail, { otp, expiresAt, verified }>
const otpStore = new Map();

/**
 * Configure Nodemailer Transporter
 */
const getEmailTransporter = () => {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!user || !pass) {
        return null;
    }

    return nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
            user: user,
            pass: pass
        }
    });
};

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
    const { enrollment_no, roll_no, name, email, password, phone, section_id, course_id, semester_id, semester } = req.body;

    // Strict Validation
    if (!enrollment_no || !name || !email || !password) {
        return res.status(400).json({
            status: 'fail',
            message: 'Validation Error: Enrollment Number, Name, Email, and Password are required.'
        });
    }

    try {
        let parsedSectionId = null;
        if (section_id !== undefined && section_id !== null && section_id !== '') {
            if (!isNaN(parseInt(section_id, 10))) {
                parsedSectionId = parseInt(section_id, 10);
            } else if (typeof section_id === 'string') {
                const [foundSec] = await pool.query('SELECT id FROM Sections WHERE name = ? LIMIT 1', [section_id.trim()]);
                if (foundSec.length > 0) {
                    parsedSectionId = foundSec[0].id;
                }
            }
        }

        const parsedCourseId = (course_id && !isNaN(parseInt(course_id, 10))) ? parseInt(course_id, 10) : null;
        const parsedSemesterId = (semester_id || semester) && !isNaN(parseInt(semester_id || semester, 10)) ? parseInt(semester_id || semester, 10) : 1;

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.query(
            `INSERT INTO Students (enrollment_no, roll_no, name, email, password, phone, section_id, course_id, semester_id, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
            [
                enrollment_no.trim(),
                roll_no ? roll_no.trim() : null,
                name.trim(),
                email.trim().toLowerCase(),
                hashedPassword,
                phone ? phone.trim() : null,
                parsedSectionId,
                parsedCourseId,
                parsedSemesterId
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

/**
 * Send OTP to Student or Faculty Email for Registration Verification
 * POST /api/auth/send-otp
 */
exports.sendOtp = async (req, res) => {
    const { email, role } = req.body;

    if (!email || !email.trim()) {
        return res.status(400).json({ status: 'fail', message: 'Email address is required to send OTP.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ status: 'fail', message: 'Invalid email address format.' });
    }

    const isFaculty = role === 'faculty' || role === 'teacher';
    const roleTitle = isFaculty ? 'Faculty Member' : 'Student';
    const portalName = isFaculty ? 'Faculty Portal' : 'Student Portal';

    try {
        // 1. Check if email already belongs to a registered user
        const checkTable = isFaculty ? 'Teachers' : 'Students';
        const [existing] = await pool.query(
            `SELECT id, status FROM ${checkTable} WHERE email = ?`,
            [normalizedEmail]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                status: 'fail',
                message: `An account with this email address already exists in the ${portalName}. Please sign in instead.`
            });
        }

        // 2. Generate 6-Digit Cryptographically Random Numeric OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 Minutes validity

        otpStore.set(normalizedEmail, {
            otp,
            expiresAt,
            verified: false,
            role: isFaculty ? 'Faculty' : 'Student'
        });

        // 3. Attempt to send via Nodemailer if configured
        const transporter = getEmailTransporter();
        if (transporter) {
            const mailOptions = {
                from: `"Smart QR Attendance System" <${process.env.EMAIL_USER}>`,
                to: normalizedEmail,
                subject: `Verification Code - Smart QR ${isFaculty ? 'Faculty' : 'Student'} Registration: ${otp}`,
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 540px; margin: auto; padding: 28px; background: #0f172a; border-radius: 16px; color: #f8fafc; border: 1px solid rgba(255,255,255,0.1);">
                        <div style="text-align: center; margin-bottom: 24px;">
                            <h2 style="color: ${isFaculty ? '#0d9488' : '#6366f1'}; margin: 0; font-size: 24px; font-weight: 800;">Smart QR Attendance</h2>
                            <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">${portalName} Email Verification</p>
                        </div>
                        <div style="background: rgba(30, 41, 59, 0.7); border-radius: 12px; padding: 20px; text-align: center; border: 1px solid rgba(255,255,255,0.08);">
                            <p style="color: #cbd5e1; font-size: 14px; margin-bottom: 12px;">Hello ${roleTitle}, your one-time verification code is:</p>
                            <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: ${isFaculty ? '#2dd4bf' : '#38bdf8'}; background: #0b1329; padding: 12px 20px; border-radius: 8px; display: inline-block; border: 1px solid rgba(45, 212, 191, 0.3);">
                                ${otp}
                            </div>
                            <p style="color: #94a3b8; font-size: 12px; margin-top: 14px;">⏱ Valid for <strong>10 minutes</strong>. Do not share this code with anyone.</p>
                        </div>
                        <p style="color: #64748b; font-size: 11px; text-align: center; margin-top: 20px;">If you did not request this OTP, please ignore this email.</p>
                    </div>
                `
            };

            await transporter.sendMail(mailOptions);
            console.log(`✅ [OTP] Successfully dispatched ${portalName} OTP email to: ${normalizedEmail}`);
        } else {
            console.log(`⚠️ [EMAIL NOT CONFIGURED / DEV MODE] Real-time OTP for ${normalizedEmail} (${portalName}) is: ${otp}`);
        }

        return res.status(200).json({
            status: 'success',
            success: true,
            message: `Verification OTP has been sent to your email address (${normalizedEmail}).`
        });
    } catch (error) {
        console.error('Send OTP Error:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to send OTP email. Please try again.'
        });
    }
};

/**
 * Verify OTP
 * POST /api/auth/verify-otp
 */
exports.verifyOtp = async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ status: 'fail', message: 'Email and 6-digit OTP code are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const stored = otpStore.get(normalizedEmail);

    if (!stored) {
        return res.status(400).json({
            status: 'fail',
            message: 'No active OTP found for this email. Please click "Send OTP" first.'
        });
    }

    if (Date.now() > stored.expiresAt) {
        otpStore.delete(normalizedEmail);
        return res.status(400).json({
            status: 'fail',
            message: 'OTP has expired. Please request a new verification code.'
        });
    }

    if (stored.otp !== String(otp).trim()) {
        return res.status(400).json({
            status: 'fail',
            message: 'Incorrect OTP entered. Please check your email and try again.'
        });
    }

    // Mark as verified
    stored.verified = true;

    return res.status(200).json({
        status: 'success',
        message: 'Email address verified successfully!'
    });
};
