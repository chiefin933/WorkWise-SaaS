from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from core.rbac import require_permission
from employees.models import Employee
from attendance.models import Attendance
from leave.models import Leave
from payroll.models import PayrollItem
from .models import CustomReport, ReportExport
from .serializers import CustomReportSerializer, ReportExportSerializer
from .export_utils import export_to_csv, export_to_xlsx, export_to_pdf


class CustomReportViewSet(viewsets.ModelViewSet):
    queryset = CustomReport.objects.all()
    serializer_class = CustomReportSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAuthenticated(), require_permission("settings.roles")()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return CustomReport.objects.filter(tenant=self.request.user.tenant)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant, created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def export(self, request, pk=None):
        custom_report = get_object_or_404(CustomReport, pk=pk, tenant=request.user.tenant)
        export_format = request.data.get("format", "csv")
        if export_format not in dict(CustomReport.EXPORT_FORMATS).keys():
            return Response({"error": "Invalid export format"}, status=status.HTTP_400_BAD_REQUEST)
        data, headers = self._generate_report_data(custom_report)
        if export_format == "csv":
            return export_to_csv(data, headers, filename=f"{custom_report.name}.csv")
        elif export_format == "xlsx":
            return export_to_xlsx(data, headers, filename=f"{custom_report.name}.xlsx")
        elif export_format == "pdf":
            return export_to_pdf(data, headers, filename=f"{custom_report.name}.pdf")
        return Response({"error": "Invalid format"}, status=status.HTTP_400_BAD_REQUEST)

    def _generate_report_data(self, custom_report):
        tenant = custom_report.tenant
        report_type = custom_report.report_type
        data = []
        headers = []
        if report_type == "employees":
            headers = ["ID", "Name", "Email", "Department", "Job Title", "Status"]
            employees = Employee.objects.filter(tenant=tenant)
            for emp in employees:
                data.append({
                    "ID": str(emp.id),
                    "Name": emp.name,
                    "Email": emp.email,
                    "Department": emp.department or "",
                    "Job Title": emp.job_title or "",
                    "Status": emp.get_status_display(),
                })
        elif report_type == "attendance":
            headers = ["Date", "Employee", "Clock In", "Clock Out"]
            attendances = Attendance.objects.filter(employee__tenant=tenant)
            for att in attendances:
                data.append({
                    "Date": str(att.date),
                    "Employee": att.employee.name,
                    "Clock In": str(att.clock_in) if att.clock_in else "",
                    "Clock Out": str(att.clock_out) if att.clock_out else "",
                })
        elif report_type == "leave":
            headers = ["Employee", "Leave Type", "Start Date", "End Date", "Status"]
            leaves = Leave.objects.filter(employee__tenant=tenant)
            for lv in leaves:
                data.append({
                    "Employee": lv.employee.name,
                    "Leave Type": lv.get_leave_type_display(),
                    "Start Date": str(lv.start_date),
                    "End Date": str(lv.end_date),
                    "Status": lv.get_status_display(),
                })
        elif report_type == "payroll":
            headers = ["Employee", "Payroll Month", "Basic Salary", "Net Pay"]
            payroll_items = PayrollItem.objects.filter(payroll_run__tenant=tenant)
            for item in payroll_items:
                data.append({
                    "Employee": item.employee.name,
                    "Payroll Month": f"{item.payroll_run.month}/{item.payroll_run.year}",
                    "Basic Salary": float(item.salary_basic),
                    "Net Pay": float(item.net_pay),
                })
        return data, headers


class ReportExportViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ReportExport.objects.all()
    serializer_class = ReportExportSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ReportExport.objects.filter(tenant=self.request.user.tenant)
