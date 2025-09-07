# stockdata/serializers.py
from rest_framework import serializers
from .models import StockData

class StockDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockData
        fields = [
            'timestamp',
            'open_price',
            'high_price',
            'low_price',
            'close_price',
            'volume',
            'pct_change',
            'free_cash_flow',
            'eps',
            'profit_margin',
            'market_cap',
            'pe'
        ]