# Bus Ticketing Management System

<div align="center">

![License](https://img.shields.io/badge/license-Non--Commercial-blue.svg)
![Python](https://img.shields.io/badge/python-3.11+-blue.svg)
![Django](https://img.shields.io/badge/django-5.2-green.svg)
![React](https://img.shields.io/badge/react-18.0-blue.svg)
![Version](https://img.shields.io/badge/version-1.0-orange.svg)

Open-source multi-tenant platform for bus fleet operations with real-time ticketing, payment reconciliation, and comprehensive reporting.

[Features](#features) • [Tech Stack](#tech-stack) • [Installation](#installation) • [API Docs](#api-documentation) • [Roadmap](#roadmap)

</div>

---

## 📋 Overview

The **Bus Ticketing Management System** streamlines bus operations for transport companies through:

- **Multi-Tenant Architecture** - Manage multiple companies with isolated data
- **Real-Time Device Integration** - Direct ticketing device communication via HTTP
- **Automated Payment Reconciliation** - Match UPI payments with ticket transactions
- **Role-Based Access** - Granular permissions (Super Admin, Company Admin, User)

---

## ✨ Features

### 🏢 Company & User Management
- Multi-company support with external license validation
- User management with role-based access control
- Branch organization across locations
- Password management with session termination

### 💳 Transaction Processing
- Real-time ticket data collection from handheld devices
- Cash and UPI payment tracking
- Trip close reports with financial summaries
- Passenger breakdown (Full, Half, Student, Senior, Physical, Luggage)

### 💰 Payment Reconciliation (NEW v1.0)
- **Mosambee Payment Gateway Integration**
- **Automatic matching** of UPI payments to tickets
- **Intelligent detection**: Amount mismatches, duplicates, missing tickets
- **Manager verification workflow**: Verify/Reject/Flag transactions
- **Checksum validation** (SHA512) for data integrity
- **Real-time polling** with 15-second updates

### 📊 Reporting & Analytics
- Transaction reports with date/device/branch/payment filters
- Trip close reports with route and schedule analytics
- Excel export (ExcelJS)
- Dashboard metrics for collections, operations, settlements
- Summary cards with live KPIs

### 🔐 Security
- JWT authentication with HTTP-only cookies
- Auto token refresh on expiration
- Checksum validation for payment data
- Role-based UI rendering

---

## 🛠️ Tech Stack

**Backend**
- Django 5.2 + Django REST Framework
- MySQL 8.0+ with timezone support (Asia/Kolkata)
- JWT Authentication (30-min access, 7-day refresh)
- Django Signals for auto-reconciliation

**Frontend**
- React 18 with Vite
- React Router v6
- Tailwind CSS
- Axios with auto-refresh interceptors
- ExcelJS for exports

---

## 🏗️ System Architecture

```
              Ticketing Devices (HTTP GET) → Django Backend → MySQL Database
                                       ↓
                          License Server (Background Polling)
                                       ↓
                        React Frontend (JWT Auth, Role-Based UI)
                                       ↓
                          Mosambee Payment Gateway (POST)
```

### Key Data Flow

1. **Ticket Transactions**: Devices send pipe-delimited data via GET
2. **Trip Close**: Aggregated trip summaries posted by devices
3. **Payment Gateway**: Mosambee POSTs UPI transaction data
4. **Auto-Reconciliation**: Django signal matches payments to tickets
5. **Manager Verification**: Manual review before settlement

---

## 🚀 Installation

### Prerequisites
- Python 3.11+, Node.js 22+, MySQL 8.0+

### Backend Setup

```bash
# Clone repo
git clone https://github.com/yourusername/bus-ticketing-system.git
cd bus-ticketing-system/Backend

# Virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Database setup
mysql -u root -p
CREATE DATABASE busticketing_demo CHARACTER SET utf8mb4;
CREATE USER 'busticketing_user'@'localhost' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON busticketing_demo.* TO 'busticketing_user'@'localhost';
FLUSH PRIVILEGES;

# Configure .env (see Configuration section)

# Migrations
python manage.py makemigrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run server
python manage.py runserver 0.0.0.0:8000
```

### Frontend Setup

```bash
cd ../Frontend
npm install

# Create .env
echo "VITE_API_BASE_URL=http://localhost:8000" > .env

# Run dev server
npm run dev
```

Access: `http://localhost:5173`

---

## ⚙️ Configuration

### Backend `.env`

```bash
SECRET_KEY='your-secret-key'
DEBUG=True

# Database
DB_NAME=your_db_name
DB_USER=your_db_user
DB_PASSWORD=your_password
DB_HOST=host_address
DB_PORT=host_port

# CORS & Hosts
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173

# License Server
LICENSE_SERVER_BASE_URL=http://your-license-server.com/api
PRODUCT_REGISTRATION_ENDPOINT=/ProductRegistration
PRODUCT_AUTH_ENDPOINT=/ProductAuthentication

# Payment Gateway
MOSAMBEE_SALT=your-mosambee-salt-key

# App Info
APP_VERSION=1.0.0
PROJECT_NAME=Bus Ticketing System
```

---

## 📖 Usage

### User Roles

**Super Admin**
- Manage companies and validate licenses
- Create/edit users across all companies
- View system-wide metrics

**Company Admin** (formerly Branch Admin)
- Manage branches within company
- Access transaction/trip reports
- Verify payment settlements

**User**
- View-only dashboard access

### License Validation Workflow

1. Register company → Get `company_id`
2. Click "Validate License" → Backend polls external server (3s intervals, 2min max)
3. Status: Pending → Validating → Approved/Expired/Blocked

### Settlement Verification Workflow

1. Mosambee POSTs payment data → Backend validates checksum
2. **Auto-reconciliation** (Django Signal):
   - Find ticket by invoice number
   - Check amount match
   - Detect duplicates
3. Manager reviews in Settlement Page:
   - View payment vs ticket comparison
   - Add verification notes
   - Verify/Reject/Flag transaction
4. Status: UNVERIFIED → VERIFIED/REJECTED/FLAGGED

---

## 🔌 API Documentation

### Core Endpoints

**Authentication**
```http
POST /signup/
POST /login/
POST /logout/
POST /token/refresh/
GET  /verify-auth/
```

**Companies**
```http
GET  /customer-data/
POST /create-company/
PUT  /update-company-details/{id}/
POST /register-company-license/{id}/
POST /validate-company-license/{id}/
```

**Users & Branches**
```http
GET  /get_users/
POST /create_user/
PUT  /update_user/{id}/
POST /change_user_password/{id}/
GET  /branches/
POST /create-branch/
PUT  /update-branch-details/{id}/
```

**Transactions (Device Endpoints)**
```http
GET /getTicket?fn={pipe_delimited_data}
GET /getTripClose?fn={pipe_delimited_data}
```

**Reports (with Polling Support)**
```http
GET /get_all_transaction_data?from_date={date}&to_date={date}&since={timestamp}
GET /get_all_trip_close_data?from_date={date}&to_date={date}&since={timestamp}
```

**Settlements (NEW)**
```http
POST /mosambee-settlement-data/           # Mosambee webhook
GET  /get_settlement_data?from_date={}&to_date={}
POST /verify_settlement/                  # Manager action
GET  /get_settlement_summary?from_date={}&to_date={}
```

### Device Data Format

**Transaction (Pipe-Delimited)**
```
RequestType|DeviceID|TripNo|TicketNo|Date|Time|FromStage|ToStage|FullCount|HalfCount|STCount|PhyCount|LuggCount|TicketAmt|LuggAmt|TicketType|AdjustAmt|PassID|WarrantAmt|RefundStatus|RefundAmt|LadiesCount|SeniorCount|TransactionID|TicketStatus|ReferenceNo|CompanyCode
```

**Server Response**
```
OK#SUCCESS#fn={first_32_chars}#
```

---

## 📁 Project Structure

```
bus-ticketing-system/
├── Backend/
│   ├── Backend/
│   │   └── settings.py              # Django config (Timezone: Asia/Kolkata)
│   ├── TicketAppB/
│   │   ├── models.py                # Company, User, Branch, Transaction, TripClose, Mosambee
│   │   ├── serializers.py           # DRF serializers
│   │   ├── signals.py               # Auto-reconciliation logic (NEW)
│   │   ├── views/
│   │   │   ├── auth_views.py
│   │   │   ├── company_views.py
│   │   │   ├── user_views.py
│   │   │   ├── branch_views.py
│   │   │   ├── data_views.py        # Polling support with 'since'
│   │   │   └── mosambee_views.py    # Settlement APIs (NEW)
│   │   └── apps.py                  # Signal registration
│   └── .env
│
├── Frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── NotFound.jsx         # 404 handler (NEW)
│   │   │   ├── ProtectedRoute.jsx   # Auth guard (company_admin role)
│   │   │   └── ...
│   │   ├── pages/
│   │   │   ├── SettlementPage.jsx   # Full settlement UI (NEW)
│   │   │   ├── TicketReport.jsx     # Polling support
│   │   │   ├── TripcloseReport.jsx  # Polling support
│   │   │   └── ...
│   │   └── main.jsx                 # Router (404 route added)
│   └── .env
│
└── README.md
```

---

## 🗺️ Roadmap

### ✅ Completed (v1.0)

- [x] Multi-tenant company management
- [x] License validation with polling
- [x] User management (company_admin role)
- [x] Branch management
- [x] Transaction & trip data collection
- [x] Reports with filters & Excel export
- [x] **Payment reconciliation (Mosambee)**
- [x] **Auto-matching with signals**
- [x] **Settlement verification UI**
- [x] **Cursor-based polling (since parameter)**
- [x] **404 handler with auto-redirect**

### 🚧 Upcoming (v1.1)

- [ ] **404 smart redirect** (dashboard if logged in, login if not)
- [ ] **Master data models** (Bus, Route, Stage, Fare from mdb_models.py)
- [ ] Branch dashboard backend implementation
- [ ] Batch settlement processing

### 📅 Future (v2.0+)

- [ ] Bus/Route/Stage/Fare CRUD interfaces
- [ ] GPS tracking integration
- [ ] Driver roster management
- [ ] Mobile conductor app
- [ ] Automated settlement reminders
- [ ] Multi-language support

---

## 🤝 Contributing

This project is open-source under a **non-commercial license**.

**How to Contribute:**
1. Fork the repo
2. Create feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m "feat: add feature"`
4. Push: `git push origin feature/your-feature`
5. Open Pull Request

**Priority Areas:**
- 🔴 Master data CRUD (Bus, Route, Fare, Stage)
- 🔴 Branch dashboard metrics API
- 🟡 Settlement batch processing
- 🟢 UI/UX improvements

---

## 📜 License

**Non-Commercial Open Source License**

✅ **Allowed**: Personal use, education, non-profit, modifications (with attribution)  
❌ **Not Allowed**: Commercial use, selling, SaaS offerings


## 📊 Project Status

**Current Version**: 1.0  
**Status**: Active Development  
**Last Updated**: January 2025

---

## 🔧 Key Changes in v1.0

### New Features
- **Mosambee Payment Gateway Integration** with checksum validation
- **Auto-Reconciliation** using Django signals
- **Settlement Verification** with manager workflow
- **Real-time Polling** (15s intervals, cursor-based with `since`)
- **404 Handler** with countdown redirect

### Technical Updates
- **Role Rename**: `branch_admin` → `company_admin`
- **Timezone**: UTC → `Asia/Kolkata`
- **JWT Expiry**: 60min → 30min (access token)
- **Polling Support**: Added `since` parameter to ticket/trip APIs

### Database
- New model: `MosambeeTransaction` (50+ fields)
- Auto-reconciliation via `post_save` signal
- Status tracking: processing, verification, reconciliation

---

<div align="center">

**[⬆ Back to Top](#bus-ticketing-management-system)**

By Adhwaith Krishnan

</div>
