from django.urls import path
from .views import (
    ReportGenerationView,
    P9AnnualView,
    P10MonthlyView,
    NSSFScheduleView,
    SHIFScheduleView,
)

urlpatterns = [
    path('generate/', ReportGenerationView.as_view(), name='report-generate'),
    path('p9/', P9AnnualView.as_view(), name='report-p9-annual'),
    path('p10-monthly/', P10MonthlyView.as_view(), name='report-p10-monthly'),
    path('nssf-schedule/', NSSFScheduleView.as_view(), name='report-nssf-schedule'),
    path('shif-schedule/', SHIFScheduleView.as_view(), name='report-shif-schedule'),
]
