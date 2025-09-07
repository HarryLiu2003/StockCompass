from django.urls import path
from .views import news_api

urlpatterns = [
    path('api/news/', news_api, name='news_api'),
]
