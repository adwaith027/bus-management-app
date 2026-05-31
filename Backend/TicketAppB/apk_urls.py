from django.urls import path
from .views.web import auth as auth_views
from .views.apk import reports as apk_views

urlpatterns = [
    # auth
    path('login',         auth_views.login_view,         name='apk_login'),
    path('logout',        auth_views.logout_view,         name='apk_logout'),
    path('token/refresh', auth_views.refresh_token_view,  name='apk_token_refresh'),
    path('verify-auth',   auth_views.verify_auth,         name='apk_verify_auth'),

    # dashboard flow
    path('apk/buses',           apk_views.apk_bus_list,       name='apk_bus_list'),
    path('apk/dashboard',       apk_views.apk_dashboard,      name='apk_dashboard'),
    path('apk/bus-trips',       apk_views.apk_bus_trips,      name='apk_bus_trips'),
    path('apk/ticket-details',  apk_views.apk_ticket_details, name='apk_ticket_details'),
    path('apk/passenger-info',  apk_views.apk_passenger_info, name='apk_passenger_info'),

    # reports
    path('reports/duty',          apk_views.duty_report,          name='apk_duty_report'),
    path('reports/bus-summary',   apk_views.bus_summary_report,   name='apk_bus_summary'),
    path('reports/payment-type',  apk_views.payment_type_report,  name='apk_payment_type'),
    path('reports/farewise',      apk_views.farewise_report,      name='apk_farewise'),
    path('reports/expense',       apk_views.expense_report,       name='apk_expense'),
]
