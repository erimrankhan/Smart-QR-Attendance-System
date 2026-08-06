const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('../config/db');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../uploads/materials');
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
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `material-${uniqueSuffix}${ext}`);
    }
});

// Multer File Filter (.pdf, .ppt, .pptx, .doc, .docx)
const fileFilter = (req, file, cb) => {
    const allowedExtensions = ['.pdf', '.ppt', '.pptx', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file format. Only PDF, PPT, and DOC files are permitted.'), false);
    }
};

// Export Multer upload middleware instance
exports.uploadMiddleware = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 } // 50 MB limit
});

/**
 * Upload New Study Material (Faculty Only)
 * POST /api/materials/upload
 */
exports.uploadMaterial = async (req, res) => {
    const { title, course_id, semester_id, subject_id } = req.body;
    const faculty_id = req.user ? req.user.id : req.body.faculty_id;

    if (!title || !course_id || !semester_id || !subject_id) {
        return res.status(400).json({
            status: 'fail',
            message: 'Validation Error: Title, Course, Semester, and Subject are required.'
        });
    }

    if (!req.file) {
        return res.status(400).json({
            status: 'fail',
            message: 'Please attach a document file (PDF, PPT, or DOC).'
        });
    }

    try {
        const relativePath = `/uploads/materials/${req.file.filename}`;

        const [result] = await pool.query(
            `INSERT INTO StudyMaterials (faculty_id, course_id, semester_id, subject_id, title, file_path)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [faculty_id, parseInt(course_id, 10), parseInt(semester_id, 10), parseInt(subject_id, 10), title.trim(), relativePath]
        );

        const host = `${req.protocol}://${req.get('host')}`;

        res.status(201).json({
            status: 'success',
            message: 'Study material uploaded successfully!',
            data: {
                id: result.insertId,
                title: title.trim(),
                file_path: relativePath,
                download_url: `${host}${relativePath}`,
                upload_date: new Date()
            }
        });
    } catch (error) {
        console.error('Upload Study Material Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error while uploading study material.'
        });
    }
};

/**
 * Fetch Study Materials for Students by Course and Semester
 * GET /api/materials/student
 */
exports.getStudentMaterials = async (req, res) => {
    // Extract course_id & semester_id from JWT user object or query parameters
    const course_id = req.query.course_id || (req.user && req.user.course_id);
    const semester_id = req.query.semester_id || (req.user && req.user.semester_id);

    if (!course_id || !semester_id) {
        return res.status(400).json({
            status: 'fail',
            message: 'Both course_id and semester_id are required to fetch relevant study materials.'
        });
    }

    try {
        const [materials] = await pool.query(`
            SELECT 
                sm.id,
                sm.title,
                sm.file_path,
                sm.upload_date,
                s.name AS subject_name,
                s.code AS subject_code,
                t.name AS faculty_name,
                c.name AS course_name,
                sem.semester_number
            FROM StudyMaterials sm
            JOIN Subjects s ON sm.subject_id = s.id
            JOIN Teachers t ON sm.faculty_id = t.id
            JOIN Courses c ON sm.course_id = c.id
            JOIN Semesters sem ON sm.semester_id = sem.id
            WHERE sm.course_id = ? AND sm.semester_id = ?
            ORDER BY sm.id DESC
        `, [parseInt(course_id, 10), parseInt(semester_id, 10)]);

        const host = `${req.protocol}://${req.get('host')}`;
        const formattedMaterials = materials.map(m => ({
            ...m,
            download_url: `${host}${m.file_path}`
        }));

        res.status(200).json({
            status: 'success',
            data: formattedMaterials
        });
    } catch (error) {
        console.error('Get Student Materials Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error while fetching study materials.'
        });
    }
};

/**
 * Helper: Fetch all Courses for Cascading Dropdown
 * GET /api/materials/courses
 */
exports.getCourses = async (req, res) => {
    try {
        const [courses] = await pool.query('SELECT id, name, code FROM Courses ORDER BY name ASC');
        res.status(200).json({ status: 'success', data: courses });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

/**
 * Helper: Fetch Semesters for a specific Course
 * GET /api/materials/semesters/:course_id
 */
exports.getSemestersByCourse = async (req, res) => {
    const { course_id } = req.params;
    try {
        const [semesters] = await pool.query(
            'SELECT id, semester_number FROM Semesters WHERE course_id = ? ORDER BY semester_number ASC',
            [course_id]
        );
        res.status(200).json({ status: 'success', data: semesters });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

/**
 * Helper: Fetch Subjects for a specific Course and Semester
 * GET /api/materials/subjects/:course_id/:semester_id
 */
exports.getSubjectsByCourseAndSemester = async (req, res) => {
    const { course_id, semester_id } = req.params;
    try {
        const [subjects] = await pool.query(
            'SELECT id, name, code FROM Subjects WHERE course_id = ? AND semester_id = ? ORDER BY name ASC',
            [course_id, semester_id]
        );
        res.status(200).json({ status: 'success', data: subjects });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};
