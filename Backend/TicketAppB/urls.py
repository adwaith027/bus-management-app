from django.urls import path
from .views import auth_views,company_views,user_views,data_views,branch_views,mosambee_views,dealer_views,executive_views,device_approval_views


urlpatterns = [
    # authentication
    path('signup/', auth_views.signup_view, name='signup'),
    path('login/', auth_views.login_view, name='login'),
    path('token/refresh/', auth_views.refresh_token_view, name='token_refresh'),
    path('logout/', auth_views.logout_view, name='logout'),
    path('release-device/', auth_views.release_device_view, name='release_device'),
    path('protected/', auth_views.protected_view, name='protected'),
    path('verify-auth/', auth_views.verify_auth, name='verify_auth'),
    path('device-approvals/', device_approval_views.get_device_approvals, name='device_approvals'),
    path('device-approvals/<int:mapping_id>/approve/', device_approval_views.approve_device, name='approve_device'),
    path('device-approvals/<int:mapping_id>/revoke/', device_approval_views.revoke_device, name='revoke_device'),

    # user data
    path('create_user/',user_views.create_user,name='create-user'),
    path('get_users/',user_views.get_all_users,name='get_all_users'),
    path('update_user/<int:user_id>/', user_views.update_user, name='update_user'),
    path('change_user_password/<int:user_id>/', user_views.change_user_password, name='change_user_password'),

    # company data
    path('customer-data/', company_views.all_company_data, name='company_data'),
    path('create-company/', company_views.create_company, name='create_company'),
    path('update-company-details/<int:pk>/', company_views.update_company_details, name='update_company'),
    path('register-company-license/<int:pk>/', company_views.register_company_with_license_server, name='register_company_license'),  # NEW
    path('validate-company-license/<int:pk>/', company_views.validate_company_license, name='validate_company_license'),
    path("get_company_dashboard_metrics/", company_views.get_company_dashboard_metrics,name='company_dashboard_data'),

    # branch data
    path("branches/", branch_views.get_all_branches,name='get_all_branches'),
    path("create-branch/", branch_views.create_branch,name='create_branch'),
    path("update-branch-details/<int:pk>/", branch_views.update_branch_details,name='update_branch_details'),

    # ticket data
    path('getTicket/',data_views.getTransactionDataFromDevice,name='get_transaction_data'),
    path('get_all_transaction_data/',data_views.get_all_transaction_data,name='get_all_transaction_data'),
    path('getTripClose/',data_views.getTripCloseDataFromDevice,name='get_trip_close_data'),
    path('get_all_trip_close_data/',data_views.get_all_trip_close_data,name='get_all_trip_close_data'),

    # mosambee data
    path('postSettlementDetails/',mosambee_views.mosambee_settlement_data,name='postSettlementDetails'),
    path('get_settlement_data', mosambee_views.get_settlement_data, name='get_settlement_data'),
    path('verify_settlement', mosambee_views.verify_settlement, name='verify_settlement'),
    path('get_settlement_summary', mosambee_views.get_settlement_summary, name='get_settlement_summary'),
    
    # admin dashboard data
    path('get_admin_data/',data_views.get_admin_dashboard_data,name='get_admin_dashboard_data'),

    # dealer data
    path('dealers/', dealer_views.get_all_dealers, name='get_all_dealers'),
    path('create-dealer/', dealer_views.create_dealer, name='create_dealer'),
    path('update-dealer-details/<int:pk>/', dealer_views.update_dealer_details, name='update_dealer_details'),
    path('dealer-mappings/', dealer_views.get_dealer_mappings, name='get_dealer_mappings'),
    path('create-dealer-mapping/', dealer_views.create_dealer_mapping, name='create_dealer_mapping'),
    path('update-dealer-mapping/<int:pk>/', dealer_views.update_dealer_mapping, name='update_dealer_mapping'),
    path('dealer-dashboard/', dealer_views.dealer_dashboard, name='dealer_dashboard'),

    # executive data
    path('executive-mappings/', executive_views.get_executive_mappings, name='get_executive_mappings'),
    path('create-executive-mapping/', executive_views.create_executive_mapping, name='create_executive_mapping'),
    path('update-executive-mapping/<int:pk>/', executive_views.update_executive_mapping, name='update_executive_mapping'),
    path('executive-dashboard/', executive_views.executive_dashboard, name='executive_dashboard'),
]
