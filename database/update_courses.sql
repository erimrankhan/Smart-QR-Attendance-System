-- Smart QR Attendance System - Courses Table Migration Script

USE college_attendance_system;

-- 1. Add missing 'duration_years' column directly after 'code'
ALTER TABLE Courses 
ADD COLUMN duration_years INT NOT NULL DEFAULT 1 AFTER code;

-- 2. Verify updated Courses schema
DESCRIBE Courses;
