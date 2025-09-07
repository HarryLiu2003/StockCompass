from django.db import models

class NewsData(models.Model):
    title = models.CharField(null=True, max_length=2048)
    url = models.URLField(null=True)
    time_published = models.DateTimeField(null=True)
    summary = models.TextField(null=True)
    banner_image = models.URLField(null=True)
    source = models.CharField(null=True, max_length=2048)
    overall_sentiment_score = models.FloatField(null=True)

    def __str__(self):
        return self.title
