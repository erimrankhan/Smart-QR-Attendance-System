const mysql = require('mysql2/promise');
require('dotenv').config();

async function initDb() {
    try {
        console.log('🔄 Initializing MySQL Database & 14 Core Tables...');

        // 1. Create Connection without database selected (with SSL support for Cloud DBs)
        const isLocal = !process.env.DB_HOST || process.env.DB_HOST === 'localhost' || process.env.DB_HOST === '127.0.0.1';
        
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            ssl: isLocal ? false : { rejectUnauthorized: false }
        });

        const dbName = process.env.DB_NAME || 'college_attendance_system';
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        console.log(`✅ Database '${dbName}' ready.`);
        await connection.end();

        // 2. Connect using pool
        const pool = require('../config/db');

        // Disable Foreign Key checks before creating tables
        await pool.query('SET FOREIGN_KEY_CHECKS = 0;');

        // 1. Departments
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Departments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                code VARCHAR(20) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Departments table ready.');

        // 2. Admins
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Admins (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                profile_pic VARCHAR(255) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Admins table ready.');

        // 3. Courses
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Courses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                department_id INT DEFAULT NULL,
                name VARCHAR(255) NOT NULL,
                code VARCHAR(100) UNIQUE NOT NULL,
                duration_years INT NOT NULL DEFAULT 4,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (department_id) REFERENCES Departments(id) ON DELETE CASCADE
            );
        `);
        try {
            await pool.query("ALTER TABLE Courses ADD COLUMN duration_years INT NOT NULL DEFAULT 4 AFTER code");
        } catch (e) {}
        console.log('✅ Courses table ready.');

        // 4. Semesters
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Semesters (
                id INT AUTO_INCREMENT PRIMARY KEY,
                course_id INT NOT NULL,
                semester_number INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (course_id) REFERENCES Courses(id) ON DELETE CASCADE
            );
        `);
        console.log('✅ Semesters table ready.');

        // 5. Sections
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Sections (
                id INT AUTO_INCREMENT PRIMARY KEY,
                semester_id INT DEFAULT NULL,
                name VARCHAR(50) NOT NULL,
                department_id INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (semester_id) REFERENCES Semesters(id) ON DELETE SET NULL,
                FOREIGN KEY (department_id) REFERENCES Departments(id) ON DELETE SET NULL
            );
        `);
        console.log('✅ Sections table ready.');

        // 6. Subjects
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Subjects (
                id INT AUTO_INCREMENT PRIMARY KEY,
                department_id INT DEFAULT NULL,
                course_id INT DEFAULT NULL,
                semester_id INT DEFAULT NULL,
                name VARCHAR(100) NOT NULL,
                code VARCHAR(50) UNIQUE NOT NULL,
                type ENUM('Theory', 'Practical') DEFAULT 'Theory',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (department_id) REFERENCES Departments(id) ON DELETE SET NULL,
                FOREIGN KEY (course_id) REFERENCES Courses(id) ON DELETE SET NULL,
                FOREIGN KEY (semester_id) REFERENCES Semesters(id) ON DELETE SET NULL
            );
        `);
        try {
            await pool.query("ALTER TABLE Subjects ADD COLUMN semester_id INT DEFAULT NULL, ADD COLUMN type ENUM('Theory', 'Practical') DEFAULT 'Theory'");
        } catch (e) {}
        console.log('✅ Subjects table ready.');

        // 7. Teachers
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Teachers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                employee_id VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                phone VARCHAR(20) DEFAULT NULL,
                department_id INT DEFAULT NULL,
                status ENUM('Pending', 'Active', 'Inactive') DEFAULT 'Pending',
                profile_pic VARCHAR(255) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (department_id) REFERENCES Departments(id) ON DELETE SET NULL
            );
        `);
        try {
            await pool.query("ALTER TABLE Teachers MODIFY COLUMN status ENUM('Pending', 'Active', 'Inactive') DEFAULT 'Pending'");
        } catch (e) {}
        console.log('✅ Teachers table ready.');

        // 8. Students
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Students (
                id INT AUTO_INCREMENT PRIMARY KEY,
                enrollment_no VARCHAR(50) UNIQUE NOT NULL,
                roll_no VARCHAR(50) DEFAULT NULL,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                phone VARCHAR(20) DEFAULT NULL,
                section_id INT DEFAULT NULL,
                course_id INT DEFAULT NULL,
                semester_id INT DEFAULT NULL,
                status ENUM('Pending', 'Active', 'Inactive') DEFAULT 'Pending',
                profile_pic VARCHAR(255) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (section_id) REFERENCES Sections(id) ON DELETE SET NULL,
                FOREIGN KEY (course_id) REFERENCES Courses(id) ON DELETE SET NULL,
                FOREIGN KEY (semester_id) REFERENCES Semesters(id) ON DELETE SET NULL
            );
        `);
        try {
            await pool.query("ALTER TABLE Students MODIFY COLUMN status ENUM('Pending', 'Active', 'Inactive') DEFAULT 'Pending'");
        } catch (e) {}
        try {
            await pool.query("ALTER TABLE Students ADD COLUMN course_id INT DEFAULT NULL, ADD COLUMN semester_id INT DEFAULT NULL");
        } catch (e) {}
        console.log('✅ Students table ready.');

        // 9. Classes
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Classes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                teacher_id INT NOT NULL,
                subject_id INT NOT NULL,
                section_id INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (teacher_id) REFERENCES Teachers(id) ON DELETE CASCADE,
                FOREIGN KEY (subject_id) REFERENCES Subjects(id) ON DELETE CASCADE,
                FOREIGN KEY (section_id) REFERENCES Sections(id) ON DELETE SET NULL
            );
        `);
        console.log('✅ Classes table ready.');

        // 10. Timetable
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Timetable (
                id INT AUTO_INCREMENT PRIMARY KEY,
                class_id INT NOT NULL,
                day_of_week ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday') NOT NULL,
                start_time TIME NOT NULL,
                end_time TIME NOT NULL,
                room_number VARCHAR(30) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (class_id) REFERENCES Classes(id) ON DELETE CASCADE
            );
        `);
        console.log('✅ Timetable table ready.');

        // 11. AttendanceSessions
        await pool.query(`
            CREATE TABLE IF NOT EXISTS AttendanceSessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                class_id INT NOT NULL,
                teacher_id INT NOT NULL,
                qr_code_hash VARCHAR(255) UNIQUE NOT NULL,
                session_pin VARCHAR(8) NULL,
                status ENUM('Active', 'Closed', 'Expired') DEFAULT 'Active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                FOREIGN KEY (class_id) REFERENCES Classes(id) ON DELETE CASCADE,
                FOREIGN KEY (teacher_id) REFERENCES Teachers(id) ON DELETE CASCADE
            );
        `);
        console.log('✅ AttendanceSessions table ready.');

        // 12. Attendance
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Attendance (
                id INT AUTO_INCREMENT PRIMARY KEY,
                session_id INT NOT NULL,
                student_id INT NOT NULL,
                status ENUM('Present', 'Absent') DEFAULT 'Present',
                scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_session_student (session_id, student_id),
                FOREIGN KEY (session_id) REFERENCES AttendanceSessions(id) ON DELETE CASCADE,
                FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE
            );
        `);
        console.log('✅ Attendance table ready.');

        // 13. Notifications
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT DEFAULT NULL,
                user_role VARCHAR(50) DEFAULT 'Student',
                student_id INT DEFAULT NULL,
                title VARCHAR(150) DEFAULT 'Notification',
                message TEXT NOT NULL,
                type VARCHAR(30) DEFAULT 'info',
                is_read TINYINT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE
            );
        `);
        try {
            await pool.query("ALTER TABLE Notifications ADD COLUMN user_id INT DEFAULT NULL, ADD COLUMN user_role VARCHAR(50) DEFAULT 'Student', ADD COLUMN title VARCHAR(150) DEFAULT 'Notification', ADD COLUMN type VARCHAR(30) DEFAULT 'info', ADD COLUMN is_read TINYINT DEFAULT 0");
        } catch (e) {}
        console.log('✅ Notifications table ready.');

        // 14. AuditLogs
        await pool.query(`
            CREATE TABLE IF NOT EXISTS AuditLogs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT DEFAULT NULL,
                user_role VARCHAR(50) DEFAULT NULL,
                action VARCHAR(100) NOT NULL,
                details TEXT DEFAULT NULL,
                ip_address VARCHAR(45) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ AuditLogs table ready.');

        // 15. SystemSettings
        await pool.query(`
            CREATE TABLE IF NOT EXISTS SystemSettings (
                id INT PRIMARY KEY DEFAULT 1,
                college_name VARCHAR(255) DEFAULT 'Smart Institute of Technology & Science',
                academic_session VARCHAR(100) DEFAULT '2025 - 2026',
                qr_expiry_seconds INT DEFAULT 60,
                backup_auto_enabled BOOLEAN DEFAULT TRUE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        `);
        await pool.query(`
            INSERT IGNORE INTO SystemSettings (id, college_name, academic_session, qr_expiry_seconds) 
            VALUES (1, 'Smart Institute of Technology & Science', '2025 - 2026', 60);
        `);
        console.log('✅ SystemSettings table ready.');

        // 16. LeaveRequests
        await pool.query(`
            CREATE TABLE IF NOT EXISTS LeaveRequests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id INT NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                reason TEXT NOT NULL,
                status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
                admin_remark VARCHAR(255) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE
            );
        `);
        console.log('✅ LeaveRequests table ready.');

        // 17. StudyMaterials
        await pool.query(`
            CREATE TABLE IF NOT EXISTS StudyMaterials (
                id INT AUTO_INCREMENT PRIMARY KEY,
                faculty_id INT NOT NULL,
                course_id INT NOT NULL,
                semester_id INT NOT NULL,
                subject_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                file_path VARCHAR(255) NOT NULL,
                upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (faculty_id) REFERENCES Teachers(id) ON DELETE CASCADE,
                FOREIGN KEY (course_id) REFERENCES Courses(id) ON DELETE CASCADE,
                FOREIGN KEY (semester_id) REFERENCES Semesters(id) ON DELETE CASCADE,
                FOREIGN KEY (subject_id) REFERENCES Subjects(id) ON DELETE CASCADE
            );
        `);
        console.log('✅ StudyMaterials table ready.');

        // 18. Announcements
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Announcements (
                id INT AUTO_INCREMENT PRIMARY KEY,
                teacher_id INT NOT NULL,
                class_id INT DEFAULT NULL,
                title VARCHAR(255) DEFAULT NULL,
                message TEXT NOT NULL,
                type VARCHAR(50) DEFAULT 'info',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (teacher_id) REFERENCES Teachers(id) ON DELETE CASCADE
            );
        `);
        console.log('✅ Announcements table ready.');

        // Re-enable Foreign Key checks after creation
        await pool.query('SET FOREIGN_KEY_CHECKS = 1;');

        console.log('🎉 Database initialization complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Database Initialization Error:', error.message);
        process.exit(1);
    }
}

initDb();