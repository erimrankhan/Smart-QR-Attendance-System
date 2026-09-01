const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();
const path = require('path');

const db = require('./src/config/db');

// Route Imports
const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const teacherRoutes = require('./src/routes/teacherRoutes');
const studentRoutes = require('./src/routes/studentRoutes');
const reportRoutes = require('./src/routes/reportRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const resourceRoutes = require('./src/routes/resourceRoutes');

const app = express();

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(helmet()); 
app.use(cors({ origin: true, credentials: true }));
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev')); 

app.get('/', (req, res) => {
    res.send('Smart QR Attendance Backend API Running');
});

// Route Mounts
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/resources', resourceRoutes);

// Public API: Courses
app.get('/api/public/courses', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, name, code, duration_years FROM Courses ORDER BY name ASC');
        res.status(200).json({ status: 'success', success: true, data: rows });
    } catch (error) {
        res.status(500).json({ status: 'error', success: false, message: error.message });
    }
});

// Public API: Sections
app.get('/api/public/sections/:course_id', async (req, res) => {
    const { course_id } = req.params;
    try {
        const [rows] = await db.query(`
            SELECT DISTINCT sec.id, sec.name, sec.name AS section_name, sec.semester_id,
                   sem.semester_number, c.name AS course_name, c.code AS course_code
            FROM Sections sec
            LEFT JOIN Semesters sem ON sec.semester_id = sem.id
            LEFT JOIN Courses c ON sem.course_id = c.id
            WHERE sem.course_id = ? 
               OR (sec.semester_id IS NULL AND sec.department_id = (SELECT department_id FROM Courses WHERE id = ?))
            ORDER BY sem.semester_number ASC, sec.name ASC
        `, [course_id, course_id]);
        res.status(200).json({ status: 'success', success: true, data: rows });
    } catch (error) {
        res.status(500).json({ status: 'error', success: false, message: error.message });
    }
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ status: 'error', message: 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});