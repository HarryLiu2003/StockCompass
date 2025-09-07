# project/urls.py
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

def health_check(request):
    """Simple health check endpoint for Railway"""
    return JsonResponse({"status": "healthy", "service": "StockCompass"})

urlpatterns = [
    path('health/', health_check, name='health_check'),  # Health check for Railway
    path('admin/', admin.site.urls),
    path('', include('stockdata.urls')),  # Include the stockdata app's urls
    path('', include('newsdata.urls')),
    path('', include('chatbot.urls')),
]
