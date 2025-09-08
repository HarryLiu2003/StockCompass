from django.urls import path
from .views import news_api, news_analysis_stream

urlpatterns = [
    path('api/news/', news_api, name='news_api'),
    path('api/news/stream/', news_analysis_stream, name='news_analysis_stream'),
]
