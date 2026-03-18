# Bus Ticketing Management System

<div align="center">

![License](https://img.shields.io/badge/license-Private-red.svg)
![Python](https://img.shields.io/badge/python-3.11+-blue.svg)
![Django](https://img.shields.io/badge/django-5.2-green.svg)
![React](https://img.shields.io/badge/react-18.0-blue.svg)
![Version](https://img.shields.io/badge/version-1.1-orange.svg)

Private multi-tenant platform for bus fleet operations with real-time ticketing, payment reconciliation, and comprehensive reporting.

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
- Depot organization across locations
- Password management with session termination
- Device approval workflow for security

### 💳 Transaction Processing
- Real-time ticket data collection from handheld devices
- Cash and UPI payment tracking
- Trip close reports with financial summaries
- Passenger breakdown (Full, Half, Student, Senior, Physical, Luggage)

### 💰 Payment Reconciliation
- **Mosambee Payment Gateway Integration**
- **Automatic matching** of UPI payments to tickets
- **Intelligent detection**: Amount mismatches, duplicates, missing tickets
- **Manager verification workflow**: Verify/Reject/Flag transactions
- **Checksum validation** (SHA512) for data integrity
- **Real-time polling** with 15-second updates

### 📊 Reporting & Analytics
- Transaction reports with date/device/depot/payment filters
- Trip close reports with route and schedule analytics
- Excel export (ExcelJS)
- Dashboard metrics for collections, operations, settlements
- Summary cards with live KPIs
- Multiple specialized dashboards (Company, Dealer, Executive)

### 🚌 Master Data Management (NEW v1.1)
- **Bus Types** - Bus category management with company isolation
- **Vehicles/Buses** - Individual bus tracking and assignment
- **Routes** - Route definition and management
- **Stages** - Transit stages/hubs per route
- **Fares** - Dynamic fare tables per route and bus type
- **MDB Import** - Bulk import from Microsoft Access files
- **Currencies** - Multi-currency support

### 👥 Crew Management (NEW v1.1)
- **Employee Types** - Driver, Conductor, Inspector roles
- **Employees** - Staff directory with type classification
- **Crew Assignments** - Dynamic trip-wise crew scheduling
- **Inspector Details** - Inspector mapping to routes

### 🏢 Dealer & Executive Management (NEW v1.1)
- **Dealer Management** - Third-party dealer registration and mappings
- **Executive Mappings** - Executive territory management
- **Specialized Dashboards** - Role-specific views with transaction visibility

### 🏪 Operational Management (NEW v1.1)
- **Depot Management** - Transit hub/depot configuration
- **Settings Management** - System and company-level configurations

### 🔐 Security
- JWT authentication with HTTP-only cookies
- Auto token refresh on expiration
- Checksum validation for payment data
- Role-based UI rendering
- Device authentication & approval workflow

---

## 🛠️ Tech Stack

**Backend**
- Django 5.2 + Django REST Framework
- MySQL 8.0+ with timezone support (Asia/Kolkata)
- JWT Authentication (30-min access, 7-day refresh)
- Django Signals for auto-reconciliation
- **Celery + Redis** for async task processing
- **MDB Parser** for bulk data import from Access files
- **Flower** for Celery task monitoring

**Frontend**
- React 18 with Vite
- React Router v6
- Tailwind CSS
- Axios with auto-refresh interceptors
- ExcelJS for exports
- Dynamic form builders for master data CRUD

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
APP_VERSION=1.1.0
PROJECT_NAME=Bus Ticketing System
```

---

## 📖 Usage

### User Roles

**Super Admin**
- Manage companies and validate licenses
- Create/edit users across all companies
- View system-wide metrics

**Company Admin**
- Manage depots within company
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

**Companies & Depots**
```http
GET  /customer-data/
POST /create-company/
PUT  /update-company-details/{id}/
POST /register-company-license/{id}/
POST /validate-company-license/{id}/
GET  /get_company_dashboard_metrics/
GET  /get_admin_data/
GET  /depots/
POST /create-depot/
PUT  /update-depot-details/{id}/
```

**Users & Device Management**
```http
GET  /get_users/
POST /create_user/
PUT  /update_user/{id}/
POST /change_user_password/{id}/
GET  /device-approvals/
POST /device-approvals/{id}/approve/
POST /device-approvals/{id}/revoke/
```

**Master Data - Transport (NEW)**
```http
GET  /masterdata/bus-types/
POST /masterdata/bus-types/create/
PUT  /masterdata/bus-types/update/{id}/
GET  /masterdata/stages/
POST /masterdata/stages/create/
PUT  /masterdata/stages/update/{id}/
GET  /masterdata/routes/
POST /masterdata/routes/create/
PUT  /masterdata/routes/update/{id}/
GET  /masterdata/vehicles/
POST /masterdata/vehicles/create/
PUT  /masterdata/vehicles/update/{id}/
GET  /masterdata/fares/editor/{route_id}/
PUT  /masterdata/fares/update/{route_id}/
GET  /masterdata/dropdowns/bus-types/
GET  /masterdata/dropdowns/stages/
GET  /masterdata/dropdowns/vehicles/
```

**Master Data - Crew (NEW)**
```http
GET  /masterdata/employee-types/
POST /masterdata/employee-types/create/
PUT  /masterdata/employee-types/update/{id}/
GET  /masterdata/employees/
POST /masterdata/employees/create/
PUT  /masterdata/employees/update/{id}/
GET  /masterdata/crew-assignments/
POST /masterdata/crew-assignments/create/
PUT  /masterdata/crew-assignments/update/{id}/
DELETE /masterdata/crew-assignments/delete/{id}/
GET  /masterdata/dropdowns/employee-types/
GET  /masterdata/dropdowns/employees/
```

**Operational Management (NEW)**
```http
GET  /masterdata/currencies/
POST /masterdata/currencies/create/
PUT  /masterdata/currencies/update/{id}/
GET  /masterdata/settings/
```

**Dealer & Executive Management (NEW)**
```http
GET  /dealers/
POST /create-dealer/
PUT  /update-dealer-details/{id}/
GET  /dealer-mappings/
POST /create-dealer-mapping/
PUT  /update-dealer-mapping/{id}/
GET  /dealer-dashboard/
GET  /executive-mappings/
POST /create-executive-mapping/
PUT  /update-executive-mapping/{id}/
GET  /executive-dashboard/
```

**Transaction Data (Device Endpoints)**
```http
GET /getTicket?fn={pipe_delimited_data}
GET /getTripClose?fn={pipe_delimited_data}
```

**Reports (with Polling Support)**
```http
GET /get_all_transaction_data?from_date={date}&to_date={date}&since={timestamp}
GET /get_all_trip_close_data?from_date={date}&to_date={date}&since={timestamp}
```

**Settlements & Payments**
```http
POST /postSettlementDetails/           # Mosambee webhook
GET  /get_settlement_data?from_date={}&to_date={}
POST /verify_settlement/                # Manager action
GET  /get_settlement_summary?from_date={}&to_date={}
```

**Data Import (NEW)**
```http
POST /import-mdb/  # MDB file upload & bulk import
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
│   │   ├── models/
│   │   │   ├── auth.py              # CustomUser, UserDevice Mapping
│   │   │   ├── company.py           # Company, Depot, CustomUser
│   │   │   ├── master_data.py       # Bus Types, Routes, Stages, Fares, Employees, Currency
│   │   │   ├── operations.py        # Crew Assignments, Expenses, Inspector Details
│   │   │   ├── transactions.py      # TransactionData, TripCloseData
│   │   │   ├── payments.py          # MosambeeTransaction, Settlement
│   │   │   └── managers.py          # Custom QuerySet managers
│   │   ├── serializers.py           # DRF serializers
│   │   ├── signals.py               # Auto-reconciliation logic
│   │   ├── tasks.py                 # Celery async tasks
│   │   ├── views/
│   │   │   ├── auth_views.py        # Login, signup, token refresh
│   │   │   ├── company_views.py     # Company & license management
│   │   │   ├── user_views.py        # User CRUD
│   │   │   ├── depot_views.py       # Depot management
│   │   │   ├── data_views.py        # Device data ingestion + polling
│   │   │   ├── mosambee_views.py    # Settlement & reconciliation
│   │   │   ├── transport_views.py   # Bus types, Routes, Stages, Vehicles, Fares
│   │   │   ├── crew_views.py        # Employee types, Employees, Crew assignments
│   │   │   ├── dealer_views.py      # Dealer & mapping management
│   │   │   ├── executive_views.py   # Executive territory management
│   │   │   ├── device_approval_views.py  # Device security workflow
│   │   │   ├── mdb_views.py         # MDB file import service
│   │   │   ├── settings_views.py    # Global settings
│   │   │   └── utils.py             # Helper functions
│   │   ├── migrations/              # Database versioning
│   │   └── apps.py                  # Signal registration
│   └── .env
│
├── Frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ProtectedRoute.jsx   # Auth guard
│   │   │   └── ...
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Signup.jsx
│   │   │   ├── AdminHome.jsx        # Super admin dashboard
│   │   │   ├── CompanyDashboard.jsx # Company admin dashboard
│   │   │   ├── DepotDashboard.jsx   # Depot view
│   │   │   ├── UserHome.jsx         # Regular user dashboard
│   │   │   ├── DealerDashboard.jsx  # Dealer view
│   │   │   ├── ExecutiveDashboard.jsx # Executive view
│   │   │   ├── CompanyListing.jsx
│   │   │   ├── DepotListing.jsx
│   │   │   ├── UserListing.jsx
│   │   │   ├── BusTypeListing.jsx
│   │   │   ├── VehicleListing.jsx
│   │   │   ├── RouteListing.jsx
│   │   │   ├── StageListing.jsx
│   │   │   ├── FareEditor.jsx       # Dynamic fare table editor
│   │   │   ├── EmployeeTypeListing.jsx
│   │   │   ├── EmployeeListing.jsx
│   │   │   ├── CrewAssignmentListing.jsx
│   │   │   ├── CurrencyListing.jsx
│   │   │   ├── DealerManagement.jsx
│   │   │   ├── DeviceApprovals.jsx  # Device security workflow
│   │   │   ├── MdbImport.jsx        # Master data import UI
│   │   │   ├── TicketReport.jsx     # Transaction reports
│   │   │   ├── TripcloseReport.jsx  # Trip reports
│   │   │   ├── SettlementPage.jsx   # Payment settlement UI
│   │   │   ├── SettingsPage.jsx     # Global settings
│   │   │   └── ...
│   │   └── main.jsx                 # Router with 404 handling
│   └── .env
│
└── README.md
```

---

## 🗺️ Roadmap

### ✅ Completed (v1.0+)

- [x] Depot management
- [x] Transaction & trip data collection
- [x] Reports with filters & Excel export
- [x] **Payment reconciliation (Mosambee)**
- [x] **Auto-matching with signals**
- [x] **Settlement verification UI**
- [x] **Cursor-based polling (since parameter)**
- [x] **404 handler with auto-redirect**
- [x] **Master data models** (Bus Types, Routes, Stages, Vehicles, Fares)
- [x] **Master data CRUD interfaces** (all listings & editors)
- [x] **Crew management** (Employee Types, Employees, Crew Assignments)
- [x] **MDB import service** (bulk data import from Access files)
- [x] **Dealer & Executive mappings** (multi-party role support)
- [x] **Device approval workflow** (secure device authentication)
- [x] **Currency management**
- [x] **Settings management**
- [x] **Multiple specialized dashboards** (Admin, Company, Dealer, Executive)

### 🚧 Upcoming (v1.2)

- [ ] Inspector assignment and routing integration
- [ ] Advanced expense tracking and reconciliation
- [ ] Batch settlement processing
- [ ] Real-time GPS tracking integration
- [ ] Route optimization algorithms

### 📅 Future (v2.0+)

- [ ] Mobile conductor app (React Native)
- [ ] Driver roster and leave management
- [ ] Automated settlement reminders & notifications
- [ ] Multi-language support
- [ ] Predictive maintenance alerts
- [ ] Advanced analytics & business intelligence dashboards

---

## 📊 Project Status

**Current Version**: 1.1  
**Status**: Active Development  
**Last Updated**: March 2026

---

## 🔧 Key Changes in v1.1

### New Features
- **Master Data Management**: Complete CRUD for Bus Types, Routes, Stages, Vehicles, Fares
- **Crew Management**: Employee Types, Employees, Crew Assignment workflows
- **Dealer & Executive Support**: Multi-party role management and dashboards
- **MDB Import Service**: Bulk import from Microsoft Access database files
- **Device Approval Workflow**: Secure device-to-user binding
- **Depot Management**: Transit hub configuration
- **Currency Support**: Multi-currency master data
- **Settings Management**: Global system and company-level configurations
- **Specialized Dashboards**: Admin, Company, Dealer, Executive views

### Dashboard Enhancements
- Multiple role-based dashboard views (Admin, Company, Dealer, Executive)
- Dealer-specific transaction visibility
- Executive territory management and analytics

### Technical Updates
- Modular model structure (auth.py, company.py, master_data.py, operations.py, transactions.py, payments.py)
- Extended view layer (15+ view modules for different functional areas)
- Comprehensive API for master data CRUD operations
- Enhanced device security with approval workflow
- MDB file parsing and bulk import engine

---

<div align="center">

By Adhwaith Krishnan

</div>
