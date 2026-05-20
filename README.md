# Bus Ticketing Management System

<div align="center">

![License](https://img.shields.io/badge/license-Private-red.svg)
![Python](https://img.shields.io/badge/python-3.11+-blue.svg)
![Django](https://img.shields.io/badge/django-5.2-green.svg)
![React](https://img.shields.io/badge/react-18.0-blue.svg)
![Version](https://img.shields.io/badge/version-1.2.0-orange.svg)

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
- Trip and schedule data reports with financial summaries
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
- Trip and schedule data reports with route and financial analytics
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

### 🏢 Dealer & Executive Management (NEW v1.1, Enhanced v1.2)
- **Dealer Management** - Restructured dealer registration flow with improved data validation
- **Dealer Mappings** - Enhanced mapping system with better access control
- **Executive Mappings** - Executive territory management with granular permissions
- **Specialized Dashboards** - Role-specific views with transaction visibility
- **User Access Control** - Granular permission system for dealer and executive roles

### 🏢 Operational Management (NEW v1.1, Enhanced v1.2)
- **Depot Management** - Transit hub/depot configuration
- **Settings Management** - System and company-level configurations
- **License Allocation & Management** - Improved license allocation workflow and company license lifecycle
- **Company Registration Flow** - Restructured company registration with enhanced validation and approval process

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
- **APK Reporting** - Comprehensive reporting system for mobile device data with advanced filtering

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
APP_VERSION=1.2.0
PROJECT_NAME=Bus Ticketing System
```

---

## 📖 Usage

### License Validation Workflow

1. Register company → Get `company_id`
2. Click "Validate License" → Backend polls external server (3s intervals, 2min max)
3. Status: Pending → Validating → Approved/Expired/Blocked

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

**Ticket Transaction (Pipe-Delimited)**
```
Ticket|DeviceSequenceID|DeviceID|RouteCode|TripNo|TicketNumber|ScheduleStartDate|[Reserved]|TicketDate|TicketTime|FromStageNo|ToStageNo|FullCount|HalfCount|StudentCount|PhysicalCount|LuggageCount|[Reserved]|[Reserved]|[Reserved]|[Reserved]|[Reserved]|[Reserved]|[Reserved]|[Reserved]|LadiesCount|SeniorCount|ScheduleNo|[Reserved]|[Reserved]|Direction|TripStartDate|[Reserved]|[Reserved]|[Reserved]|[Reserved]|[Reserved]|[Reserved]|[Reserved]|[Reserved]|[Reserved]|[Reserved]|[Reserved]|PaymentMode|CompanyCode|CheckSum
```

**Field Descriptions:**

| Index | Field | Description | Example |
|-------|-------|-------------|--------|
| 0 | RequestType | Always 'Ticket' | Ticket |
| 1 | DeviceSequenceID | Unique sequence from device | ABC123XYZ |
| 2 | DeviceID | Device identifier | DEVICE001 |
| 3 | RouteCode | Route identifier | R001 |
| 4 | TripNo | Trip number | 5 |
| 5 | TicketNumber | Ticket identifier | T12345 |
| 6 | ScheduleStartDate | Schedule date (DDMMYYYY) | 21052026 |
| 8 | TicketDate | Ticket issue date (DDMMYYYY) | 21052026 |
| 9 | TicketTime | Ticket time (HHMM) | 0930 |
| 10 | FromStageNo | Boarding stage (1-indexed) | 1 |
| 11 | ToStageNo | Alighting stage (1-indexed) | 5 |
| 12 | FullCount | Full fare passengers | 10 |
| 13 | HalfCount | Half fare passengers | 3 |
| 14 | StudentCount | Student passengers | 2 |
| 15 | PhysicalCount | Physical disability passengers | 1 |
| 16 | LuggageCount | Luggage units | 5 |
| 25 | LadiesCount | Ladies only (if applicable) | 2 |
| 26 | SeniorCount | Senior citizen passengers | 1 |
| 28 | ScheduleNo | Schedule identifier | 101 |
| 31 | Direction | Trip direction (U=Up, D=Down) | U |
| 32 | TripStartDate | Trip start date (DDMMYYYY) | 21052026 |
| 44 | PaymentMode | 0=Cash, 1=UPI | 1 |
| 45 | CompanyCode | Company code | COMP001 |
| 46+ | CheckSum | SHA512 checksum | (hash) |

**Example Ticket Data:**
```
Ticket|ABC123XYZ|DEVICE001|R001|5|T12345|21052026||21052026|0930|1|5|10|3|2|1|5|||||||||1|2|101|||U|21052026||||||||||||1|COMP001|abcdef123456...
```

**Trip Open (Pipe-Delimited)**
```
TrpOp|DeviceSequenceID|DeviceID|CompanyCode|RouteCode|ScheduleNo|BusNumber|DriverID|DriverName|ScheduleStartDate|[Reserved]|[Reserved]|[Reserved]|[Reserved]|CheckSum
```

**Trip Close (Pipe-Delimited)**
```
TrpCls|DeviceSequenceID|DeviceID|CompanyCode|RouteCode|TripNo|[Multiple Financial Fields]|...|CheckSum
```

**Schedule Open (Pipe-Delimited)**
```
ShdOpn|DeviceSequenceID|DeviceID|CompanyCode|RouteCode|[Reserved]|[Reserved]|[Reserved]|[Reserved]|[Reserved]|[Reserved]|BatteryPercentage|CheckSum
```

**Schedule Close (Pipe-Delimited)**
```
ShdCls|DeviceSequenceID|DeviceID|CompanyCode|RouteCode|[Multiple Data Fields]|...|CheckSum
```

**Server Response**

Successful processing returns:
```
OK#SUCCESS#fn={first_32_chars_of_device_sequence_id}#
```

Error responses:
```
NO_DATA              # Request parameter 'fn' is missing
MISSING_DATA         # Payload has fewer fields than required
INVALID              # Request type doesn't match expected value
INVALID_CHECKSUM     # SHA512 checksum validation failed
INVALID_COMPANY      # Company code not found or inactive
METHOD_NOT_ALLOWED   # Request method is not GET (HTTP 405)
ERROR                # Server-side processing error (HTTP 500)
```

**Response Content-Type**: `text/plain`

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
│   │   │   ├── operations.py        # Crew Assignments, Expenses
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

### ✅ Completed (v1.0-v1.1)

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

### ✅ Completed (v1.2 - Current)

- [x] **Company & Dealer Registration Flow Restructure** - Enhanced registration workflow with improved validation
- [x] **License Allocation & Management** - Comprehensive license lifecycle management
- [x] **User Access Control Enhancements** - Granular permission system for multi-role users
- [x] **APK Report Completion** - Full reporting suite for mobile device data with advanced filtering
- [x] **Expense Management** - Expense tracking and categorization (pending full documentation)

### 🚧 Upcoming (v1.3+)

- [ ] Advanced expense tracking and reconciliation
- [ ] Real-time GPS tracking integration

---

## 📊 Project Status

**Current Version**: 1.2  
**Status**: Active Development  
**Last Updated**: May 2026

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

## 🔧 Key Changes in v1.2

### Restructured Flows
- **Company Registration**: Enhanced validation, streamlined approval process with improved error handling
- **Dealer Registration**: Restructured registration workflow with better data consistency and validation rules
- **License Management**: Complete lifecycle management - allocation, validation, renewal tracking, expiration handling

### Enhanced Security & Access Control
- **Granular User Permissions**: Fine-grained access control for dealer and executive roles
- **User-Role Mapping**: Improved multi-role user assignment with proper permission inheritance
- **Access Control Policies**: Better enforcement of company data isolation across user roles

### Reporting Improvements
- **APK Report Completion**: Comprehensive reporting system for mobile device data
- **Advanced Filtering**: Multi-criteria filtering for transaction and trip reports
- **Export Capabilities**: Enhanced Excel export with formatted headers and data validation

### Technical Updates
- Improved middleware for license validation and user access control
- Enhanced signal handlers for better data reconciliation
- Optimized query performance for multi-tenant operations

---

<div align="center">

By Adhwaith Krishnan

</div>
