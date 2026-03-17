# Auth models
from .auth import CustomUser, UserDeviceMapping

AUTH_MODELS = ['CustomUser', 'UserDeviceMapping']


# Company models
from .company import Company, Depot, Dealer, DealerCustomerMapping, ExecutiveCompanyMapping

COMPANY_MODELS = ['Company','Depot','Dealer','DealerCustomerMapping','ExecutiveCompanyMapping',]


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
    VehicleType,
    Settings,
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
    'VehicleType',
    'Settings',
]


# Operations models
from .operations import (
    ExpenseMaster,
    Expense,
    CrewAssignment,
    InspectorDetails,
)

OPERATIONS_MODELS = ['ExpenseMaster','Expense','CrewAssignment','InspectorDetails',]


# Transaction models
from .transactions import (TransactionData,TripCloseData,RawDataLog,)

TRANSACTION_MODELS = ['TransactionData','TripCloseData','RawDataLog',]

# Payment models
from .payments import MosambeeTransaction

PAYMENT_MODELS = ['MosambeeTransaction',]


# Public export surface
__all__ = (
    AUTH_MODELS
    + COMPANY_MODELS
    + MASTER_DATA_MODELS
    + OPERATIONS_MODELS
    + TRANSACTION_MODELS
    + PAYMENT_MODELS
)
