# project/urls.py
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('stockdata.urls')),  # Include the stockdata app's urls
    path('', include('newsdata.urls')),
    path('', include('chatbot.urls')),
]
