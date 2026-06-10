# Implementation Plan: Statutory Exports

## Overview

Implement four CSV export endpoints (PAYE, NSSF, SHIF, AHL) for Kenyan statutory compliance filing. The backend adds a `StatutoryExporter` service class, a `StatutoryExportView` endpoint registered directly in `config/urls.py`, and a test file. The frontend adds a `StatutoryExportButtons` component integrated into the existing payroll run detail page.

No new Django models or migrations are needed. All code reads from existing `PayrollRun`, `PayrollItem`, `Employee`, and `Tenant` models.

## Tasks

- [ ] 1. Create `payroll/export_services.py` with the `StatutoryExporter` class
  - Create the file at `backend/payroll/export_services.py`
  - Import `Decimal`, `ROUND_HALF_UP` from `decimal`; import `csv`, `io` from stdlib; import `StreamingHttpResponse` from `django.http`
  - Import `PayrollRun`, `PayrollItem` from `payroll.models`
  - Import `clamp_decimal` from `payroll.statutory.nssf`
  - Implement the `_compute_nssf_tiers(self, gross: Decimal) -> dict` helper using the formula from the design: `tier1 = min(min(gross, 7000) × 0.06, 420)`, `tier2 = min(max(0, min(gross, 36000) − 7000) × 0.06, 1740)`, `total = tier1 + tier2`; all values quantized to 2dp via `clamp_decimal`
  - Implement `_csv_streaming_response(self, rows, prefix, payroll_run)`: builds `filename = f"{prefix}_{payroll_run.id}_{payroll_run.month:02d}-{payroll_run.year}.csv"`, defines an inner generator that writes each row into a reused `io.StringIO` buffer and yields the string value after each row, returns a `StreamingHttpResponse` with `content_type='text/csv'` and `Content-Disposition: attachment; filename="{filename}"`
  - Implement `export_paye(self, payroll_run)`: queries `PayrollItem.objects.filter(payroll_run=payroll_run).select_related('employee')`; sorts rows in Python by `(item.employee.kra_pin == '', item.employee.kra_pin)` so empty PINs sort last; header: `['PIN of Employee', 'Employee Name', 'Gross Pay', 'NSSF', 'SHIF', 'Housing Levy', 'PAYE', 'Net Pay', 'Period']`; `Period` value: `f"{payroll_run.month:02d}-{payroll_run.year}"`; all monetary values formatted with `f"{value:.2f}"`; delegates to `_csv_streaming_response`
  - Implement `export_nssf(self, payroll_run)`: same queryset; recomputes tiers per item via `_compute_nssf_tiers(item.gross_salary)`; header: `['NSSF Number', 'Employee Name', 'PIN', 'Gross Earnings', 'Tier 1 Contribution', 'Tier 2 Contribution', 'Total Employee Contribution', 'Employer Contribution', 'Period']`; `NSSF Number` is `item.employee.nssf_number` if present, else `''`; `Employer Contribution` equals `Total Employee Contribution`
  - Implement `export_shif(self, payroll_run)`: same queryset; `SHIF Deduction = max(item.shif, Decimal('300.00'))`; header: `['Employee Name', 'ID Number (PIN)', 'Gross Salary', 'SHIF Deduction', 'Month', 'Year']`; `Month` and `Year` are written as plain integers
  - Implement `export_ahl(self, payroll_run)`: same queryset; `employee_ahl = clamp_decimal(item.gross_salary * Decimal('0.015'))`; `employer_ahl = employee_ahl`; `total_ahl = clamp_decimal(employee_ahl + employer_ahl)`; header: `['Employee Name', 'PIN', 'Gross Pay', 'Employee AHL', 'Employer AHL', 'Total AHL', 'Period']`
  - _Requirements: 2.1–2.6, 3.1–3.7, 4.1–4.5, 5.1–5.6, 6.1–6.5_

- [ ] 2. Add `StatutoryExportView` to `payroll/views.py` and wire the URL in `config/urls.py`
  - [ ] 2.1 Add `StatutoryExportView` class to `backend/payroll/views.py`
    - Append below the existing `MpesaB2CResultView` class (or after the import block at the bottom of the file)
    - Add imports at the top of the file: `from rest_framework.views import APIView` (already imported via `from rest_framework import ...`; add explicitly if needed), `from django.shortcuts import get_object_or_404`, `from payroll.export_services import StatutoryExporter`
    - Define module-level constants: `STATUTORY_PLANS = {'BUSINESS', 'ENTERPRISE'}` and `VALID_EXPORT_TYPES = {'paye', 'nssf', 'shif', 'ahl'}`
    - `permission_classes = [IsAuthenticated, IsHROrAdmin]`
    - In `get(self, request, payroll_run_id, export_type)`: (1) read `tenant = request.user.tenant`; (2) check plan gate: `tenant.plan in STATUTORY_PLANS or getattr(getattr(tenant, 'payroll_config', None), 'statutory_export', False)`; return `Response({"error": "Upgrade your plan to access statutory exports."}, status=403)` on failure; (3) validate `export_type` against `VALID_EXPORT_TYPES`, return `Response({"error": f"Invalid export type '{export_type}'."}, status=400)` on failure; (4) `payroll_run = get_object_or_404(PayrollRun, id=payroll_run_id, tenant=tenant)`; (5) `exporter = StatutoryExporter()`; (6) `return getattr(exporter, f'export_{export_type}')(payroll_run)`
    - _Requirements: 1.1–1.4, 2.1, 3.1, 4.1, 5.1, 6.1–6.3_
  - [ ] 2.2 Register the new URL in `backend/config/urls.py`
    - Add import: `from payroll.views import ..., StatutoryExportView` (extend the existing import line)
    - Add path to `urlpatterns`: `path('api/payroll/<uuid:payroll_run_id>/export/<str:export_type>/', StatutoryExportView.as_view(), name='statutory-export')`
    - Place the new path before `path('api/', include(router.urls))` so it is not shadowed by the router
    - _Requirements: 2.1, 3.1, 4.1, 5.1_

- [ ] 3. Checkpoint — run existing payroll tests to confirm nothing is broken
  - Run `python manage.py test payroll` from `backend/`
  - Ensure all pre-existing tests pass before proceeding
  - Ask the user if questions arise

- [ ] 4. Write `payroll/tests_export.py`
  - [ ]* 4.1 Write `StatutoryExportTests` setup and helper
    - Create `backend/payroll/tests_export.py`
    - Import `Decimal`, `APITestCase`, `reverse` (or hard-code paths), `csv`, `io`, model factories
    - Write `setUp`: create `Tenant(plan='BUSINESS')`, an HR `User`, a `PayrollRun(month=6, year=2025, status='processed')`, two employees (`emp1` with `kra_pin='A001234567B'`, `emp2` with `kra_pin=''`), and two `PayrollItem` records with controlled Decimal values matching the design example (`gross=50000`, `gross=25000`)
    - Write `parse_csv_response(response)` helper that joins `response.streaming_content`, decodes UTF-8, and returns `list(csv.reader(io.StringIO(content)))`
    - _Requirements: 2.1–2.6, 3.1–3.7, 4.1–4.5, 5.1–5.6_
  - [ ]* 4.2 Write CSV structure and header tests for all four export types
    - `test_paye_csv_structure`: assert 200, `Content-Type: text/csv`, header row == `['PIN of Employee', 'Employee Name', 'Gross Pay', 'NSSF', 'SHIF', 'Housing Levy', 'PAYE', 'Net Pay', 'Period']`, exactly 3 rows (header + 2 data), `Period` == `'06-2025'`, each monetary cell matches `r'^\d+\.\d{2}$'`
    - `test_nssf_csv_structure`: assert header row has exactly 9 columns matching the NSSF spec
    - `test_shif_csv_structure`: assert header row matches `['Employee Name', 'ID Number (PIN)', 'Gross Salary', 'SHIF Deduction', 'Month', 'Year']`; `Month` cell value is `'6'`, `Year` cell value is `'2025'`
    - `test_ahl_csv_structure`: assert header row matches `['Employee Name', 'PIN', 'Gross Pay', 'Employee AHL', 'Employer AHL', 'Total AHL', 'Period']`; 7 columns present
    - `test_filename_format`: GET paye export, assert `Content-Disposition` matches `attachment; filename="paye_{run.id}_06-2025.csv"`
    - _Requirements: 2.1–2.3, 2.5, 3.1–3.2, 4.1–4.2, 4.4, 5.1–5.2, 6.1–6.3_
  - [ ]* 4.3 Write PAYE PIN sort and empty-PIN tests
    - `test_paye_pin_sort_and_empty_pin`: parse PAYE CSV; assert row 1 (`emp1`, non-empty PIN) appears before row 2 (`emp2`, empty PIN); assert row 2 `PIN of Employee` column == `''`
    - `test_missing_pin_handling`: same — confirm no exception is raised when `kra_pin` is empty; assert response is 200
    - _Requirements: 2.4, 2.6_
  - [ ]* 4.4 Write NSSF tier calculation tests
    - `test_nssf_tier_calculation`: parse NSSF CSV; for the row with `gross=50000`: assert `Tier 1 Contribution='420.00'`, `Tier 2 Contribution='1740.00'`, `Total Employee Contribution='2160.00'`, `Employer Contribution='2160.00'`; for `gross=25000`: assert `Tier 1='420.00'`, `Tier 2='1080.00'`, `Total='1500.00'`, `Employer='1500.00'`
    - _Requirements: 3.3–3.6, Design Property 2_
  - [ ]* 4.5 Write SHIF floor test
    - `test_shif_floor`: create an additional `PayrollItem` with `shif=Decimal('100.00')`, call SHIF export, parse CSV, assert that row's `SHIF Deduction` == `'300.00'`
    - _Requirements: 4.3, Design Property 5_
  - [ ]* 4.6 Write AHL arithmetic tests
    - `test_ahl_employer_portion`: parse AHL CSV; for `gross=50000`: assert `Employee AHL='750.00'`, `Employer AHL='750.00'`, `Total AHL='1500.00'`
    - _Requirements: 5.3–5.5, Design Property 4_
  - [ ]* 4.7 Write permission and plan gate tests
    - `test_permission_denied_starter_plan`: set `tenant.plan='STARTER'`; assert 403; assert response body JSON `{"error": "Upgrade your plan to access statutory exports."}`
    - `test_permission_denied_growth_plan`: set `tenant.plan='GROWTH'`; assert 403
    - `test_business_plan_allowed`: `tenant.plan='BUSINESS'`; assert 200
    - `test_enterprise_plan_allowed`: `tenant.plan='ENTERPRISE'`; assert 200
    - `test_unauthenticated_returns_401`: call without `force_authenticate`; assert 401
    - _Requirements: 1.1–1.3, Design Property (plan gate)_
  - [ ]* 4.8 Write isolation and edge-case tests
    - `test_wrong_tenant_returns_404`: create `Tenant2`, `PayrollRun2` belonging to it; call export with `tenant1` user's credentials and `run2`'s ID; assert 404
    - `test_empty_payroll_run`: delete all `PayrollItem` records for the run; call all four export endpoints; assert 200 with exactly 1 row (header only) in each response
    - `test_invalid_export_type`: GET `/api/payroll/{run_id}/export/invalid/`; assert 400
    - _Requirements: 1.4, 6.4–6.5_

- [ ] 5. Checkpoint — run new export tests
  - Run `python manage.py test payroll.tests_export` from `backend/`
  - All tests in `tests_export.py` must pass before proceeding
  - Ask the user if any test is failing

- [ ] 6. Create `frontend/src/components/payroll/StatutoryExportButtons.tsx`
  - Create the directory `frontend/src/components/payroll/` if it does not exist
  - Create `StatutoryExportButtons.tsx` in that directory
  - Define `ExportType = 'paye' | 'nssf' | 'shif' | 'ahl'` and `Props = { payrollRunId: string }`
  - Define `BUTTONS` config array: `[{ type: 'paye', label: 'KRA PAYE' }, { type: 'nssf', label: 'NSSF' }, { type: 'shif', label: 'SHIF' }, { type: 'ahl', label: 'Housing Levy' }]`
  - State: `const [loadingType, setLoadingType] = useState<ExportType | null>(null)`
  - `handleExport(type: ExportType)`: (1) `setLoadingType(type)`; (2) call `api.get(\`/payroll/${payrollRunId}/export/${type}/\`, { responseType: 'blob' })`; (3) on success: create an object URL, create a hidden `<a>` element with `download` attribute, click it, then call `URL.revokeObjectURL`; (4) on 403: read `(error.response.data as Blob).text()`, parse JSON, `alert(body.error ?? 'Access denied.')`; (5) on any other error: `alert('Export failed. Please try again.')`; (6) always `setLoadingType(null)` in `finally`
  - Render: a labelled section heading "Statutory Exports"; four buttons using the `BUTTONS` array; each button: `disabled={loadingType !== null}`, `onClick={() => handleExport(btn.type)}`; when `loadingType === btn.type` show a `Loader2` spinner alongside the label; button `className` uses `bg-teal-600 hover:bg-teal-700 text-white` matching the existing payroll button style
  - _Requirements: 7.1–7.5_

- [ ] 7. Integrate `StatutoryExportButtons` into the payroll run detail page
  - Open `frontend/src/app/payroll/page.tsx`
  - Add import at the top: `import { StatutoryExportButtons } from '@/components/payroll/StatutoryExportButtons'`
  - Locate the expanded employee breakdown section (the `{expandedRunId === run.id.toString() && ...}` block inside the `<tr>` after the action buttons row)
  - Inside the expanded `<div className="p-4 border ...">`, add `<StatutoryExportButtons payrollRunId={run.id.toString()} />` after the M-Pesa disbursement section (the "Employee Payslip Breakdown" heading area) and before the employee breakdown `<table>`
  - Wrap the component in a conditional: `{['processed', 'approved', 'paid'].includes(run.status) && (<StatutoryExportButtons payrollRunId={run.id.toString()} />)}`
  - _Requirements: 7.1–7.2_

- [ ] 8. Final checkpoint — verify full integration
  - Run `python manage.py test payroll` from `backend/` to confirm all payroll tests (existing + new) still pass
  - Ensure no TypeScript errors exist in `StatutoryExportButtons.tsx` and `payroll/page.tsx` by running the project's type-check command (e.g. `npx tsc --noEmit`) from `frontend/`
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP pass; they are test tasks and do not affect the production feature
- The URL is registered directly in `config/urls.py` (not in a separate `payroll/urls.py`), matching the existing pattern where all API routes live in the root URL config
- `StatutoryExportView` uses `<uuid:payroll_run_id>` because `PayrollRun.id` is a `UUIDField`; the router-registered `PayrollRunViewSet` uses the default `<pk>` which DRF converts to UUID automatically — the standalone view must declare the converter explicitly
- The `_compute_nssf_tiers` helper recomputes NSSF from `gross_salary` at export time to guarantee correct tier breakdown regardless of what is stored in `item.nssf`; this mirrors the design intent
- `Employee.kra_pin` is an `EncryptedCharField` that decrypts transparently on attribute access — no extra decrypt call is needed; empty values return `''`
- The frontend 403 blob-parsing pattern is required because `responseType: 'blob'` causes axios to wrap all responses (including error responses) as `Blob` objects
- All monetary values must use `f"{value:.2f}"` (no `locale`-style thousands separators) to match the filing format
