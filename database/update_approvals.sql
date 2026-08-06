-- Smart QR Attendance System - Schema Update for Approval Workflow

USE college_attendance_system;

-- 1. Update Teachers table status column to include 'Pending' and set as DEFAULT
ALTER TABLE Teachers 
MODIFY COLUMN status ENUM('Pending', 'Active', 'Inactive') DEFAULT 'Pending';

-- 2. Update Students table status column to include 'Pending' and set as DEFAULT
ALTER TABLE Students 
MODIFY COLUMN status ENUM('Pending', 'Active', 'Inactive') DEFAULT 'Pending';
