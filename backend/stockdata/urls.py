# stockdata/urls.py
from django.urls import path
from .views import *

urlpatterns = [
    path('api/stockdata/', stock_data_api, name='stock_data_api'),
    path('api/unusual_range/', unusual_ranges_api, name='unusual_range_api'),
    path('api/stock_metadata/', stock_metadata_api, name='stock_metadata_api'),
]
