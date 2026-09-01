/**
 * Smart QR Attendance System - Analytics & Export Reports Engine (Chart.js + Blob Download)
 */

// Production Cloud Backend Fallback Configuration (Window-scoped to prevent duplicate declaration errors)
window.BACKEND_API_URL = window.API_BASE_URL || 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? `http://${window.location.hostname}:5000` 
        : "https://smart-qr-attendance-system-8qzs.onrender.com");

const BASE_SERVER_URL = window.BACKEND_API_URL;
const REPORTS_API = `${BASE_SERVER_URL}/api/reports`;

let dailyTrendChartInstance = null;
let ratioChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    initAnalyticsCharts();
    initExportControls();
});

function getAuthToken() {
    return localStorage.getItem('adminToken') || localStorage.getItem('teacherToken') || localStorage.getItem('token');
}

/**
 * 1. Fetch Analytics & Render Chart.js
 */
async function initAnalyticsCharts() {
    const trendCanvas = document.getElementById('dailyTrendChart');
    const ratioCanvas = document.getElementById('ratioChart');

    if (!trendCanvas || !ratioCanvas) return;

    try {
        const response = await fetch(`${REPORTS_API}/analytics`, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        const resData = await response.json();

        if (response.ok && resData.status === 'success') {
            const { dailyTrends, ratio } = resData.data;

            renderDailyTrendChart(trendCanvas, dailyTrends);
            renderRatioChart(ratioCanvas, ratio);
        }
    } catch (err) {
        console.error('Error fetching analytics data:', err);
    }
}

/**
 * Render 7-Day Line Chart
 */
function renderDailyTrendChart(canvas, trends) {
    if (dailyTrendChartInstance) dailyTrendChartInstance.destroy();

    const ctx = canvas.getContext('2d');
    dailyTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: trends.labels.length ? trends.labels : ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
            datasets: [{
                label: 'Scanned Attendances',
                data: trends.data.length ? trends.data : [0, 0, 0, 0, 0, 0, 0],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#10b981',
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', weight: 600 } } }
            },
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.08)' } },
                y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.08)' }, beginAtZero: true }
            }
        }
    });
}

/**
 * Render Present vs Absent Doughnut Chart
 */
function renderRatioChart(canvas, ratio) {
    if (ratioChartInstance) ratioChartInstance.destroy();

    const ctx = canvas.getContext('2d');
    ratioChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Present', 'Absent / Missed'],
            datasets: [{
                data: [ratio.present || 1, ratio.absent || 0],
                backgroundColor: ['#10b981', '#f43f5e'],
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', weight: 600 } } }
            }
        }
    });
}

/**
 * 2. Excel & PDF Export Handling with Blob Downloads
 */
function initExportControls() {
    const excelBtn = document.getElementById('export-excel-btn');
    const pdfBtn = document.getElementById('export-pdf-btn');

    if (excelBtn) excelBtn.addEventListener('click', () => triggerExportDownload('excel'));
    if (pdfBtn) pdfBtn.addEventListener('click', () => triggerExportDownload('pdf'));
}

async function triggerExportDownload(format) {
    const startDate = document.getElementById('export-start-date')?.value || '';
    const endDate = document.getElementById('export-end-date')?.value || '';
    const subjectId = document.getElementById('export-subject-select')?.value || '';

    const queryParams = new URLSearchParams();
    if (startDate) queryParams.append('startDate', startDate);
    if (endDate) queryParams.append('endDate', endDate);
    if (subjectId) queryParams.append('subject_id', subjectId);

    const exportUrl = `${REPORTS_API}/export/${format}?${queryParams.toString()}`;

    try {
        const response = await fetch(exportUrl, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });

        if (!response.ok) {
            alert('Failed to generate export file.');
            return;
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `attendance_report_${new Date().toISOString().slice(0, 10)}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);

    } catch (err) {
        console.error(`Error downloading ${format} report:`, err);
        alert(`Error downloading ${format} report.`);
    }
}