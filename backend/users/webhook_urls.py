from django.urls import path
from .webhooks import ClerkWebhookView

urlpatterns = [
    path('', ClerkWebhookView.as_view(), name='clerk_webhook'),
]
