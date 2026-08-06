-- ============================================================================
-- RESOURCE SHARING MODULE - DATABASE UPDATE SCRIPT
-- ============================================================================

USE `college_attendance_system`;

-- Create Resources Table
CREATE TABLE IF NOT EXISTS `Resources` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `teacher_id` INT NOT NULL,
    `class_id` INT NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `file_path` VARCHAR(255) NOT NULL,
    `resource_type` VARCHAR(50) DEFAULT 'document',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_resources_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `Teachers`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_resources_class` FOREIGN KEY (`class_id`) REFERENCES `Classes`(`id`) ON DELETE CASCADE,
    INDEX `idx_resource_class` (`class_id`),
    INDEX `idx_resource_teacher` (`teacher_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
