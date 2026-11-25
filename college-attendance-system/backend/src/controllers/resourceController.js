const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('../config/db');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Memoized helper to auto-create Resources table if missing in database
let resourcesTableInitPromise = null;
const ensureResourcesTable = () => {
    if (!resourcesTableInitPromise) {
        resourcesTableInitPromise = pool.query(`
            CREATE TABLE IF NOT EXISTS Resources (
                id INT AUTO_INCREMENT PRIMARY KEY,
                teacher_id INT NOT NULL,
                class_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                resource_type VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `).catch(err => {
            resourcesTableInitPromise = null;
            console.error('Resources Table Init Warning:', err.message);
        });
    }
    return resourcesTableInitPromise;
};

// Initialize table on startup
ensureResourcesTable();

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `file-${uniqueSuffix}${ext}`);
    }
});

// Multer File Filter (.pdf, .doc, .docx, .ppt, .pptx only)
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.ppt', '.pptx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file format. Only .pdf, .doc, .docx, .ppt, and .pptx files are permitted.'), false);
    }
};

// Export multer middleware instance
exports.uploadMiddleware = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 25 * 1024 * 1024 } // 25 MB Limit
});

/**
 * Upload New Study Resource / Assignment (Teacher Only)
 * POST /api/resources/upload
 */
exports.uploadResource = async (req, res) => {
    const { class_id, title } = req.body;
    const teacher_id = req.user.id;

    if (!class_id || !title) {
        return res.status(400).json({ status: 'fail', message: 'Class ID and title are required.' });
    }

    if (!req.file) {
        return res.status(400).json({ status: 'fail', message: 'Please upload a valid document file.' });
    }

    try {
        await ensureResourcesTable();

        const relativePath = `/uploads/${req.file.filename}`;
        const downloadUrl = `${req.protocol}://${req.get('host')}${relativePath}`;
        const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');

        const [result] = await pool.query(
            'INSERT INTO Resources (teacher_id, class_id, title, file_path, resource_type) VALUES (?, ?, ?, ?, ?)',
            [teacher_id, class_id, title.trim(), relativePath, ext]
        );

        res.status(201).json({
            status: 'success',
            message: 'Resource uploaded successfully!',
            data: {
                id: result.insertId,
                title: title.trim(),
                downloadUrl,
                file_url: relativePath,
                file_path: relativePath,
                resource_type: ext,
                filename: req.file.filename,
                created_at: new Date()
            }
        });
    } catch (error) {
        console.error('Upload Resource Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while processing resource upload.' });
    }
};

/**
 * Fetch Resources for a Specific Class
 * GET /api/resources/class/:class_id
 */
exports.getClassResources = async (req, res) => {
    const { class_id } = req.params;

    try {
        await ensureResourcesTable();

        const [resources] = await pool.query(`
            SELECT r.id, r.title, r.file_path, r.resource_type, r.created_at,
                   r.created_at AS uploaded_at,
                   t.name AS teacher_name, sub.name AS subject_name, sub.code AS subject_code
            FROM Resources r
            JOIN Teachers t ON r.teacher_id = t.id
            JOIN Classes c ON r.class_id = c.id
            JOIN Subjects sub ON c.subject_id = sub.id
            WHERE r.class_id = ?
            ORDER BY r.id DESC
        `, [class_id]);

        const host = `${req.protocol}://${req.get('host')}`;
        const formatted = resources.map(r => ({
            ...r,
            file_url: r.file_path,
            downloadUrl: `${host}${r.file_path}`,
            download_url: `${host}${r.file_path}`
        }));

        res.status(200).json({
            status: 'success',
            data: formatted
        });
    } catch (error) {
        console.error('Get Class Resources Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching class resources.' });
    }
};

/**
 * Fetch All Resources Uploaded by Logged-in Teacher / Faculty
 * GET /api/resources/teacher-list
 */
exports.getTeacherResources = async (req, res) => {
    const teacher_id = req.user ? req.user.id : null;

    if (!teacher_id) {
        return res.status(401).json({ status: 'fail', message: 'Unauthorized teacher session.' });
    }

    try {
        await ensureResourcesTable();

        const [resources] = await pool.query(`
            SELECT r.id, r.title, r.file_path, r.resource_type, r.created_at,
                   r.created_at AS uploaded_at,
                   c.id AS class_id,
                   sub.name AS subject_name, sub.code AS subject_code,
                   sec.name AS section_name
            FROM Resources r
            JOIN Classes c ON r.class_id = c.id
            JOIN Subjects sub ON c.subject_id = sub.id
            LEFT JOIN Sections sec ON c.section_id = sec.id
            WHERE r.teacher_id = ?
            ORDER BY r.id DESC
        `, [teacher_id]);

        const host = `${req.protocol}://${req.get('host')}`;
        const formatted = resources.map(r => ({
            ...r,
            file_url: r.file_path,
            downloadUrl: `${host}${r.file_path}`,
            download_url: `${host}${r.file_path}`
        }));

        res.status(200).json({
            status: 'success',
            data: formatted
        });
    } catch (error) {
        console.error('Get Teacher Resources Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching teacher resources.' });
    }
};

/**
 * Fetch All Resources for Student's Enrolled Course and Semester
 * GET /api/resources/student/materials OR /api/resources/my-resources
 */
exports.getStudentMaterials = async (req, res) => {
    try {
        await ensureResourcesTable();

        const studentId = req.user ? (req.user.id || req.user.student_id) : null;
        let { course_id, semester_id } = req.query;

        // 1. Fetch student's course_id & semester_id from Students table if logged in and not supplied in query
        if (studentId && (!course_id || !semester_id)) {
            const [studentRows] = await pool.query(
                'SELECT id, course_id, semester_id, section_id FROM Students WHERE id = ?',
                [studentId]
            );

            if (studentRows.length > 0) {
                const student = studentRows[0];
                course_id = course_id || student.course_id;
                semester_id = semester_id || student.semester_id;

                // Fallback: If semester_id is not directly set on student, find it via student's section
                if (!semester_id && student.section_id) {
                    const [secRows] = await pool.query('SELECT semester_id FROM Sections WHERE id = ?', [student.section_id]);
                    if (secRows.length > 0 && secRows[0].semester_id) {
                        semester_id = secRows[0].semester_id;
                    }
                }

                // Fallback: If course_id is not directly set on student, find it via semester
                if (!course_id && semester_id) {
                    const [semRows] = await pool.query('SELECT course_id FROM Semesters WHERE id = ?', [semester_id]);
                    if (semRows.length > 0 && semRows[0].course_id) {
                        course_id = semRows[0].course_id;
                    }
                }
            }
        }

        // 2. Fetch Resources joined with Classes, Subjects, Teachers, Sections, and Semesters
        let query = `
            SELECT r.id, r.title, r.file_path, r.resource_type, r.created_at,
                   r.created_at AS uploaded_at,
                   t.name AS faculty_name, t.name AS teacher_name,
                   sub.name AS subject_name, sub.code AS subject_code,
                   c.id AS class_id,
                   sec.name AS section_name
            FROM Resources r
            JOIN Teachers t ON r.teacher_id = t.id
            JOIN Classes c ON r.class_id = c.id
            JOIN Subjects sub ON c.subject_id = sub.id
            LEFT JOIN Sections sec ON c.section_id = sec.id
            LEFT JOIN Semesters sem ON sub.semester_id = sem.id OR sec.semester_id = sem.id
            WHERE 1=1
        `;

        const queryParams = [];

        if (course_id) {
            query += ` AND (sub.course_id = ? OR sem.course_id = ?)`;
            queryParams.push(course_id, course_id);
        }

        if (semester_id) {
            query += ` AND (sub.semester_id = ? OR sec.semester_id = ? OR sem.id = ?)`;
            queryParams.push(semester_id, semester_id, semester_id);
        }

        query += ` ORDER BY r.id DESC`;

        const [materials] = await pool.query(query, queryParams);

        const host = `${req.protocol}://${req.get('host')}`;
        const formatted = materials.map(item => ({
            ...item,
            file_url: item.file_path,
            downloadUrl: `${host}${item.file_path}`,
            download_url: `${host}${item.file_path}`
        }));

        res.status(200).json({
            status: 'success',
            data: formatted
        });
    } catch (error) {
        console.error('Error fetching student materials:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};