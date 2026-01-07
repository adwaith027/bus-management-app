from django.contrib import admin
from django.urls import path,include


urlpatterns = [
    path('ticket-app/', include('TicketAppB.urls')),
]
