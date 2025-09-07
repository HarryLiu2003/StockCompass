from django.db import models

class StockData(models.Model):
    timestamp = models.DateTimeField(unique=True)
    open_price = models.FloatField(null=True)
    high_price = models.FloatField(null=True)
    low_price = models.FloatField(null=True)
    close_price = models.FloatField(null=True, default=None)  # Added default here
    volume = models.BigIntegerField(null=True, default=None)
    pct_change = models.FloatField(default=None, null=True)
    free_cash_flow = models.FloatField(default=None, null=True)
    eps = models.FloatField(null=True, blank=True, default=None)
    profit_margin = models.FloatField(null=True, blank=True, default=None)
    market_cap = models.FloatField(default=None, null=True)
    pe = models.FloatField(default=None,null=True)

    def __str__(self):
        return f"{self.timestamp} - Close: {self.close_price}"