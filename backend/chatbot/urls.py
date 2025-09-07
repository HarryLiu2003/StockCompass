from django.urls import path
from .views import chatbot_response

urlpatterns = [
    path('chatbot-response/', chatbot_response, name='chatbot_response'),
]
