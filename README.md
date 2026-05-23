# Bus Ticketing Management System

<div align="center">

![License](https://img.shields.io/badge/license-Private-red.svg)
![Python](https://img.shields.io/badge/python-3.11+-blue.svg)
![Django](https://img.shields.io/badge/django-5.2-green.svg)
![React](https://img.shields.io/badge/react-18.0-blue.svg)
![Version](https://img.shields.io/badge/version-1.2.1-orange.svg)

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
- Real-time ticket data collection from handheld ETM devices
- Cash and UPI payment tracking
- Trip, schedule, and ticket data reports with financial summaries
- Passenger breakdown (Full, Half, Student, Senior, Physical, Luggage, Ladies)
- Raw payload logging with failed payload retry management
- Odometer data capture per trip (API and DAT file upload)

### 💰 Payment Reconciliation
- **Mosambee Payment Gateway Integration**
- **Automatic matching** of UPI payments to tickets
- **Intelligent detection**: Amount mismatches, duplicates, missing tickets
- **Manager verification workflow**: Verify/Reject/Flag transactions
- **Payout callback tracking**
- **Checksum validation** (SHA512) for data integrity
- **Real-time polling** with 15-second updates

### 📊 Reporting & Analytics
- Transaction reports with date/device/depot/payment filters
- Trip and schedule data reports with route and financial analytics
- APK reports: duty, bus summary, payment type, farewise, passenger info, trip details, ticket details, stage-wise, expense
- APK dashboard metrics
- Excel export (ExcelJS)
- Dashboard metrics for collections, operations, settlements
- Summary cards with live KPIs
- Multiple specialized dashboards (Company, Dealer, Executive)

### 🚌 Master Data Management
- **Bus Types** - Bus category management with company isolation
- **Vehicles/Buses** - Individual bus tracking and assignment
- **Routes** - Route definition and management with Excel import
- **Stages** - Transit stages/hubs per route
- **Fares** - Dynamic fare tables per route and bus type
- **MDB Import** - Bulk import from Microsoft Access files
- **Currencies** - Multi-currency support

### 👥 Crew Management
- **Employee Types** - Driver, Conductor, Inspector, Cleaner roles
- **Employees** - Staff directory with type classification
- **Crew Assignments** - Dynamic trip-wise crew scheduling
- **Inspector Details** - Inspector check records during trips

### 💸 Expense Management
- **Expense Master** - Expense category codes imported via MDB or managed manually
- **Expense Records** - Trip-level expense tracking from ETM devices
- **Expense DAT Upload** - Batch upload of expense DAT files from devices
- **Expense Reports** - Expense summary and breakdown via APK reports

### 🔧 Device Management
- **Device Registry** - ETM device registration with company/dealer assignment
- **Device Approvals** - Secure device-to-user binding workflow
- **Device Sync** - On-demand master data files (routes, crew, vehicles, settings, expenses) served to devices
- **Failed Payload Retry** - View and requeue failed device data payloads

### 🏢 Dealer & Executive Management
- **Dealer Management** - Dealer registration with improved data validation
- **Dealer Mappings** - Dealer-to-company association management
- **Executive Mappings** - Executive territory management with granular permissions
- **Specialized Dashboards** - Role-specific views with transaction visibility
- **User Access Control** - Granular permission system for dealer and executive roles

### 🏢 Operational Management
- **Depot Management** - Transit hub/depot configuration
- **Settings Management** - System and company-level configurations with device settings profiles
- **License Allocation & Management** - License lifecycle management with allocation workflow
- **Company Registration Flow** - Enhanced validation and approval process

### 🔐 Security
- JWT authentication with HTTP-only cookies
- Auto token refresh on expiration
- Checksum validation (SHA512) for payment and device data
- Role-based UI rendering
- Device authentication & approval workflow
- Company/dealer cascade deactivation via signals

---

## 🛠️ Tech Stack

**Backend**
- Django 5.2 + Django REST Framework
- MySQL 8.0+ with timezone support (Asia/Kolkata)
- JWT Authentication (30-min access, 7-day refresh)
- Django Signals for auto-reconciliation and cascading logic
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

1. **Ticket Transactions**: Devices send pipe-delimited data via GET → stored as RawDataLog → Celery parses to TransactionData
2. **Trip/Schedule Lifecycle**: Open and close payloads merged into TripData / ScheduleData
3. **Payment Gateway**: Mosambee POSTs UPI transaction data → stored as MosambeeTransaction
4. **Auto-Reconciliation**: Django signal matches payments to tickets
5. **Manager Verification**: Manual review before settlement
6. **Device Sync**: Devices fetch route, crew, vehicle, settings, and expense files built from current DB state

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
APP_VERSION=1.2.1
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

**Device Registry**
```http
GET  /device-registry/
POST /device-registry/upload/
GET  /device-registry/summary/
POST /device-registry/{id}/assign-dealer/
POST /device-registry/{id}/assign-company/
POST /device-registry/bulk-assign/
```

**Device Sync (ETM File Endpoints)**
```http
GET /getETMDeviceVersion/
GET /getRoutesList/
GET /getSettingsFile/
GET /getCrewFile/
GET /getVehiclesFile/
GET /getExpensesFile/
GET /getRouteLstFile/
GET /getStageLstFile/
GET /getLanguageDatFile/
GET /getRteDatFile/
GET /getCurrencyFile/
```

**Master Data - Transport**
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
GET  /masterdata/routes/{id}/
GET  /masterdata/vehicles/
POST /masterdata/vehicles/create/
PUT  /masterdata/vehicles/update/{id}/
GET  /masterdata/fares/editor/{route_id}/
PUT  /masterdata/fares/update/{route_id}/
GET  /masterdata/dropdowns/bus-types/
GET  /masterdata/dropdowns/stages/
GET  /masterdata/dropdowns/vehicles/
```

**Master Data - Crew**
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

**Master Data - Settings & Currencies**
```http
GET  /masterdata/currencies/
POST /masterdata/currencies/create/
PUT  /masterdata/currencies/update/{id}/
GET  /masterdata/settings/
GET  /masterdata/device-settings/
GET  /masterdata/settings-profiles/
POST /masterdata/settings-profiles/create/
PUT  /masterdata/settings-profiles/update/{id}/
```

**Dealer & Executive Management**
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
GET /getTripOpen?fn={pipe_delimited_data}
GET /getTripClose?fn={pipe_delimited_data}
GET /getTripCloseSummary?fn={pipe_delimited_data}
GET /getScheduleOpen?fn={pipe_delimited_data}
GET /getScheduleClose?fn={pipe_delimited_data}
GET /getScheduleCloseSummary?fn={pipe_delimited_data}
GET /getOdometerDetails?fn={pipe_delimited_data}
GET /getExpenseDetails?fn={pipe_delimited_data}
```

**Reports (Web)**
```http
GET /get_all_transaction_data?from_date={date}&to_date={date}&since={timestamp}
GET /get_all_trip_data?from_date={date}&to_date={date}&since={timestamp}
GET /get_all_schedule_data?from_date={date}&to_date={date}&since={timestamp}
```

**APK Reports**
```http
GET /apk/duty-report/
GET /apk/bus-summary-report/
GET /apk/payment-type-report/
GET /apk/farewise-report/
GET /apk/passenger-info/
GET /apk/trip-details/
GET /apk/ticket-details/
GET /apk/expense-report/
GET /apk/stage-wise-report/
GET /apk/dashboard/
```

**APK File Uploads**
```http
POST /apk/upload-odometer-dat/
POST /apk/upload-expense-dat/
```

**Settlements & Payments**
```http
POST /postSettlementDetails/           # Mosambee webhook
POST /postPayoutCallback/              # Mosambee payout callback
GET  /get_settlement_data?from_date={}&to_date={}
GET  /get_payout_data?from_date={}&to_date={}
POST /verify_settlement/               # Manager action
GET  /get_settlement_summary?from_date={}&to_date={}
```

**Failed Payloads**
```http
GET  /failed-payloads/
POST /failed-payloads/{id}/retry/
```

**Data Import**
```http
POST /import-mdb/                      # MDB file upload & bulk import
POST /import-routes/validate/          # Excel route import validation
POST /import-routes/confirm/           # Excel route import confirmation
GET  /import-routes/template/          # Download import template
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
│   │   │   ├── auth.py              # CustomUser, UserDeviceMapping
│   │   │   ├── company.py           # Company, Depot, Dealer, ETMDevice, mappings
│   │   │   ├── master_data.py       # BusType, Route, Stage, Fare, Vehicle, Employee, Currency, Settings
│   │   │   ├── operations.py        # CrewAssignment, ExpenseMaster, Expense, InspectorDetails
│   │   │   ├── transactions.py      # RawDataLog, TransactionData, TripData, ScheduleData, OdometerData, ExpenseData
│   │   │   ├── payments.py          # MosambeeTransaction, MosambeePayoutCallback
│   │   │   └── managers.py          # Custom QuerySet managers
│   │   ├── serializers.py           # DRF serializers
│   │   ├── signals.py               # Auto-reconciliation, cascade deactivation, route sync
│   │   ├── tasks.py                 # Celery async tasks (payload processing, cleanup)
│   │   ├── views/
│   │   │   ├── web/
│   │   │   │   ├── auth.py              # Login, signup, token refresh
│   │   │   │   ├── company.py           # Company & license management
│   │   │   │   ├── users.py             # User CRUD
│   │   │   │   ├── depots.py            # Depot management
│   │   │   │   ├── dealers.py           # Dealer & mapping management
│   │   │   │   ├── executives.py        # Executive territory management
│   │   │   │   ├── device_approvals.py  # Device security workflow
│   │   │   │   ├── device_registry.py   # Device registration & assignment
│   │   │   │   ├── ticket_reports.py    # Transaction, trip, schedule reports
│   │   │   │   ├── settlements.py       # Settlement & payout management
│   │   │   │   ├── raw_data_logs.py     # Failed payload management & retry
│   │   │   │   ├── masterdata/
│   │   │   │   │   ├── transport.py     # Bus types, routes, stages, vehicles, fares
│   │   │   │   │   ├── crew.py          # Employee types, employees, crew assignments
│   │   │   │   │   └── settings.py      # Currencies, system settings, device profiles
│   │   │   │   └── imports/
│   │   │   │       ├── mdb.py           # MDB file import service
│   │   │   │       └── routes.py        # Excel route import
│   │   │   ├── palmtec/
│   │   │   │   ├── data_post.py         # Device data ingestion (ticket, trip, schedule, odometer, expense)
│   │   │   │   └── master_send.py       # Device sync file endpoints
│   │   │   ├── webhooks/
│   │   │   │   └── mosambee.py          # Mosambee payment & payout webhooks
│   │   │   └── apk/
│   │   │       ├── reports.py           # APK report endpoints
│   │   │       └── apk_upload.py        # DAT file uploads (odometer, expense)
│   │   ├── migrations/              # Database versioning
│   │   └── apps.py                  # Signal registration
│   └── .env
│
├── Frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                  # Button, Card, Input, Dialog, KPI Card, Charts
│   │   │   ├── ProtectedRoute.jsx   # Auth guard
│   │   │   ├── Sidebar.jsx          # Navigation sidebar
│   │   │   ├── RoleBasedHome.jsx    # Role-based route selector
│   │   │   └── ...
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   ├── Login.jsx
│   │   │   │   └── Signup.jsx
│   │   │   ├── dashboards/
│   │   │   │   ├── AdminHome.jsx        # Super admin dashboard
│   │   │   │   ├── CompanyDashboard.jsx # Company admin dashboard
│   │   │   │   ├── DealerDashboard.jsx  # Dealer view
│   │   │   │   ├── ExecutiveDashboard.jsx # Executive view
│   │   │   │   └── UserHome.jsx         # Role-based home router
│   │   │   ├── listings/
│   │   │   │   ├── CompanyListing.jsx
│   │   │   │   ├── DepotListing.jsx
│   │   │   │   ├── DealerListing.jsx
│   │   │   │   ├── UserListing.jsx
│   │   │   │   ├── RouteListing.jsx
│   │   │   │   ├── CurrencyListing.jsx
│   │   │   │   ├── EmployeeCombined.jsx
│   │   │   │   └── VehicleCombined.jsx
│   │   │   ├── operations/
│   │   │   │   ├── DealerManagement.jsx
│   │   │   │   ├── DeviceRegistry.jsx
│   │   │   │   ├── DeviceApprovals.jsx
│   │   │   │   ├── CrewAssignmentListing.jsx
│   │   │   │   ├── FareEditor.jsx       # Dynamic fare table editor
│   │   │   │   ├── StageEditor.jsx
│   │   │   │   └── ExpenseMasterPage.jsx
│   │   │   ├── reports/
│   │   │   │   ├── TicketDataPage.jsx
│   │   │   │   ├── TripDataPage.jsx
│   │   │   │   ├── ScheduleDataPage.jsx
│   │   │   │   └── settlements/
│   │   │   │       ├── SettlementsLayout.jsx
│   │   │   │       ├── TransactionPosting.jsx
│   │   │   │       └── PayoutPosting.jsx
│   │   │   └── tools/
│   │   │       ├── MdbImport.jsx
│   │   │       ├── DeviceDownload.jsx
│   │   │       ├── SettingsPage.jsx
│   │   │       └── FailedPayloadsPage.jsx
│   │   └── main.jsx                 # Router with 404 handling
│   └── .env
│
└── README.md
```

---

## 🗺️ Roadmap

### ✅ Completed (v1.0 - v1.1)

- [x] Depot management
- [x] Transaction & trip data collection
- [x] Reports with filters & Excel export
- [x] Payment reconciliation (Mosambee)
- [x] Auto-matching with signals
- [x] Settlement verification UI
- [x] Cursor-based polling (since parameter)
- [x] 404 handler with auto-redirect
- [x] Master data models (Bus Types, Routes, Stages, Vehicles, Fares)
- [x] Master data CRUD interfaces (all listings & editors)
- [x] Crew management (Employee Types, Employees, Crew Assignments)
- [x] MDB import service (bulk data import from Access files)
- [x] Dealer & Executive mappings (multi-party role support)
- [x] Device approval workflow (secure device authentication)
- [x] Currency management
- [x] Settings management
- [x] Multiple specialized dashboards (Admin, Company, Dealer, Executive)

### ✅ Completed (v1.2)

- [x] Company & Dealer Registration Flow Restructure
- [x] License Allocation & Management
- [x] User Access Control Enhancements
- [x] APK Report suite (duty, bus summary, payment type, farewise, passenger info, trip details, ticket details, stage-wise, expense, dashboard)
- [x] Expense Management (ExpenseMaster, Expense records, DAT file uploads, expense reports)
- [x] Payout callback tracking (MosambeePayoutCallback)
- [x] Failed payload management & retry
- [x] Device Registry with bulk assignment
- [x] Device sync endpoints (routes, crew, vehicles, settings, expenses served to ETM devices)
- [x] Raw data logging pipeline (RawDataLog → Celery → parsed models)
- [x] Odometer data capture (API ingestion and DAT file upload)
- [x] Schedule data tracking (schedule open/close merged into ScheduleData)
- [x] Route Excel import (validate, confirm, template download)
- [x] Inspector details tracking

### ✅ Completed (v1.2.1 - Current)

- [x] APK dashboard endpoint
- [x] Stage-wise and expense APK report endpoints

### 🚧 Pending

- [ ] Real-time GPS tracking integration

---

## 📊 Project Status

**Current Version**: 1.2.1
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

### Technical Updates
- Modular model structure (auth.py, company.py, master_data.py, operations.py, transactions.py, payments.py)
- Extended view layer organized by functional area
- Comprehensive API for master data CRUD operations
- Enhanced device security with approval workflow
- MDB file parsing and bulk import engine

---

## 🔧 Key Changes in v1.2

### Restructured Flows
- **Company Registration**: Enhanced validation, streamlined approval process
- **Dealer Registration**: Restructured workflow with better data consistency
- **License Management**: Complete lifecycle - allocation, validation, renewal, expiration

### New Features
- **Expense Management**: Full expense pipeline from device to report
- **APK Reports**: Complete suite of 10 report types for mobile device data
- **Device Registry**: ETM device registration with company/dealer bulk assignment
- **Device Sync**: On-demand master data file serving to ETM devices
- **Raw Data Pipeline**: RawDataLog → Celery task processing → parsed models
- **Odometer Tracking**: Per-trip odometer data via API and DAT uploads
- **Schedule Data**: Full schedule open/close lifecycle tracking
- **Failed Payload Retry**: View and requeue failed device payloads
- **Route Excel Import**: Validate, preview, and confirm route imports from Excel
- **Payout Tracking**: Mosambee payout callback ingestion and reporting
- **Inspector Details**: Inspector check record tracking

### Enhanced Security & Access Control
- **Granular User Permissions**: Fine-grained access control for dealer and executive roles
- **Cascade Deactivation**: Company/dealer deactivation propagates to all associated users via signals
- **Access Control Policies**: Better enforcement of company data isolation

### Technical Updates
- Celery tasks for all device payload types (ticket, trip, schedule, odometer, expense)
- Stale payload cleanup and archive tasks
- Django signals for cascade logic and fare/route name sync
- Modular view structure under `views/web/`, `views/palmtec/`, `views/webhooks/`, `views/apk/`

---

## 🔧 Key Changes in v1.2.1

- APK dashboard metrics endpoint
- Stage-wise revenue report endpoint
- Expense report endpoint

---

<div align="center">

By Adhwaith Krishnan

</div>
