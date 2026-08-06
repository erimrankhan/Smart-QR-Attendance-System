# 🎓 Smart QR Attendance System

A modern, production-ready, full-stack **Smart QR Attendance System** integrated into a college website. The platform features isolated role-based authentication (Admin, Teacher, Student), dynamic 60-second QR generation, real-time camera scanning, analytics dashboards, Excel/PDF reporting, and a Glassmorphism UI design.

---

## 🌟 Key Features

- **🔐 Isolated Role-Based Authentication**: Secure JWT-based access for Administrator, Faculty (Teacher), and Student portals.
- **⚡ Dynamic 60-Second QR Generation**: Faculty launch time-sensitive QR codes with 64-character cryptographic hashes (`crypto` module) that expire strictly after 60 seconds.
- **📸 Real-Time Camera QR Scanning Engine**: Students scan QR codes directly using device cameras with instant section validation, expiration enforcement, and duplicate scan prevention.
- **📊 Analytics & Visual Reports**: Interactive Chart.js analytics tracking 7-day attendance trends, subject averages, and present/absent scan ratios.
- **📥 One-Click File Exports**: Export custom-filtered attendance logs directly to **Excel (.xlsx)** via `exceljs` or formatted **PDF documents** via `pdfkit`.
- **🔔 Live Notifications**: Background poller fetching unread system alerts every 30 seconds with interactive badge counter.
- **🎨 Glassmorphism UI & Dark/Light Mode**: Premium CSS design system with backdrop blur filters, smooth gradients, and persistent theme switching.

---

## 🏗️ System Architecture & Tech Stack

```
                                  ┌───────────────────────────┐
                                  │   College Public Website  │
                                  └─────────────┬─────────────┘
                                                │ (Unlisted ERP Link)
                                                ▼
┌───────────────────────────┐    ┌───────────────────────────┐    ┌───────────────────────────┐
│     Admin Portal          │    │      Faculty Portal       │    │      Student Portal       │
│ (Departments/Faculty/    │    │   (60s QR Generation &    │    │ (Camera Scanner & Scan    │
│  Students/Reports/Auth)   │    │     Live Scan Feed)       │    │     Analytics Dashboard)  │
└─────────────┬─────────────┘    └─────────────┬─────────────┘    └─────────────┬─────────────┘
              │                                │                                │
              └────────────────────────┬───────┴────────────────────────────────┘
                                       │ (REST API / JWT Authorization)
                                       ▼
                         ┌───────────────────────────┐
                         │   Express.js Node Backend │
                         └─────────────┬─────────────┘
                                       │ (mysql2 Connection Pool)
                                       ▼
                         ┌───────────────────────────┐
                         │      MySQL Database       │
                         └───────────────────────────┘
```

- **Backend**: Node.js, Express.js, `mysql2/promise`, `bcrypt`, `jsonwebtoken`, `exceljs`, `pdfkit`, `dotenv`, `cors`, `helmet`, `morgan`.
- **Frontend**: HTML5, Vanilla JavaScript (ES6+), Vanilla CSS3 (Glassmorphism & CSS Variables), Chart.js, QRCode.js, Html5-QRCode, Font Awesome 6.

---

## 📁 Repository Folder Structure

```
smart qr attendance system/
├── README.md                              # Complete Project Documentation
├── college-attendance-system/
│   └── backend/                           # Node.js Express Backend
│       ├── .env                           # Environment Variables Configuration
│       ├── package.json                   # Dependencies and npm scripts
│       ├── server.js                      # Express App Server Entry Point
│       └── src/
│           ├── config/
│           │   └── db.js                  # MySQL Connection Pool Setup
│           ├── controllers/
│           │   ├── adminController.js     # Admin CRUD & Stats Controller
│           │   ├── authController.js      # Login Controllers (Admin, Teacher, Student)
│           │   ├── notificationController.js # System Notifications Controller
│           │   ├── reportController.js    # Analytics, Excel & PDF Export Controller
│           │   ├── studentController.js   # QR Scanning & Student Dashboard Controller
│           │   └── teacherController.js   # QR Generation & Live Scan Feed Controller
│           ├── middlewares/
│           │   └── authMiddleware.js      # JWT Verification & Role Authorization
│           ├── routes/
│           │   ├── adminRoutes.js         # Protected Admin Endpoints
│           │   ├── authRoutes.js          # Authentication Endpoints
│           │   ├── notificationRoutes.js  # Notification Endpoints
│           │   ├── reportRoutes.js        # Analytics & Export Endpoints
│           │   ├── studentRoutes.js       # Protected Student Endpoints
│           │   └── teacherRoutes.js       # Protected Teacher Endpoints
│           └── utils/
│               ├── initDb.js              # Database & Table Auto-Initializer
│               └── seedAdmin.js           # Default Super Admin Account Seeder
└── college-website/                       # Frontend Web Application
    ├── index.html                         # Public College Landing Page
    └── attendance/                        # Unlisted Attendance System Portals
        ├── index.html                     # ERP Portal Access Point Router
        ├── admin/
        │   ├── dashboard.html             # Admin Dashboard UI
        │   ├── dashboard.css              # Admin Portal Glassmorphism Styles
        │   ├── admin.js                   # Admin Portal Logic & DOM Handlers
        │   └── login.html                 # Admin Login Page
        ├── teacher/
        │   ├── dashboard.html             # Teacher Dashboard & QR Showcase UI
        │   ├── dashboard.css              # Teacher Portal Glassmorphism Styles
        │   ├── teacher.js                 # Teacher QR Engine & Polling Logic
        │   └── login.html                 # Teacher Login Page
        ├── student/
        │   ├── dashboard.html             # Student Dashboard & Camera Scanner UI
        │   ├── dashboard.css              # Student Portal Glassmorphism Styles
        │   ├── student.js                 # Camera Scanner & Scan Posting Engine
        │   └── login.html                 # Student Login Page
        └── shared/
            ├── styles.css                 # Global CSS Variables & Animations
            ├── utils.js                  # Global Toasts, Loader & Modals
            ├── reports.js                 # Chart.js & Blob Download Logic
            └── notifications.js           # Notification Poller & Dropdown Logic
```

---

## 🚀 Installation & Setup Guide

### 1. Prerequisites
- **Node.js** (v16.0.0 or higher)
- **MySQL Server** (v8.0+ or XAMPP / WAMP / MySQL Workbench)

---

### 2. Backend Setup
1. Navigate to the backend folder:
   ```bash
   cd college-attendance-system/backend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Configure Environment Variables:
   Open or edit [.env](file:///d:/smart%20qr%20attendance%20system/college-attendance-system/backend/.env):
   ```env
   PORT=5000
   NODE_ENV=development

   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_mysql_password_here
   DB_NAME=college_attendance_system

   JWT_SECRET=super_secret_jwt_key_smart_qr_2026
   JWT_EXPIRES_IN=8h
   ```

4. **Initialize Database & Tables**:
   Run the database initializer to automatically create the `college_attendance_system` database and all required tables (`Admins`, `Teachers`, `Students`, `Departments`, `Sections`, `Subjects`, `Classes`, `AttendanceSessions`, `Attendance`, `Notifications`):
   ```bash
   npm run db:init
   ```

5. **Seed Default Admin Account**:
   ```bash
   npm run seed:admin
   ```
   *Default Admin Credentials:*
   - **Username**: `admin` (or `admin@college.edu`)
   - **Password**: `AdminPassword123!`

6. **Start Backend Server**:
   ```bash
   npm run dev
   ```
   The backend API will run at `http://127.0.0.1:5000`.

---

### 3. Frontend Setup
1. Open the [college-website/index.html](file:///d:/smart%20qr%20attendance%20system/college-website/index.html) in your browser or serve it using any HTTP static server (e.g. VS Code Live Server, IIS, or Nginx).
2. Access points:
   - **Public Landing Page**: `http://localhost:5000/college-website/index.html`
   - **ERP Portal Router**: `http://localhost:5000/college-website/attendance/index.html`
   - **Admin Portal Login**: `http://localhost:5000/college-website/attendance/admin/login.html`
   - **Teacher Portal Login**: `http://localhost:5000/college-website/attendance/teacher/login.html`
   - **Student Portal Login**: `http://localhost:5000/college-website/attendance/student/login.html`

---

## 📡 API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/admin/login` | Authenticate Admin user | Public |
| `POST` | `/api/auth/teacher/login` | Authenticate Teacher user | Public |
| `POST` | `/api/auth/student/login` | Authenticate Student user | Public |
| `GET` | `/api/admin/dashboard-stats` | Fetch system summary metrics | Bearer Token (`Admin`) |
| `GET` | `/api/admin/departments` | List all departments | Bearer Token (`Admin`) |
| `POST` | `/api/admin/departments` | Create new department | Bearer Token (`Admin`) |
| `DELETE`| `/api/admin/departments/:id` | Delete department | Bearer Token (`Admin`) |
| `GET` | `/api/admin/teachers` | List all faculty teachers | Bearer Token (`Admin`) |
| `POST` | `/api/admin/teachers` | Create new teacher account | Bearer Token (`Admin`) |
| `DELETE`| `/api/admin/teachers/:id` | Delete teacher account | Bearer Token (`Admin`) |
| `GET` | `/api/admin/students` | List all students | Bearer Token (`Admin`) |
| `POST` | `/api/admin/students` | Create new student account | Bearer Token (`Admin`) |
| `DELETE`| `/api/admin/students/:id` | Delete student account | Bearer Token (`Admin`) |
| `GET` | `/api/teacher/classes` | Fetch assigned classes for teacher | Bearer Token (`Teacher`) |
| `POST` | `/api/teacher/start-session` | Launch 60-second QR session | Bearer Token (`Teacher`) |
| `GET` | `/api/teacher/live-attendance/:id`| Live feed of scanned students | Bearer Token (`Teacher`) |
| `POST` | `/api/teacher/close-session/:id` | Manually close QR session | Bearer Token (`Teacher`) |
| `POST` | `/api/student/mark-attendance` | Validate & mark QR attendance scan | Bearer Token (`Student`) |
| `GET` | `/api/student/dashboard-stats` | Student attendance % & recent logs | Bearer Token (`Student`) |
| `GET` | `/api/student/subject-attendance`| Subject-by-subject attendance breakdown | Bearer Token (`Student`) |
| `GET` | `/api/reports/analytics` | Fetch Chart.js analytics datasets | Bearer Token (`Admin`/`Teacher`) |
| `GET` | `/api/reports/export/excel` | Download Excel `.xlsx` report | Bearer Token (`Admin`/`Teacher`) |
| `GET` | `/api/reports/export/pdf` | Download PDF document report | Bearer Token (`Admin`/`Teacher`) |
| `GET` | `/api/notifications` | Fetch unread notifications | Bearer Token (All Roles) |
| `PUT` | `/api/notifications/:id/read` | Mark notification as read | Bearer Token (All Roles) |

---

## 🔒 Security Measures

1. **Strict 60-Second QR Expiration**: Enforced strictly on the server-side (`NOW() <= expires_at`). Client time is never trusted.
2. **Cryptographic QR Hashes**: Every session creates a 64-character random hex hash (`crypto.randomBytes(32)`).
3. **Role Authorization**: Higher-order middleware `authorizeRoles(...)` blocks unauthorized portal cross-access.
4. **Parameterized SQL Queries**: All database queries use prepared statements via `mysql2/promise` to eliminate SQL injection vectors.
5. **Password Security**: Passwords stored using `bcrypt` (10 salt rounds).

---

## 📄 License
This project is open-source and built for academic college project evaluation.
