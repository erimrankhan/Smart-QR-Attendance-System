const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const path = require('path');

// Import Database Connection
const db = require('./src/config/db');

// Import Routes
const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const teacherRoutes = require('./src/routes/teacherRoutes');
const studentRoutes = require('./src/routes/studentRoutes');
const reportRoutes = require('./src/routes/reportRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const resourceRoutes = require('./src/routes/resourceRoutes');
const materialRoutes = require('./src/routes/materialRoutes');
const publicRoutes = require('./src/routes/publicRoutes');

const app = express();

// Expose Uploads Directory for File Downloads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Security & Utility Middlewares
app.use(helmet()); // Protects against common web vulnerabilities
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:5500'],
    credentials: true
}));

app.use(express.json()); // Parses incoming JSON payloads
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev')); // Logs API requests to the terminal

// Health Check Route
app.get('/', (req, res) => {
    res.send('Smart QR Attendance Backend API');
});

// Route Mount Points
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/public', publicRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ status: 'error', message: 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
