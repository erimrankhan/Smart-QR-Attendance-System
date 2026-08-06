const express = require('express');
const router = express.Router();
const db = require('../config/db');

/**
 * GET /api/public/courses
 * Description: Fetches all courses publicly (no auth required) for the registration form
 */
router.get('/courses', async (req, res) => {
    try {
        const [courses] = await db.execute('SELECT id, name, code FROM Courses ORDER BY name ASC');
        
        res.json({ 
            status: 'success', 
            data: courses 
        });
    } catch (error) {
        console.error("Error fetching public courses:", error);
        res.status(500).json({ 
            status: 'error', 
            message: 'Failed to fetch courses from the database' 
        });
    }
});

module.exports = router;
