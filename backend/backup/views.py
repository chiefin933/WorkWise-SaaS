import io
import json
from datetime import datetime
from django.db import transaction
from django.http import FileResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.rbac import require_permission
from .models import TenantBackup
from .serializers import TenantBackupSerializer
from tenants.models import TenantSettings
from employees.models import Employee
from attendance.models import Attendance
from leave.models import Leave
from payroll.models import PayrollRun, PayrollItem
from workflows.models import ApprovalTemplate, ApprovalRequest
from documents.models import Document


class TenantBackupViewSet(viewsets.ModelViewSet):
    queryset = TenantBackup.objects.all()
    serializer_class = TenantBackupSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAuthenticated(), require_permission("settings.roles")()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return TenantBackup.objects.filter(tenant=self.request.user.tenant)

    def perform_create(self, serializer):
        serializer.save(
            tenant=self.request.user.tenant,
            created_by=self.request.user,
            status="processing",
        )
        self._create_backup(serializer.instance)

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        backup = self.get_object()
        if not backup.file:
            return Response(
                {"error": "Backup file not available"},
                status=status.HTTP_404_NOT_FOUND,
            )
        return FileResponse(
            backup.file.open(),
            as_attachment=True,
            filename=f"{backup.name}.json",
        )

    def _create_backup(self, backup):
        try:
            tenant = backup.tenant
            data = {
                "backup_name": backup.name,
                "backup_date": datetime.utcnow().isoformat(),
                "tenant": {
                    "name": tenant.name,
                    "country": tenant.country,
                    "currency": tenant.currency,
                },
                "tenant_settings": [],
                "employees": [],
                "attendance": [],
                "leave": [],
                "payroll_runs": [],
                "payroll_items": [],
                "approval_templates": [],
                "approval_requests": [],
                "documents": [],
            }

            tenant_settings = TenantSettings.objects.filter(tenant=tenant).first()
            if tenant_settings:
                data["tenant_settings"].append(
                    {
                        "working_days": tenant_settings.working_days,
                        "weekend_days": tenant_settings.weekend_days,
                        "time_zone": tenant_settings.time_zone,
                        "language": tenant_settings.language,
                    }
                )

            for emp in Employee.objects.filter(tenant=tenant):
                data["employees"].append(
                    {
                        "id": str(emp.id),
                        "name": emp.name,
                        "email": emp.email,
                        "department": emp.department,
                        "job_title": emp.job_title,
                        "salary_basic": float(emp.salary_basic),
                        "status": emp.status,
                        "hire_date": str(emp.hire_date) if emp.hire_date else None,
                    }
                )

            for att in Attendance.objects.filter(employee__tenant=tenant):
                data["attendance"].append(
                    {
                        "id": str(att.id),
                        "employee_id": str(att.employee.id),
                        "date": str(att.date),
                        "clock_in": str(att.clock_in) if att.clock_in else None,
                        "clock_out": str(att.clock_out) if att.clock_out else None,
                    }
                )

            for lv in Leave.objects.filter(employee__tenant=tenant):
                data["leave"].append(
                    {
                        "id": str(lv.id),
                        "employee_id": str(lv.employee.id),
                        "leave_type": lv.leave_type,
                        "start_date": str(lv.start_date),
                        "end_date": str(lv.end_date),
                        "status": lv.status,
                    }
                )

            for run in PayrollRun.objects.filter(tenant=tenant):
                data["payroll_runs"].append(
                    {
                        "id": str(run.id),
                        "month": run.month,
                        "year": run.year,
                        "status": run.status,
                    }
                )

            for item in PayrollItem.objects.filter(payroll_run__tenant=tenant):
                data["payroll_items"].append(
                    {
                        "id": str(item.id),
                        "payroll_run_id": str(item.payroll_run.id),
                        "employee_id": str(item.employee.id),
                        "salary_basic": float(item.employee.salary_basic),
                        "gross_salary": float(item.gross_salary),
                        "net_pay": float(item.net_pay),
                    }
                )

            for template in ApprovalTemplate.objects.filter(tenant=tenant):
                data["approval_templates"].append(
                    {
                        "id": str(template.id),
                        "name": template.name,
                        "workflow_type": template.workflow_type,
                        "description": template.description,
                    }
                )

            for req in ApprovalRequest.objects.filter(tenant=tenant):
                data["approval_requests"].append(
                    {
                        "id": str(req.id),
                        "title": req.title,
                        "status": req.status,
                    }
                )

            for doc in Document.objects.filter(tenant=tenant):
                data["documents"].append(
                    {
                        "id": str(doc.id),
                        "name": doc.title,
                        "document_type": doc.document_type,
                    }
                )

            backup_file = io.BytesIO(json.dumps(data, indent=2).encode("utf-8"))
            backup.file.save(f"{backup.name}.json", backup_file)
            backup.status = "completed"
            backup.save()
        except Exception as e:
            backup.status = "failed"
            backup.error_message = str(e)
            backup.save()
