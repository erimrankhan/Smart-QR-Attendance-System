-- Smart QR Attendance System - Force Reset Courses Table

USE college_attendance_system;

-- 1. Temporarily disable Foreign Key Checks
SET FOREIGN_KEY_CHECKS=0;

-- 2. Forcefully drop existing Courses table
DROP TABLE IF EXISTS Courses;

-- 3. Recreate Courses table with exact schema & column ordering
CREATE TABLE Courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    department_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    duration_years INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES Departments(id) ON DELETE CASCADE
);

-- 4. Re-enable Foreign Key Checks
SET FOREIGN_KEY_CHECKS=1;

-- 5. Confirm Schema
DESCRIBE Courses;
