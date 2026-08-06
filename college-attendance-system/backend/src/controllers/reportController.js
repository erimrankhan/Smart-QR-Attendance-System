const pool = require('../config/db');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

/**
 * Fetch Analytics Data for Chart.js Rendering
 * GET /api/reports/analytics
 */
exports.getSystemAnalytics = async (req, res) => {
    try {
        // 1. Daily Attendance Trends (Last 7 Days)
        const [dailyTrends] = await pool.query(`
            SELECT DATE_FORMAT(scanned_at, '%Y-%m-%d') AS date, COUNT(*) AS count
            FROM Attendance
            WHERE scanned_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY DATE_FORMAT(scanned_at, '%Y-%m-%d')
            ORDER BY date ASC
        `);

        // 2. Subject-wise Attendance Averages
        const [subjectAverages] = await pool.query(`
            SELECT sub.name AS subject_name, COUNT(a.id) AS total_present
            FROM Subjects sub
            JOIN Classes c ON sub.id = c.subject_id
            JOIN AttendanceSessions ses ON c.id = ses.class_id
            LEFT JOIN Attendance a ON ses.id = a.session_id AND a.status = 'Present'
            GROUP BY sub.id, sub.name
            ORDER BY total_present DESC
            LIMIT 6
        `);

        // 3. Present vs Absent Ratio Summary
        const [[{ totalPresent }]] = await pool.query("SELECT COUNT(*) AS totalPresent FROM Attendance WHERE status = 'Present'");
        const [[{ totalSessions }]] = await pool.query("SELECT COUNT(*) AS totalSessions FROM AttendanceSessions");
        const [[{ totalStudents }]] = await pool.query("SELECT COUNT(*) AS totalStudents FROM Students");

        const estimatedTotalScans = (totalSessions || 1) * (totalStudents || 1);
        const totalAbsent = Math.max(0, estimatedTotalScans - (totalPresent || 0));

        res.status(200).json({
            status: 'success',
            data: {
                dailyTrends: {
                    labels: dailyTrends.map(d => d.date),
                    data: dailyTrends.map(d => d.count)
                },
                subjectAverages: {
                    labels: subjectAverages.map(s => s.subject_name),
                    data: subjectAverages.map(s => s.total_present)
                },
                ratio: {
                    present: totalPresent || 0,
                    absent: totalAbsent || 0
                }
            }
        });
    } catch (error) {
        console.error('Get System Analytics Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while compiling analytics.' });
    }
};

/**
 * Export Attendance Records to Excel (.xlsx)
 * GET /api/reports/export/excel
 */
exports.exportAttendanceExcel = async (req, res) => {
    const { startDate, endDate, subject_id } = req.query;

    try {
        let sql = `
            SELECT a.id, a.scanned_at, a.status, 
                   s.name AS student_name, s.enrollment_no, s.roll_no,
                   sub.name AS subject_name, t.name AS teacher_name
            FROM Attendance a
            JOIN Students s ON a.student_id = s.id
            JOIN AttendanceSessions ses ON a.session_id = ses.id
            JOIN Classes c ON ses.class_id = c.id
            JOIN Subjects sub ON c.subject_id = sub.id
            JOIN Teachers t ON c.teacher_id = t.id
            WHERE 1=1
        `;

        const queryParams = [];

        if (startDate) {
            sql += ' AND a.scanned_at >= ?';
            queryParams.push(`${startDate} 00:00:00`);
        }
        if (endDate) {
            sql += ' AND a.scanned_at <= ?';
            queryParams.push(`${endDate} 23:59:59`);
        }
        if (subject_id) {
            sql += ' AND sub.id = ?';
            queryParams.push(subject_id);
        }

        sql += ' ORDER BY a.scanned_at DESC';

        const [rows] = await pool.query(sql, queryParams);

        // Build Excel Document using exceljs
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Attendance Report');

        // Header Formatting
        worksheet.columns = [
            { header: 'Record ID', key: 'id', width: 12 },
            { header: 'Date & Time', key: 'scanned_at', width: 22 },
            { header: 'Student Name', key: 'student_name', width: 25 },
            { header: 'Enrollment No', key: 'enrollment_no', width: 20 },
            { header: 'Subject', key: 'subject_name', width: 25 },
            { header: 'Teacher', key: 'teacher_name', width: 22 },
            { header: 'Status', key: 'status', width: 12 }
        ];

        // Apply Header Style
        const headerRow = worksheet.getRow(1);
        headerRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFF' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: '0F172A' }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        // Add Rows
        rows.forEach(r => {
            worksheet.addRow({
                id: r.id,
                scanned_at: new Date(r.scanned_at).toLocaleString(),
                student_name: r.student_name,
                enrollment_no: r.enrollment_no,
                subject_name: r.subject_name,
                teacher_name: r.teacher_name,
                status: r.status
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="attendance_report.xlsx"');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export Excel Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while exporting Excel report.' });
    }
};

/**
 * Export Attendance Records to PDF Document
 * GET /api/reports/export/pdf
 */
exports.exportAttendancePDF = async (req, res) => {
    const { startDate, endDate, subject_id } = req.query;

    try {
        let sql = `
            SELECT a.id, a.scanned_at, a.status, 
                   s.name AS student_name, s.enrollment_no,
                   sub.name AS subject_name, t.name AS teacher_name
            FROM Attendance a
            JOIN Students s ON a.student_id = s.id
            JOIN AttendanceSessions ses ON a.session_id = ses.id
            JOIN Classes c ON ses.class_id = c.id
            JOIN Subjects sub ON c.subject_id = sub.id
            JOIN Teachers t ON c.teacher_id = t.id
            WHERE 1=1
        `;

        const queryParams = [];

        if (startDate) {
            sql += ' AND a.scanned_at >= ?';
            queryParams.push(`${startDate} 00:00:00`);
        }
        if (endDate) {
            sql += ' AND a.scanned_at <= ?';
            queryParams.push(`${endDate} 23:59:59`);
        }
        if (subject_id) {
            sql += ' AND sub.id = ?';
            queryParams.push(subject_id);
        }

        sql += ' ORDER BY a.scanned_at DESC LIMIT 100';

        const [rows] = await pool.query(sql, queryParams);

        // Build PDF Document using pdfkit
        const doc = new PDFDocument({ margin: 40, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="attendance_report.pdf"');

        doc.pipe(res);

        // Document Title Banner
        doc.fillColor('#0F172A').rect(0, 0, 595.28, 60).fill();
        doc.fillColor('#FFFFFF').fontSize(20).text('Smart QR Attendance Report', 40, 20, { align: 'left' });
        doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, 40, 42, { align: 'left' });

        doc.moveDown(3);
        doc.fillColor('#0F172A').fontSize(14).text(`Total Records: ${rows.length}`, 40, 80);
        doc.moveDown();

        // Table Header
        let y = 110;
        doc.fontSize(10).fillColor('#475569');
        doc.text('Date', 40, y);
        doc.text('Student Name', 140, y);
        doc.text('Enrollment', 280, y);
        doc.text('Subject', 400, y);
        doc.text('Status', 510, y);

        doc.moveTo(40, y + 15).lineTo(550, y + 15).stroke('#CBD5E1');
        y += 25;

        // Table Body
        doc.fillColor('#0F172A');
        rows.forEach(r => {
            if (y > 750) {
                doc.addPage();
                y = 40;
            }
            doc.fontSize(9).text(new Date(r.scanned_at).toLocaleDateString(), 40, y);
            doc.text(r.student_name.slice(0, 20), 140, y);
            doc.text(r.enrollment_no, 280, y);
            doc.text(r.subject_name.slice(0, 18), 400, y);
            doc.text(r.status, 510, y);
            y += 18;
        });

        doc.end();
    } catch (error) {
        console.error('Export PDF Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while exporting PDF report.' });
    }
};
