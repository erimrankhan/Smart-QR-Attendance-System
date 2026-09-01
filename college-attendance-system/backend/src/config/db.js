const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'sql123',
    database: process.env.DB_NAME || 'college_attendance_system',
    timezone: '+05:30', // IST Timezone support fix
    dateStrings: true,  // Prevents Node.js from shifting dates to UTC
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Aiven Cloud MySQL requires SSL connection
    ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost' ? {
        rejectUnauthorized: false
    } : false
});

// Test connection on startup
pool.getConnection()
    .then(connection => {
        console.log('✅ MySQL Database Connected Successfully');
        connection.release();
    })
    .catch(err => {
        console.error('❌ MySQL Connection Error:', err.message);
    });

module.exports = pool;