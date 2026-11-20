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
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    // SSL connection for TiDB Cloud (TLS 1.2+)
    ssl: (process.env.DB_SSL === 'true' || (process.env.DB_HOST && !['localhost', '127.0.0.1'].includes(process.env.DB_HOST))) ? {
        minVersion: 'TLSv1.2',
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