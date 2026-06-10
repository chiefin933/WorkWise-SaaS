from django.urls import path
from .views import ReportGenerationView, P9AnnualView

urlpatterns = [
    path('generate/', ReportGenerationView.as_view(), name='report-generate'),
    path('p9/', P9AnnualView.as_view(), name='report-p9-annual'),
]
