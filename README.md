# Bus Ticketing Management System

<div align="center">

![License](https://img.shields.io/badge/license-Private-red.svg)
![Python](https://img.shields.io/badge/python-3.11+-blue.svg)
![Django](https://img.shields.io/badge/django-5.2-green.svg)
![React](https://img.shields.io/badge/react-18.0-blue.svg)
![Version](https://img.shields.io/badge/version-1.3-orange.svg)

Private multi-tenant platform for bus fleet operations with real-time ticketing, payment reconciliation, and comprehensive reporting.

</div>

---

## 📋 Overview

The **Bus Ticketing Management System** (Palmtec Amphibia QR) streamlines bus operations for transport companies through:

- **Multi-Tenant Architecture** - Manage multiple companies with isolated data
- **Real-Time Device Integration** - Direct ticketing device communication via HTTP
- **Automated Payment Reconciliation** - Match UPI payments with ticket transactions
- **Role-Based Access** - Granular permissions (Super Admin, Company Admin, User)
- **Android APK Integration** - Dedicated mobile API for field reporting

---

## ✨ Features

### 🏢 Company & User Management
- Multi-company support with external license validation
- User management with role-based access control (superadmin, company_admin, company_user, dealer_admin, executive)
- Tier system (premium, intermediate, basic) controlling feature access
- Depot organization across locations
- Password management with session termination
- Device approval workflow for APK security

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
- **ETM Device Registry** - ETM device registration with company/dealer assignment
- **Device Approvals** - Secure device-to-user binding workflow for APK logins
- **Session Management** - View and force-logout active user sessions
- **Device Sync** - On-demand master data files (routes, crew, vehicles, settings, expenses) served to devices
- **Failed Payload Retry** - View and requeue failed device data payloads

### 🏢 Dealer & Executive Management
- **Dealer Management** - Dealer registration with license server integration
- **Dealer Mappings** - Dealer-to-company association management
- **Executive Mappings** - Executive territory management with granular permissions
- **Specialized Dashboards** - Role-specific views with transaction visibility
- **User Access Control** - Granular permission system for dealer and executive roles

### 🏢 Operational Management
- **Depot Management** - Transit hub/depot configuration
- **Settings Management** - System and company-level configurations with device settings profiles
- **License Allocation & Management** - License lifecycle management (register, validate, sync)
- **Company Registration Flow** - Enhanced validation and approval process
- **Global Settings** - System-wide configuration and About page

### 🔐 Security
- Server-side session authentication with Redis cache (single `pqr_session` HttpOnly cookie)
- Session idle timeout with frontend idle timer and keepalive
- Force-logout for active sessions (company admin and superadmin)
- Checksum validation (SHA512) for payment and device data
- Role-based UI rendering with tier enforcement
- Device UUID approval workflow for APK logins
- Company/dealer cascade deactivation via signals
- Audit logging for all management actions

---

## 🛠️ Tech Stack

**Backend**
- Django 5.2 + Django REST Framework
- MariaDB with timezone support (Asia/Kolkata)
- Server-side session authentication (opaque cookie, Redis-backed)
- Django Signals for auto-reconciliation and cascading logic
- **Celery + Redis** for async task processing and session cache
- **MDB Parser** for bulk data import from Access files
- **Flower** for Celery task monitoring

**Frontend**
- React 18 with Vite
- React Router v6
- Tailwind CSS
- Axios (session cookie sent automatically — no token refresh cycle)
- ExcelJS for exports
- Dynamic form builders for master data CRUD

---

## 🏗️ System Architecture

```
              Ticketing Devices (HTTP GET) → Django Backend → MariaDB
                                        ↓
                          License Server (Background Polling)
                                        ↓
                        React Frontend (Session Auth, Role-Based UI)
                                        ↓
                          Mosambee Payment Gateway (POST)
                                        ↓
                        Android APK (api/v1/ prefix, session cookie)
```

### Key Data Flow

1. **Ticket Transactions**: Devices send pipe-delimited data via GET → stored as RawDataLog → Celery parses to TransactionData
2. **Trip/Schedule Lifecycle**: Open and close payloads merged into TripData / ScheduleData
3. **Payment Gateway**: Mosambee POSTs UPI transaction data → stored as MosambeeTransaction
4. **Auto-Reconciliation**: Django signal matches payments to tickets
5. **Manager Verification**: Manual review before settlement
6. **Device Sync**: Devices fetch route, crew, vehicle, settings, and expense files built from current DB state
7. **Session Flow**: Login → `pqr_session` cookie (Redis-backed) → auto-expire on idle → Celery sweep reconciles DB

---

## 🚀 Installation

### Prerequisites
- Python 3.11+, Node.js 22+, MariaDB, Redis

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

# Start Celery worker (separate terminal)
celery -A Backend worker -l info

# Start Celery beat scheduler (separate terminal)
celery -A Backend beat -l info
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

# Session
SESSION_IDLE_TIMEOUT=1200   # seconds (20 min web idle timeout)

# Redis (Celery broker + session cache)
REDIS_URL=redis://localhost:6379/0

# License Server
LICENSE_SERVER_BASE_URL=http://your-license-server.com/api
PRODUCT_REGISTRATION_ENDPOINT=/ProductRegistration
PRODUCT_AUTH_ENDPOINT=/ProductAuthentication

# Payment Gateway
MOSAMBEE_SALT=your-mosambee-salt-key

# App Info
APP_VERSION=1.3
PROJECT_NAME=Bus Ticketing System
```

---

## 📖 Usage

### Session Authentication

All authenticated requests use a single `pqr_session` HttpOnly cookie. The cookie is issued at login, reset by the keepalive endpoint, and cleared on logout. No manual token management is needed on the client — Axios sends the cookie automatically with `withCredentials: true`.

### License Validation Workflow

1. Register company → Get `company_id`
2. Click "Validate License" → Backend polls external server (3s intervals, 2min max)
3. Status: Pending → Validating → Approved/Expired/Blocked

### Session Conflict

If a user logs in from a second device, the server returns `SESSION_CONFLICT`. The frontend prompts: keep the existing session or force-logout the other device and proceed.

---

## 🔌 API Documentation

### Web Dashboard API (`/`)

#### Authentication
```http
POST /login
POST /logout
POST /session/keepalive
GET  /verify-auth
POST /auth/forgot-password
POST /auth/reset-password
```

#### Session & Device Approvals
```http
GET  /sessions
POST /sessions/{session_uid}/force-logout
GET  /device-approvals
POST /device-approvals/{id}/approve
POST /device-approvals/{id}/reject
GET  /admin/sessions                              # superadmin only
POST /admin/sessions/{session_uid}/force-logout   # superadmin only
```

#### Companies & Depots
```http
GET  /customer-data
POST /create-company
PUT  /update-company-details/{id}
DELETE /delete-company/{id}
POST /register-company-license/{id}
POST /validate-company-license/{id}
POST /sync-company-license/{id}
POST /sync-company-license/{id}/confirm
GET  /get-company-by-company-id/{company_id}
POST /import-company
GET  /get_company_dashboard_metrics
GET  /get_admin_data
GET  /depots
POST /create-depot
PUT  /update-depot-details/{id}
DELETE /delete-depoteva/{id}
```

#### Users
```http
GET  /get_users
POST /create_user
PUT  /update_user/{id}
POST /users/{id}/toggle-active
GET  /users/capacity
POST /change_user_password/{id}
```

#### ETM Device Registry
```http
POST /etm-devices/upload
GET  /etm-devices
GET  /etm-devices/summary
POST /etm-devices/bulk-assign-dealer
POST /etm-devices/bulk-assign-company
POST /etm-devices/{id}/allocate
POST /etm-devices/{id}/deactivate
POST /etm-devices/{id}/reactivate
POST /etm-devices/{id}/unmap
POST /etm-devices/{id}/return-to-stock
POST /etm-devices/{id}/set-palmtec-id
POST /etm-devices/{id}/set-mosambee-tid
```

#### Device Sync (ETM ← Web App)
```http
GET /device/routes
GET /device/settings
GET /device/crew
GET /device/vehicles
GET /device/expenses
GET /device/routelst
GET /device/stagelst
GET /device/languagedat
GET /device/rtedat
GET /device/currency
GET /getEtmSetupDetails
```

#### Master Data — Transport
```http
GET  /masterdata/bus-types
POST /masterdata/bus-types/create
PUT  /masterdata/bus-types/update/{id}
GET  /masterdata/stages
POST /masterdata/stages/create
PUT  /masterdata/stages/update/{id}
GET  /masterdata/routes
POST /masterdata/routes/create
PUT  /masterdata/routes/update/{id}
GET  /masterdata/routes/{id}
POST /masterdata/routes/create-wizard
POST /masterdata/routes/import-excel
POST /masterdata/routes/import/validate
POST /masterdata/routes/import/confirm
GET  /masterdata/routes/import/template/{fare_type}
PUT  /masterdata/routestages/update/{id}
GET  /masterdata/vehicles
POST /masterdata/vehicles/create
PUT  /masterdata/vehicles/update/{id}
GET  /masterdata/fares/editor/{route_id}
PUT  /masterdata/fares/update/{route_id}
GET  /masterdata/dropdowns/bus-types
GET  /masterdata/dropdowns/stages
GET  /masterdata/dropdowns/vehicles
GET  /masterdata/dropdowns/depots
```

#### Master Data — Crew
```http
GET  /masterdata/employee-types
POST /masterdata/employee-types/create
PUT  /masterdata/employee-types/update/{id}
GET  /masterdata/employees
POST /masterdata/employees/create
PUT  /masterdata/employees/update/{id}
GET  /masterdata/crew-assignments
POST /masterdata/crew-assignments/create
PUT  /masterdata/crew-assignments/update/{id}
DELETE /masterdata/crew-assignments/delete/{id}
GET  /masterdata/dropdowns/employee-types
GET  /masterdata/dropdowns/employees
```

#### Master Data — Settings & Currencies
```http
GET  /masterdata/currencies
POST /masterdata/currencies/create
PUT  /masterdata/currencies/update/{id}
GET  /masterdata/settings
GET  /masterdata/device-settings/devices
GET  /masterdata/settings-profiles
POST /masterdata/settings-profiles/create
GET  /masterdata/settings-profiles/{profile_id}
```

#### Dealer & Executive Management
```http
GET  /dealers
POST /create-dealer
PUT  /update-dealer-details/{id}
DELETE /delete-dealer/{id}
POST /register-dealer-license/{id}
POST /validate-dealer-license/{id}
POST /sync-dealer-license/{id}
POST /sync-dealer-license/{id}/confirm
GET  /dealer-mappings
POST /create-dealer-mapping
PUT  /update-dealer-mapping/{id}
GET  /dealer-dashboard
GET  /executive-mappings
POST /create-executive-mapping
PUT  /update-executive-mapping/{id}
GET  /executive-dashboard
```

#### Transaction Data — Device Push (ETM → Server)
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

#### Reports — Web Fetch
```http
GET /get_all_transaction_data?from_date={date}&to_date={date}&since={timestamp}
GET /get_all_trip_data?from_date={date}&to_date={date}&since={timestamp}
GET /get_all_schedule_data?from_date={date}&to_date={date}&since={timestamp}
```

#### Settlements & Payments
```http
POST /postTransactionDetails           # Mosambee webhook
POST /postPayoutDetails                # Mosambee payout callback
GET  /get_settlement_data?from_date={}&to_date={}
GET  /get_payout_data?from_date={}&to_date={}
POST /verify_settlement
GET  /get_settlement_summary?from_date={}&to_date={}
```

#### Failed Payloads
```http
GET  /failed-payloads
POST /failed-payloads/{id}/retry
```

#### Data Import
```http
POST /import-mdb                              # MDB file upload & bulk import
```

#### Audit Logs
```http
GET /audit-logs
GET /audit-logs/action-types
```

#### Global Settings & About
```http
GET     /about
GET|PUT /global-settings
```

---

### APK API (`/api/v1/`)

All APK endpoints are under the `/api/v1/` prefix. Only `company_user` role can log in via APK. Admin accounts are web-only.

Auth uses the same `pqr_session` HttpOnly cookie. The APK HTTP client must persist and send this cookie on every request (same as a browser).

#### Authentication
```http
POST /api/v1/login
POST /api/v1/logout
GET  /api/v1/verify-auth
```

Login body must include `device_type: "android"` and `uuid: "<hardware UUID>"`. First login from an unknown UUID returns `403 DEVICE_PENDING` until a company admin approves it.

#### APK Dashboard & Drill-Down
```http
GET /api/v1/apk/dashboard?date={YYYY-MM-DD}
GET /api/v1/apk/buses
GET /api/v1/apk/schedules?bus_no={}&date={}
GET /api/v1/apk/trips?bus_no={}&date={}
GET /api/v1/apk/tickets?bus_no={}&trip_no={}&route_code={}&date={}
GET /api/v1/apk/passengers?bus_no={}&trip_no={}&route_code={}&date={}
```

#### APK Reports (requires tier `intermediate` or above)
```http
GET /api/v1/reports/duty?bus_no={}&date={}
GET /api/v1/reports/bus-summary?bus_no={}&from_date={}&to_date={}
GET /api/v1/reports/payment-type?bus_no={}&from_date={}&to_date={}[&payment_mode={cash|upi}]
GET /api/v1/reports/farewise?bus_no={}&from_date={}&to_date={}
GET /api/v1/reports/expense?bus_no={}&from_date={}&to_date={}
```

#### APK Master Data Download
```http
GET /api/v1/device/getEtmVersion
GET /api/v1/device/routes
GET /api/v1/device/settings
GET /api/v1/device/crew
GET /api/v1/device/vehicles
GET /api/v1/device/expenses
GET /api/v1/device/routelst
GET /api/v1/device/stagelst
GET /api/v1/device/languagedat
GET /api/v1/device/rtedat
GET /api/v1/device/currency
```

#### APK File Upload
```http
POST /api/v1/upload/odometer-dat
POST /api/v1/upload/expense-dat
```

---

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

> **IIS deployment note**: Set `maxQueryString="8192"` in `web.config` before production deploy. Default 2048-byte limit can be exceeded by large ShdCls/Ticket payloads.

---

## 📁 Project Structure

```
bus-ticketing-system/
├── Backend/
│   ├── Backend/
│   │   └── settings.py              # Django config (Timezone: Asia/Kolkata)
│   ├── TicketAppB/
│   │   ├── models/
│   │   │   ├── auth.py              # CustomUser, UserSession, UserApprovedDevice, DevicePendingApproval
│   │   │   ├── company.py           # Company, Depot, Dealer, ETMDevice, mappings
│   │   │   ├── master_data.py       # BusType, Route, Stage, Fare, Vehicle, Employee, Currency, Settings
│   │   │   ├── operations.py        # CrewAssignment, ExpenseMaster, Expense, InspectorDetails
│   │   │   ├── transactions.py      # RawDataLog, TransactionData, TripData, ScheduleData, OdometerData, ExpenseData
│   │   │   ├── payments.py          # MosambeeTransaction, MosambeePayoutCallback
│   │   │   └── managers.py          # Custom QuerySet managers
│   │   ├── authentication.py        # SessionAuthentication DRF backend (Redis + DB)
│   │   ├── permissions.py           # LicensePermission DRF permission class
│   │   ├── serializers.py           # DRF serializers
│   │   ├── signals.py               # Auto-reconciliation, cascade deactivation, route sync
│   │   ├── tasks.py                 # Celery async tasks (payload processing, cleanup, session sweep)
│   │   ├── urls.py                  # Web dashboard URL patterns
│   │   ├── apk_urls.py              # APK-exclusive URL patterns (/api/v1/)
│   │   ├── views/
│   │   │   ├── web/
│   │   │   │   ├── auth.py              # Login, logout, keepalive, verify-auth, password reset
│   │   │   │   ├── sessions.py          # Session management, device approvals
│   │   │   │   ├── company.py           # Company & license management
│   │   │   │   ├── users.py             # User CRUD
│   │   │   │   ├── depots.py            # Depot management
│   │   │   │   ├── dealers.py           # Dealer & mapping management
│   │   │   │   ├── executives.py        # Executive territory management
│   │   │   │   ├── device_registry.py   # ETM device registration & assignment
│   │   │   │   ├── ticket_reports.py    # Transaction, trip, schedule reports
│   │   │   │   ├── settlements.py       # Settlement & payout management
│   │   │   │   ├── raw_data_logs.py     # Failed payload management & retry
│   │   │   │   ├── audit_logs.py        # Audit log listing and log_action() helper
│   │   │   │   ├── global_settings.py   # About page and global settings
│   │   │   │   ├── masterdata/
│   │   │   │   │   ├── transport.py     # Bus types, routes, stages, vehicles, fares
│   │   │   │   │   ├── crew.py          # Employee types, employees, crew assignments
│   │   │   │   │   └── settings.py      # Currencies, system settings, device profiles
│   │   │   │   └── imports/
│   │   │   │       ├── mdb.py           # MDB file import service
│   │   │   │       └── routes.py        # Excel route import
│   │   │   ├── palmtec/
│   │   │   │   └── data_post.py         # Device data ingestion (ticket, trip, schedule, odometer, expense)
│   │   │   ├── webhooks/
│   │   │   │   └── mosambee.py          # Mosambee payment & payout webhooks
│   │   │   ├── apk/
│   │   │   │   ├── master_send.py       # APK/device master data file endpoints
│   │   │   │   ├── reports.py           # APK report endpoints
│   │   │   │   └── apk_upload.py        # DAT file uploads (odometer, expense)
│   │   │   └── setup_data.py            # ETM initial setup data
│   │   ├── migrations/              # Database versioning
│   │   └── apps.py                  # Signal registration
│   └── .env
│
├── Frontend/
│   ├── src/
│   │   ├── assets/js/
│   │   │   └── axiosConfig.js       # Axios instance (withCredentials, no refresh cycle)
│   │   ├── hooks/
│   │   │   └── useIdleTimer.js      # Idle detection, keepalive, session timeout
│   │   ├── components/
│   │   │   ├── ui/                  # Button, Card, Input, Dialog, KPI Card, Charts
│   │   │   ├── ProtectedRoute.jsx   # Auth guard
│   │   │   ├── Sidebar.jsx          # Navigation sidebar
│   │   │   └── ...
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   └── Login.jsx        # Includes SESSION_CONFLICT force-login flow
│   │   │   ├── dashboards/
│   │   │   │   ├── AdminHome.jsx
│   │   │   │   ├── CompanyDashboard.jsx
│   │   │   │   ├── DealerDashboard.jsx
│   │   │   │   └── ExecutiveDashboard.jsx
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
│   │   │   │   ├── SessionManagement.jsx
│   │   │   │   ├── CrewAssignmentListing.jsx
│   │   │   │   ├── FareEditor.jsx
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
│   │   │       ├── FailedPayloadsPage.jsx
│   │   │       ├── AuditLogsPage.jsx
│   │   │       └── AboutPage.jsx
│   │   └── main.jsx                 # Router with 404 handling
│   └── .env
│
├── _docs/                           # Internal specs and design references
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
- [x] License Allocation & Management (register, validate, sync)
- [x] User Access Control Enhancements (tier system)
- [x] APK Report suite (duty, bus summary, payment type, farewise, passenger info, trip details, ticket details, stage-wise, expense, dashboard)
- [x] Expense Management (ExpenseMaster, Expense records, DAT file uploads, expense reports)
- [x] Payout callback tracking (MosambeePayoutCallback)
- [x] Failed payload management & retry (with retry count cap)
- [x] ETM Device Registry with bulk assignment, allocate, deactivate, unmap, return-to-stock
- [x] Device sync endpoints (routes, crew, vehicles, settings, expenses served to ETM devices)
- [x] Raw data logging pipeline (RawDataLog → Celery → parsed models)
- [x] Odometer data capture (API ingestion and DAT file upload)
- [x] Schedule data tracking (schedule open/close merged into ScheduleData)
- [x] Route Excel import (validate, confirm, template download)
- [x] Inspector details tracking
- [x] MDB concurrent import lock (per-company, MariaDB GET_LOCK)

### ✅ Completed (v1.3 - Current)

- [x] **Auth system overhaul**: JWT replaced with server-side opaque session (single `pqr_session` cookie, Redis-backed)
- [x] Session management UI — list active sessions, force-logout (company admin + superadmin)
- [x] Session conflict handling — `SESSION_CONFLICT` flow with force-login option
- [x] Frontend idle timer + keepalive (`useIdleTimer` hook, `POST /session/keepalive`)
- [x] Celery `sweep_stale_sessions` task (reconciles DB with Redis TTL expiry)
- [x] Audit logging — 24 call sites across all management views
- [x] Forgot password / reset password flow
- [x] Company and dealer delete endpoints
- [x] Separate APK URL prefix (`api/v1/`) with APK-specific auth, reports, masterdata download, and file upload
- [x] APK masterdata download endpoints (`api/v1/device/*`)
- [x] APK file upload endpoints (`api/v1/upload/*`)
- [x] Global settings + About page endpoint
- [x] Device set-mosambee-tid, reactivate, return-to-stock endpoints
- [x] User toggle-active and capacity endpoints

### 🚧 Pending

- [ ] **Ghost session fix** — proper backend idle check at `/token/refresh` once `last_seen_at` heartbeat and APK-vs-web threshold are solved (see `_docs/pending-implementations.txt`)
- [ ] **Logout delay** — HTTP/2 via nginx+gunicorn in production eliminates the HTTP/1.1 6-connection pool queue (see `_docs/pending-implementations.txt`)
- [ ] **About page company block** — extend `GET /about` to include company name, active user count, admin names, allocated device count for company-scoped users
- [ ] **Route code string snapshot** — store `route_code_str` alongside FK on TransactionData/TripData for deleted-route recovery
- [ ] **Stage name resolution** — resolve `from_stage`/`to_stage` ordinals to stage names via route FK
- [ ] **APK settlement / UPI payment data** — expose settlement and payout data via `api/v1/` endpoints for the APK
- [ ] **Masterdata upload API expansion** — extend APK upload endpoints beyond odometer and expense DAT files as needed
- [ ] **Company under dealer — license pool** — dealer's remaining counts pool, deduction on company creation, restoration on deletion
- [ ] **Sync on license count reduction** — dry-run excess user display, selective deactivation flow
- [ ] **Server-side pagination** — trip/ticket/schedule report pages (trigger: 50+ buses or >5MB responses)
- [ ] **Serial number reassignment** — superadmin-only, clears all active mappings with audit trail
- [ ] **Dealer MDB import for client companies** — dealer admin triggers import on behalf of managed company
- [ ] **Superadmin operational data access** — select a company and browse their reports/masterdata
- [ ] **Email & push notifications** — license expiry warnings (10-day, 5-day), unmapped device/route alerts
- [ ] **Real-time GPS tracking integration**

---

## 📊 Project Status

**Current Version**: 1.3
**Status**: Active Development
**Last Updated**: June 2026

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
- MDB file parsing and bulk import engine

---

## 🔧 Key Changes in v1.2

### Restructured Flows
- **Company Registration**: Enhanced validation, streamlined approval process
- **Dealer Registration**: Restructured workflow with better data consistency
- **License Management**: Complete lifecycle — allocation, validation, renewal, expiration

### New Features
- **Expense Management**: Full expense pipeline from device to report
- **APK Reports**: Complete suite of 10 report types for mobile device data
- **ETM Device Registry**: Device registration with company/dealer bulk assignment
- **Device Sync**: On-demand master data file serving to ETM devices
- **Raw Data Pipeline**: RawDataLog → Celery task processing → parsed models
- **Odometer Tracking**: Per-trip odometer data via API and DAT uploads
- **Schedule Data**: Full schedule open/close lifecycle tracking
- **Failed Payload Retry**: View and requeue failed device payloads with retry cap
- **Route Excel Import**: Validate, preview, and confirm route imports from Excel
- **Payout Tracking**: Mosambee payout callback ingestion and reporting
- **Inspector Details**: Inspector check record tracking
- **MDB Concurrent Lock**: Per-company import lock via MariaDB GET_LOCK

### Technical Updates
- Celery tasks for all device payload types (ticket, trip, schedule, odometer, expense)
- Stale payload cleanup and archive tasks
- Django signals for cascade logic and fare/route name sync
- Modular view structure under `views/web/`, `views/palmtec/`, `views/webhooks/`, `views/apk/`

---

## 🔧 Key Changes in v1.3

### Auth System Overhaul
- **Removed**: `rest_framework_simplejwt`, three-cookie system (access_token, refresh_token, session_uid), 401→refresh→retry cycle on the frontend
- **Added**: Single opaque `pqr_session` HttpOnly cookie, DRF `SessionAuthentication` backend reading from Redis (with DB fallback), `LicensePermission` DRF class replacing middleware
- **Frontend**: `axiosConfig.js` simplified — no `refreshApi`, no retry interceptor. 401 means session dead → redirect to login
- **Idle timer**: `useIdleTimer` hook with keepalive, warning modal at T-3min, auto-logout at idle timeout
- **Session conflict**: `SESSION_CONFLICT` error code with force-login option replaces `ALREADY_LOGGED_IN`

### New Endpoints
- `POST /session/keepalive` — resets Redis TTL and `last_seen_at`
- `GET /sessions`, `POST /sessions/{uid}/force-logout` — company admin session management
- `GET /admin/sessions`, `POST /admin/sessions/{uid}/force-logout` — superadmin session management
- `POST /auth/forgot-password`, `POST /auth/reset-password` — self-service password reset
- `DELETE /delete-company/{id}`, `DELETE /delete-dealer/{id}` — soft-delete support
- `POST /sync-company-license/{id}[/confirm]`, `POST /sync-dealer-license/{id}[/confirm]` — license sync
- `GET /audit-logs`, `GET /audit-logs/action-types` — audit trail
- `GET|PUT /global-settings`, `GET /about`
- Separate `api/v1/` APK URL space with own auth, drill-down, reports, masterdata, and upload endpoints

### Technical Updates
- `TicketAppB/authentication.py` + `TicketAppB/permissions.py` — clean DRF separation
- `sweep_stale_sessions` Celery task reconciles DB with Redis TTL expiry every 10 minutes
- All 24 management views emit audit log entries via `log_action()`

---

<div align="center">

By Adhwaith Krishnan

</div>
