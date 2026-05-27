from django.contrib import admin
from django.urls import path, include


urlpatterns = [
    # Web dashboard (React)
    path('ticket-app/', include('TicketAppB.urls')),

    # APK / mobile clients  — versioned prefix so the APK bundle can be updated
    # independently of the web frontend.
    # All TicketAppB routes are reachable via either prefix; middleware and views
    # distinguish web vs APK by Bearer header vs cookie, not by URL.
    path('api/v1/', include('TicketAppB.urls')),
]
