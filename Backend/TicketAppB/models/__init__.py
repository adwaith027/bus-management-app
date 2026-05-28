# Auth models
from .auth import CustomUser, UserRole, UserTier, UserSession

AUTH_MODELS = ['CustomUser', 'UserRole', 'UserTier', 'UserSession']


# Company models
from .company import Company, Depot, Dealer, ETMDevice

COMPANY_MODELS = ['Company', 'Depot', 'Dealer', 'ETMDevice']


# Audit / System models
from .audit import GlobalSettings, AuditLog

AUDIT_MODELS = ['GlobalSettings', 'AuditLog']


# Master data models
from .master_data import (
    BusType,
    EmployeeType,
    Employee,
    Currency,
    Stage,
    Route,
    RouteStage,
    Fare,
    RouteBusType,
    RouteDepot,
    VehicleType,
    Settings,
    SettingsProfile,
)

MASTER_DATA_MODELS = [
    'BusType',
    'EmployeeType',
    'Employee',
    'Currency',
    'Stage',
    'Route',
    'RouteStage',
    'Fare',
    'RouteBusType',
    'RouteDepot',
    'VehicleType',
    'Settings',
    'SettingsProfile',
]


# Operations models
from .operations import (
    ExpenseMaster,
    Expense,
    CrewAssignment,
    InspectorDetails,
)

OPERATIONS_MODELS = ['ExpenseMaster', 'Expense', 'CrewAssignment', 'InspectorDetails']


# Transaction models
from .transactions import (
    TransactionData,
    ScheduleData,
    TripData,
    OdometerData,
    ExpenseData,
    RawDataLog,
    Direction,
)

TRANSACTION_MODELS = [
    'TransactionData', 'ScheduleData', 'TripData',
    'OdometerData', 'ExpenseData', 'RawDataLog', 'Direction',
]

# Payment models
from .payments import MosambeeTransaction, MosambeePayoutCallback

PAYMENT_MODELS = ['MosambeeTransaction', 'MosambeePayoutCallback']


# Public export surface
__all__ = (
    AUTH_MODELS
    + COMPANY_MODELS
    + AUDIT_MODELS
    + MASTER_DATA_MODELS
    + OPERATIONS_MODELS
    + TRANSACTION_MODELS
    + PAYMENT_MODELS
)
