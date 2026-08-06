-- ============================================================================
-- SMART QR ATTENDANCE SYSTEM - COMPLETE 14-TABLE DATABASE SCHEMA
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `college_attendance_system` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `college_attendance_system`;

-- 1. Departments Table
CREATE TABLE IF NOT EXISTS `Departments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(20) UNIQUE NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_dept_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Admins Table
CREATE TABLE IF NOT EXISTS `Admins` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) UNIQUE NOT NULL,
    `email` VARCHAR(100) UNIQUE NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `profile_pic` VARCHAR(255) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_admin_username` (`username`),
    INDEX `idx_admin_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Courses Table
CREATE TABLE IF NOT EXISTS `Courses` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `department_id` INT DEFAULT NULL,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(50) UNIQUE NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_courses_department` FOREIGN KEY (`department_id`) REFERENCES `Departments`(`id`) ON DELETE SET NULL,
    INDEX `idx_course_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Semesters Table
CREATE TABLE IF NOT EXISTS `Semesters` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `course_id` INT NOT NULL,
    `semester_number` INT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_semesters_course` FOREIGN KEY (`course_id`) REFERENCES `Courses`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Sections Table
CREATE TABLE IF NOT EXISTS `Sections` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `semester_id` INT DEFAULT NULL,
    `name` VARCHAR(50) NOT NULL,
    `department_id` INT DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_sections_semester` FOREIGN KEY (`semester_id`) REFERENCES `Semesters`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_sections_department` FOREIGN KEY (`department_id`) REFERENCES `Departments`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Subjects Table
CREATE TABLE IF NOT EXISTS `Subjects` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `department_id` INT DEFAULT NULL,
    `course_id` INT DEFAULT NULL,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(50) UNIQUE NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_subjects_department` FOREIGN KEY (`department_id`) REFERENCES `Departments`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_subjects_course` FOREIGN KEY (`course_id`) REFERENCES `Courses`(`id`) ON DELETE SET NULL,
    INDEX `idx_subject_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Teachers Table
CREATE TABLE IF NOT EXISTS `Teachers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `employee_id` VARCHAR(50) UNIQUE NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(100) UNIQUE NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(20) DEFAULT NULL,
    `department_id` INT DEFAULT NULL,
    `status` ENUM('Active', 'Inactive') DEFAULT 'Active',
    `profile_pic` VARCHAR(255) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_teachers_department` FOREIGN KEY (`department_id`) REFERENCES `Departments`(`id`) ON DELETE SET NULL,
    INDEX `idx_teacher_emp_id` (`employee_id`),
    INDEX `idx_teacher_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Students Table
CREATE TABLE IF NOT EXISTS `Students` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `enrollment_no` VARCHAR(50) UNIQUE NOT NULL,
    `roll_no` VARCHAR(50) DEFAULT NULL,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(100) UNIQUE NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(20) DEFAULT NULL,
    `section_id` INT DEFAULT NULL,
    `status` ENUM('Active', 'Inactive') DEFAULT 'Active',
    `profile_pic` VARCHAR(255) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_students_section` FOREIGN KEY (`section_id`) REFERENCES `Sections`(`id`) ON DELETE SET NULL,
    INDEX `idx_student_enrollment` (`enrollment_no`),
    INDEX `idx_student_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Classes Table
CREATE TABLE IF NOT EXISTS `Classes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `teacher_id` INT NOT NULL,
    `subject_id` INT NOT NULL,
    `section_id` INT DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_classes_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `Teachers`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_classes_subject` FOREIGN KEY (`subject_id`) REFERENCES `Subjects`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_classes_section` FOREIGN KEY (`section_id`) REFERENCES `Sections`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Timetable Table
CREATE TABLE IF NOT EXISTS `Timetable` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `class_id` INT NOT NULL,
    `day_of_week` ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday') NOT NULL,
    `start_time` TIME NOT NULL,
    `end_time` TIME NOT NULL,
    `room_number` VARCHAR(30) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_timetable_class` FOREIGN KEY (`class_id`) REFERENCES `Classes`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. AttendanceSessions Table
CREATE TABLE IF NOT EXISTS `AttendanceSessions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `class_id` INT NOT NULL,
    `teacher_id` INT NOT NULL,
    `qr_code_hash` VARCHAR(255) UNIQUE NOT NULL,
    `status` ENUM('Active', 'Closed', 'Expired') DEFAULT 'Active',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `expires_at` DATETIME NOT NULL,
    CONSTRAINT `fk_sessions_class` FOREIGN KEY (`class_id`) REFERENCES `Classes`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_sessions_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `Teachers`(`id`) ON DELETE CASCADE,
    INDEX `idx_session_hash` (`qr_code_hash`),
    INDEX `idx_session_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. Attendance Table
CREATE TABLE IF NOT EXISTS `Attendance` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `session_id` INT NOT NULL,
    `student_id` INT NOT NULL,
    `status` ENUM('Present', 'Absent') DEFAULT 'Present',
    `scanned_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `unique_session_student` UNIQUE (`session_id`, `student_id`),
    CONSTRAINT `fk_attendance_session` FOREIGN KEY (`session_id`) REFERENCES `AttendanceSessions`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_attendance_student` FOREIGN KEY (`student_id`) REFERENCES `Students`(`id`) ON DELETE CASCADE,
    INDEX `idx_attendance_student` (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. Notifications Table
CREATE TABLE IF NOT EXISTS `Notifications` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `user_role` ENUM('Admin', 'Teacher', 'Student') NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `message` TEXT NOT NULL,
    `is_read` TINYINT DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_notif_user` (`user_id`, `user_role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 14. AuditLogs Table
CREATE TABLE IF NOT EXISTS `AuditLogs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT DEFAULT NULL,
    `user_role` VARCHAR(50) DEFAULT NULL,
    `action` VARCHAR(100) NOT NULL,
    `details` TEXT DEFAULT NULL,
    `ip_address` VARCHAR(45) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 15. SystemSettings Table
CREATE TABLE IF NOT EXISTS `SystemSettings` (
    `id` INT PRIMARY KEY DEFAULT 1,
    `college_name` VARCHAR(255) NOT NULL DEFAULT 'Smart Institute of Technology',
    `academic_session` VARCHAR(50) NOT NULL DEFAULT '2025 - 2026',
    `qr_expiry_seconds` INT NOT NULL DEFAULT 60,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `check_single_row` CHECK (`id` = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `SystemSettings` (`id`, `college_name`, `academic_session`, `qr_expiry_seconds`) 
VALUES (1, 'Smart Institute of Technology', '2025 - 2026', 60);
