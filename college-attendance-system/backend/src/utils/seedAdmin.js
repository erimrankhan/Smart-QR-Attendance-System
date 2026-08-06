const bcrypt = require('bcrypt');
const pool = require('../config/db');

async function seedAdmin() {
    try {
        const username = 'admin';
        const email = 'admin@college.edu';
        const plainPassword = 'AdminPassword123!';

        // Check if admin user already exists
        const [existing] = await pool.query(
            'SELECT id FROM Admins WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existing.length > 0) {
            console.log('ℹ️ Default Admin user already exists in database.');
            process.exit(0);
        }

        // Hash password with 10 salt rounds
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

        // Insert Admin Account
        await pool.query(
            'INSERT INTO Admins (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword]
        );

        console.log('✅ Default Super Admin Created Successfully!');
        console.log('------------------------------------');
        console.log(`Username : ${username}`);
        console.log(`Email    : ${email}`);
        console.log(`Password : ${plainPassword}`);
        console.log('------------------------------------');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding Super Admin account:', error.message);
        process.exit(1);
    }
}

seedAdmin();
