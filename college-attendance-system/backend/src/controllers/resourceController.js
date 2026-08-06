const path = require('path');
const multer = require('multer');
const pool = require('../config/db');

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `file-${uniqueSuffix}${ext}`);
    }
});

// Multer File Filter (.pdf, .doc, .docx only)
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file format. Only .pdf, .doc, and .docx files are permitted.'), false);
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
        return res.status(400).json({ status: 'fail', message: 'Please upload a PDF or DOC file.' });
    }

    try {
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
        const [resources] = await pool.query(`
            SELECT r.id, r.title, r.file_path, r.resource_type, r.created_at,
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
            downloadUrl: `${host}${r.file_path}`
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
 * Fetch All Resources for Student's Enrolled Classes
 * GET /api/resources/my-resources
 */
exports.getStudentResources = async (req, res) => {
    const student_id = req.user.id;

    try {
        const [resources] = await pool.query(`
            SELECT r.id, r.title, r.file_path, r.resource_type, r.created_at,
                   t.name AS teacher_name, sub.name AS subject_name, sub.code AS subject_code
            FROM Resources r
            JOIN Teachers t ON r.teacher_id = t.id
            JOIN Classes c ON r.class_id = c.id
            JOIN Subjects sub ON c.subject_id = sub.id
            LEFT JOIN Students st ON st.id = ?
            WHERE c.section_id IS NULL OR c.section_id = st.section_id
            ORDER BY r.id DESC
        `, [student_id]);

        const host = `${req.protocol}://${req.get('host')}`;
        const formatted = resources.map(r => ({
            ...r,
            downloadUrl: `${host}${r.file_path}`
        }));

        res.status(200).json({
            status: 'success',
            data: formatted
        });
    } catch (error) {
        console.error('Get Student Resources Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while fetching student study materials.' });
    }
};
