const mysql = require('mysql2/promise');
const fs = require('fs');

async function dumpDatabase() {
    console.log('Connecting to Aiven Cloud Database...');
    const conn = await mysql.createConnection({
        host: 'mysql-qr-smart-qr-attendance-system.j.aivencloud.com',
        port: 19888,
        user: 'avnadmin',
        password: 'YOUR_AIVEN_PASSWORD_HERE', // <-- Yahan apna password paste karein
        database: 'defaultdb',
        ssl: { rejectUnauthorized: false }
    });

    console.log('Connected! Fetching tables...');
    const [tables] = await conn.query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"');
    
    let dump = 'SET FOREIGN_KEY_CHECKS=0;\n\n';

    for (let t of tables) {
        const tableName = Object.values(t)[0];
        console.log(`Exporting table: ${tableName}`);

        const [[schema]] = await conn.query(`SHOW CREATE TABLE \`${tableName}\``);
        dump += `DROP TABLE IF EXISTS \`${tableName}\`;\n${schema['Create Table']};\n\n`;

        const [rows] = await conn.query(`SELECT * FROM \`${tableName}\``);
        if (rows.length > 0) {
            for (let r of rows) {
                const cols = Object.keys(r).map(c => `\`${c}\``).join(', ');
                const vals = Object.values(r).map(v => {
                    if (v === null) return 'NULL';
                    if (typeof v === 'string') return conn.escape(v);
                    if (v instanceof Date) return conn.escape(v.toISOString().slice(0, 19).replace('T', ' '));
                    return v;
                }).join(', ');
                dump += `INSERT INTO \`${tableName}\` (${cols}) VALUES (${vals});\n`;
            }
            dump += '\n';
        }
    }

    dump += 'SET FOREIGN_KEY_CHECKS=1;\n';
    fs.writeFileSync('backup.sql', dump);
    console.log('✅ Done! backup.sql file create ho gayi hai.');
    await conn.end();
}

dumpDatabase().catch(err => console.error('Error:', err.message));