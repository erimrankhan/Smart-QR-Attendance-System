const express = require('express');
const router = express.Router();
const db = require('../config/db');

/**
 * GET /api/public/courses
 * Description: Fetches all courses publicly (no auth required) for the registration dropdown
 */
router.get('/courses', async (req, res) => {
    try {
        const [courses] = await db.query('SELECT id, name, code, duration_years FROM Courses ORDER BY name ASC');
        res.status(200).json({ 
            status: 'success',
            success: true,
            data: courses,
            courses: courses
        });
    } catch (error) {
        console.error("Error fetching public courses:", error);
        res.status(500).json({ 
            status: 'error',
            success: false,
            message: 'Failed to fetch courses from the database' 
        });
    }
});

/**
 * GET /api/public/sections/:course_id
 * Description: Fetches sections belonging to a specific course (no auth required) for cascading dropdown
 */
router.get('/sections/:course_id', async (req, res) => {
    const { course_id } = req.params;
    try {
        const [sections] = await db.query(`
            SELECT DISTINCT sec.id, sec.name, sec.name AS section_name, sec.semester_id,
                   sem.semester_number, c.name AS course_name, c.code AS course_code
            FROM Sections sec
            LEFT JOIN Semesters sem ON sec.semester_id = sem.id
            LEFT JOIN Courses c ON sem.course_id = c.id
            WHERE sem.course_id = ? 
               OR (sec.semester_id IS NULL AND sec.department_id = (SELECT department_id FROM Courses WHERE id = ?))
            ORDER BY sem.semester_number ASC, sec.name ASC
        `, [course_id, course_id]);

        res.status(200).json({
            status: 'success',
            success: true,
            data: sections,
            sections: sections
        });
    } catch (error) {
        console.error('Error fetching public sections for course:', error);
        res.status(500).json({
            status: 'error',
            success: false,
            message: 'Failed to fetch sections for the selected course'
        });
    }
});

module.exports = router;
