# Design Document: Statutory Exports

## Overview

This feature adds four CSV export endpoints to WorkWise's payroll module, covering Kenya's mandatory statutory filing requirements: KRA PAYE (iTax), NSSF, SHIF, and Affordable Housing Levy (AHL). Each endpoint is gated behind the Business and Enterprise subscription plans, reads from an already-processed `PayrollRun`, and streams the response as a CSV attachment.

The backend introduces a single `StatutoryExporter` service class and a single `StatutoryExportView` endpoint. The frontend adds a `StatutoryExportButtons` component that triggers downloads via authenticated `axios` requests and handles error states.

No new Django models or migrations are required. The feature integrates entirely with existing models (`PayrollRun`, `PayrollItem`, `Employee`, `Tenant`) and existing utilities (`KenyaStatutoryEngine`, `IsHROrAdmin`, `EncryptedCharField`).

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js)                                              │
│                                                                  │
│  PayrollPage  ──contains──►  StatutoryExportButtons              │
│                              (StatutoryExportButtons.tsx)        │
│                              - axios GET with responseType:blob  │
│                              - per-button loadingType state      │
│                              - Blob URL download trigger         │
└─────────────────────────┬────────────────────────────────────────┘
                          │  GET /api/payroll/{id}/export/{type}/
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  Backend (Django REST Framework)                                 │
│                                                                  │
│  StatutoryExportView (APIView)                                   │
│    1. IsAuthenticated + IsHROrAdmin permission check             │
│    2. Plan gate: BUSINESS or ENTERPRISE                          │
│    3. get_object_or_404(PayrollRun, tenant-scoped)               │
│    4. Route to StatutoryExporter method by export_type           │
│    5. Return StreamingHttpResponse                               │
│                                                                  │
│  StatutoryExporter (service class)                               │
│    export_paye()   ──┐                                           │
│    export_nssf()   ──┤──► _csv_streaming_response()             │
│    export_shif()   ──┤       StreamingHttpResponse              │
│    export_ahl()    ──┘       Content-Type: text/csv             │
│                                                                  │
│  KenyaStatutoryEngine ◄── reused for AHL employer match         │
│  payroll/statutory/nssf.py ◄── calculate_nssf() reused          │
└──────────────────────────────────────────────────────────────────┘
```

**Request lifecycle:**

1. Browser sends `GET /api/payroll/{payroll_run_id}/export/{export_type}/` with a JWT in the `Authorization` header.
2. `StatutoryExportView.get()` checks authentication, then role (`ADMIN` or `HR`), then plan tier.
3. `get_object_or_404(PayrollRun, id=payroll_run_id, tenant=request.tenant)` enforces tenant isolation — wrong-tenant IDs return 404.
4. The view delegates to `StatutoryExporter`, which queries `PayrollItem` records and generates rows.
5. A `StreamingHttpResponse` is returned with appropriate `Content-Type` and `Content-Disposition` headers.
6. The browser receives the binary blob; the frontend creates an object URL and simulates a link click to trigger the download.

---

## Components and Interfaces

### Backend

#### `payroll/export_services.py` — `StatutoryExporter`

```python
from decimal import Decimal
import csv
import io
from django.http import StreamingHttpResponse
from payroll.models import PayrollRun, PayrollItem
from payroll.statutory.nssf import calculate_nssf, clamp_decimal

class StatutoryExporter:

    def export_paye(self, payroll_run: PayrollRun) -> StreamingHttpResponse:
        """
        Generates a PAYE CSV in KRA iTax format.
        Columns: PIN of Employee, Employee Name, Gross Pay, NSSF, SHIF,
                 Housing Levy, PAYE, Net Pay, Period
        Rows sorted by PIN ascending; empty PINs sorted last.
        """

    def export_nssf(self, payroll_run: PayrollRun) -> StreamingHttpResponse:
        """
        Generates an NSSF CSV.
        Columns: NSSF Number, Employee Name, PIN, Gross Earnings,
                 Tier 1 Contribution, Tier 2 Contribution,
                 Total Employee Contribution, Employer Contribution, Period
        NSSF tiers recomputed at export time from item.gross_salary.
        """

    def export_shif(self, payroll_run: PayrollRun) -> StreamingHttpResponse:
        """
        Generates a SHIF CSV.
        Columns: Employee Name, ID Number (PIN), Gross Salary, SHIF Deduction,
                 Month, Year
        SHIF Deduction floor is KES 300.
        """

    def export_ahl(self, payroll_run: PayrollRun) -> StreamingHttpResponse:
        """
        Generates an AHL CSV.
        Columns: Employee Name, PIN, Gross Pay, Employee AHL, Employer AHL,
                 Total AHL, Period
        Both employee and employer AHL are 1.5% of gross_salary.
        """

    def _csv_streaming_response(
        self,
        rows: list[list],          # header row + data rows
        prefix: str,               # e.g. 'paye', 'nssf', 'shif', 'ahl'
        payroll_run: PayrollRun,
    ) -> StreamingHttpResponse:
        """
        Accepts a list of rows (first row is the header), streams them as
        a CSV response with filename = {prefix}_{run.id}_{MM-YYYY}.csv.
        Uses a generator internally so large runs stream without buffering
        the full CSV in memory.
        """
```

**NSSF tier recomputation at export time:**

The NSSF export recomputes tier contributions directly from `PayrollItem.gross_salary` rather than relying on the stored `item.nssf` aggregate. This guarantees the breakdown matches the filing format even if older payroll runs predate tier separation in the stored field.

```python
from decimal import Decimal

def _compute_nssf_tiers(gross: Decimal) -> dict:
    tier1 = min(gross, Decimal('7000')) * Decimal('0.06')
    tier1 = min(tier1, Decimal('420'))
    tier2 = max(Decimal('0'), min(gross, Decimal('36000')) - Decimal('7000')) * Decimal('0.06')
    tier2 = min(tier2, Decimal('1740'))
    total = tier1 + tier2
    return {
        'tier1': clamp_decimal(tier1),
        'tier2': clamp_decimal(tier2),
        'total': clamp_decimal(total),
    }
```

**KRA PIN access:**

`Employee.kra_pin` is an `EncryptedCharField`. The `from_db_value` hook on `EncryptedCharField` decrypts the value transparently when accessed as a Python attribute. There is no separate `decrypted_kra_pin` property on the model — simply accessing `employee.kra_pin` returns the decrypted plaintext. If the value is empty the field returns `''`, which is written directly to the CSV column.

---

#### `payroll/views.py` — `StatutoryExportView`

```python
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from core.permissions import IsHROrAdmin
from payroll.models import PayrollRun
from payroll.export_services import StatutoryExporter

STATUTORY_PLANS = {'BUSINESS', 'ENTERPRISE'}
VALID_EXPORT_TYPES = {'paye', 'nssf', 'shif', 'ahl'}

class StatutoryExportView(APIView):
    permission_classes = [IsAuthenticated, IsHROrAdmin]

    def get(self, request, payroll_run_id: int, export_type: str):
        # 1. Plan gate
        tenant = request.user.tenant
        plan_ok = (
            tenant.plan in STATUTORY_PLANS
            or getattr(getattr(tenant, 'payroll_config', None), 'statutory_export', False)
        )
        if not plan_ok:
            return Response(
                {"error": "Upgrade your plan to access statutory exports."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # 2. Validate export type
        if export_type not in VALID_EXPORT_TYPES:
            return Response(
                {"error": f"Invalid export type '{export_type}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 3. Tenant-scoped payroll run lookup
        payroll_run = get_object_or_404(
            PayrollRun, id=payroll_run_id, tenant=tenant
        )

        # 4. Delegate to service
        exporter = StatutoryExporter()
        export_fn = getattr(exporter, f'export_{export_type}')
        return export_fn(payroll_run)
```

**Plan gate logic detail:**

The primary check is `tenant.plan in {'BUSINESS', 'ENTERPRISE'}`. A secondary fallback checks `PayrollConfig.statutory_export` (a feature flag for tenants who may have been granted the feature without a full plan upgrade). This mirrors the pattern used by `bank_export` in `PayrollRunViewSet`.

---

#### `payroll/urls.py` — New URL pattern

The URL is added to the existing `payroll/urls.py` (or registered alongside the existing `DefaultRouter` for `PayrollRunViewSet`):

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PayrollRunViewSet, MpesaB2CResultView, StatutoryExportView

router = DefaultRouter()
router.register(r'', PayrollRunViewSet, basename='payroll')

urlpatterns = [
    path('', include(router.urls)),
    path(
        '<uuid:payroll_run_id>/export/<str:export_type>/',
        StatutoryExportView.as_view(),
        name='statutory-export',
    ),
]
```

> **Note:** `PayrollRun.id` is a `UUIDField`, so the URL converter should be `<uuid:payroll_run_id>`. The requirement document uses `<int:payroll_run_id>` — the actual model primary key is a UUID, so the URL pattern must use `uuid`. The frontend sends the UUID string returned from the payroll run API response.

---

### Frontend

#### `frontend/src/components/payroll/StatutoryExportButtons.tsx`

```typescript
interface Props {
  payrollRunId: string | number;
}

type ExportType = 'paye' | 'nssf' | 'shif' | 'ahl';

interface ButtonConfig {
  type: ExportType;
  label: string;
}

const BUTTONS: ButtonConfig[] = [
  { type: 'paye',  label: 'KRA PAYE'     },
  { type: 'nssf',  label: 'NSSF'         },
  { type: 'shif',  label: 'SHIF'         },
  { type: 'ahl',   label: 'Housing Levy' },
];
```

**State management:**

```typescript
const [loadingType, setLoadingType] = useState<ExportType | null>(null);
```

A single `loadingType` string (or `null`) tracks which button is currently in flight. Only one download can be in progress at a time because each click sets `loadingType` to the button's type and the button renders as disabled when `loadingType !== null`.

**Download handler:**

```typescript
const handleExport = async (type: ExportType) => {
  setLoadingType(type);
  try {
    const response = await api.get(
      `/payroll/${payrollRunId}/export/${type}/`,
      { responseType: 'blob' }
    );

    const url = URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${type}_export.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      // Parse JSON error body from blob
      const text = await (error.response.data as Blob).text();
      const body = JSON.parse(text);
      alert(body.error ?? 'Access denied.');
    } else {
      alert('Export failed. Please try again.');
    }
  } finally {
    setLoadingType(null);
  }
};
```

**Why blob parsing for 403:** When `responseType: 'blob'` is set on the axios request, error responses also arrive as `Blob` objects. The error handler reads the blob as text and parses the JSON to extract the `error` field from the 403 body.

**Placement in `PayrollPage`:** The component is rendered within the expanded payroll run detail section, after the M-Pesa disbursement section and before the employee breakdown table. It is conditionally shown for runs whose status is `processed`, `approved`, or `paid`:

```tsx
{['processed', 'approved', 'paid'].includes(run.status) && (
  <StatutoryExportButtons payrollRunId={run.id} />
)}
```

---

## Data Models

No new models are introduced. The feature reads from existing models:

| Model | Fields used |
|-------|-------------|
| `PayrollRun` | `id`, `tenant`, `month`, `year`, `status` |
| `PayrollItem` | `payroll_run`, `employee`, `gross_salary`, `nssf`, `shif`, `ahl`, `paye`, `net_pay` |
| `Employee` | `name`, `kra_pin` (encrypted, auto-decrypts via `EncryptedCharField.from_db_value`) |
| `Tenant` | `plan` |
| `PayrollConfig` | (optional) feature flag `statutory_export` — only checked as fallback |

**Query pattern in export methods:**

```python
items = (
    PayrollItem.objects
    .filter(payroll_run=payroll_run)
    .select_related('employee')
    .order_by('employee__name')   # secondary; PAYE overrides with PIN sort
)
```

The PAYE export applies Python-level sorting on `item.employee.kra_pin` after fetching, because encrypted PIN values cannot be sorted at the database level (the DB stores ciphertext). All other exports rely on the default `employee__name` ordering from the queryset.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Per the prework analysis, this feature's acceptance criteria fall primarily into the **EXAMPLE** and **EDGE_CASE** categories. The developer has confirmed an **example-based testing strategy** for this feature. The properties below are stated formally to guide test design, even though they are verified using concrete examples rather than automated property-based testing.

### Property 1: Monetary formatting invariant

*For any* `PayrollItem` with any `gross_salary` value, every monetary column in every CSV export (PAYE, NSSF, SHIF, AHL) must contain a value that matches the pattern `^\d+\.\d{2}$` — exactly 2 decimal places, no thousands separator.

**Validates: Requirements 2.3, 3.7, 4.5, 5.6**

### Property 2: NSSF tier arithmetic

*For any* `gross_salary` value `g ≥ 0`:
- `Tier 1 = min(min(g, 7000) × 0.06, 420.00)`
- `Tier 2 = min(max(0, min(g, 36000) − 7000) × 0.06, 1740.00)`
- `Total Employee = Tier 1 + Tier 2`
- `Employer Contribution = Total Employee`

All values are rounded to 2 decimal places (ROUND_HALF_UP).

**Validates: Requirements 3.3, 3.4, 3.5, 3.6**

### Property 3: PAYE PIN sort order

*For any* set of `PayrollItem` records containing a mix of employees with filled and empty `kra_pin` values, the PAYE CSV rows must appear in ascending lexicographic order of `kra_pin`, with rows whose `kra_pin` is empty string appearing after all rows with a non-empty PIN.

**Validates: Requirement 2.6**

### Property 4: AHL arithmetic invariant

*For any* `gross_salary` value `g ≥ 0`:
- `Employee AHL = round(g × 0.015, 2)`
- `Employer AHL = Employee AHL`
- `Total AHL = Employee AHL + Employer AHL = round(g × 0.030, 2)`

**Validates: Requirements 5.3, 5.4, 5.5**

### Property 5: SHIF floor invariant

*For any* stored `item.shif` value: if `item.shif < 300.00`, the exported SHIF Deduction column must contain `300.00`; if `item.shif ≥ 300.00`, the exported value must equal `item.shif` (formatted to 2dp).

**Validates: Requirement 4.3**

---

## Error Handling

| Scenario | Backend response | Frontend handling |
|----------|-----------------|-------------------|
| Unauthenticated request | `401 Unauthorized` (DRF default via `IsAuthenticated`) | Axios interceptor redirects to login |
| Authenticated non-HR/Admin user | `403 Forbidden` (DRF default via `IsHROrAdmin`) | Generic error alert |
| Eligible user, wrong tenant's `payroll_run_id` | `404 Not Found` (`get_object_or_404`) | Generic error alert |
| Plan not BUSINESS or ENTERPRISE | `403 {"error": "Upgrade your plan to access statutory exports."}` | Alert with exact error message from response body |
| Invalid `export_type` string | `400 Bad Request` | Generic error alert |
| PayrollRun has zero PayrollItems | `200` with header-only CSV | File downloads successfully, empty body except header |
| Employee has empty `kra_pin` | Row written with empty PIN column; no exception raised | N/A |
| Blob parsing fails on 403 body | Falls through to generic alert | Generic error alert |

**Why `StreamingHttpResponse` instead of `HttpResponse`:**

Large payroll runs (e.g. 300-employee Business plan) could produce multi-MB CSVs if buffered entirely in memory. `StreamingHttpResponse` with a generator allows Django to write each row to the socket as it is computed, keeping memory use proportional to a single row rather than the full dataset.

**Streaming generator pattern used in `_csv_streaming_response`:**

```python
def _csv_streaming_response(self, rows, prefix, payroll_run):
    period = f"{payroll_run.month:02d}-{payroll_run.year}"
    filename = f"{prefix}_{payroll_run.id}_{period}.csv"

    def row_generator():
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        for row in rows:
            writer.writerow(row)
            yield buffer.getvalue()
            buffer.seek(0)
            buffer.truncate(0)

    response = StreamingHttpResponse(row_generator(), content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response
```

---

## Testing Strategy

All tests for this feature use **example-based testing** with Django's `APITestCase`. No property-based testing framework is introduced, as the acceptance criteria involve finite discrete states (plan tiers, CSV column structures, known statutory rates) and the arithmetic logic is already covered by the existing `KenyaStatutoryEngineTests` suite in `tests_statutory.py`.

### Test file: `payroll/tests_export.py`

**Setup pattern:**

```python
class StatutoryExportTests(APITestCase):

    def setUp(self):
        self.tenant = Tenant.objects.create(name='AcmeCo', plan='BUSINESS')
        self.user = User.objects.create_user(
            email='hr@acme.com', password='pass',
            role='HR', tenant=self.tenant
        )
        self.run = PayrollRun.objects.create(
            tenant=self.tenant, month=6, year=2025, status='processed'
        )
        # Two employees with controlled values
        emp1 = Employee.objects.create(
            tenant=self.tenant, name='Alice Wanjiru', kra_pin='A001234567B'
        )
        emp2 = Employee.objects.create(
            tenant=self.tenant, name='Bob Kamau', kra_pin=''
        )
        PayrollItem.objects.create(
            payroll_run=self.run, employee=emp1, tenant=self.tenant,
            gross_salary=Decimal('50000.00'),
            nssf=Decimal('2160.00'), shif=Decimal('1375.00'),
            ahl=Decimal('750.00'), paye=Decimal('11435.35'),
            net_pay=Decimal('34279.65')
        )
        PayrollItem.objects.create(
            payroll_run=self.run, employee=emp2, tenant=self.tenant,
            gross_salary=Decimal('25000.00'),
            nssf=Decimal('1080.00'), shif=Decimal('687.50'),
            ahl=Decimal('375.00'), paye=Decimal('1620.00'),
            net_pay=Decimal('21237.50')
        )
        self.client.force_authenticate(user=self.user)
```

**Test cases:**

| Test | What it verifies |
|------|-----------------|
| `test_paye_csv_structure` | 200 status, correct Content-Type header, header row matches PAYE spec, two data rows, monetary values match `\d+\.\d{2}`, Period column = `06-2025` |
| `test_paye_pin_sort_and_empty_pin` | Alice (non-empty PIN) appears before Bob (empty PIN); Bob's PIN column is empty string |
| `test_nssf_tier_calculation` | For gross=50000: Tier1=420.00, Tier2=1740.00, Total=2160.00, Employer=2160.00; for gross=25000: Tier1=420.00, Tier2=1080.00, Total=1500.00, Employer=1500.00 |
| `test_nssf_csv_structure` | Header row matches NSSF spec, nine columns present |
| `test_shif_csv_structure` | Header row matches SHIF spec, Month and Year are separate integer columns |
| `test_shif_floor` | Create PayrollItem with `shif=Decimal('100.00')`, assert exported SHIF Deduction = `300.00` |
| `test_ahl_employer_portion` | For gross=50000: Employee AHL=750.00, Employer AHL=750.00, Total AHL=1500.00 |
| `test_ahl_csv_structure` | Header row matches AHL spec, seven columns present |
| `test_permission_denied_starter_plan` | Set tenant.plan='STARTER', assert 403 with exact error body |
| `test_permission_denied_growth_plan` | Set tenant.plan='GROWTH', assert 403 |
| `test_business_plan_allowed` | tenant.plan='BUSINESS', assert 200 |
| `test_enterprise_plan_allowed` | tenant.plan='ENTERPRISE', assert 200 |
| `test_unauthenticated_returns_401` | Call without `force_authenticate`, assert 401 |
| `test_missing_pin_handling` | Employee with empty `kra_pin` produces no exception; PIN column is `''` |
| `test_wrong_tenant_returns_404` | Create second tenant and run, call with first tenant's user, assert 404 |
| `test_empty_payroll_run` | Delete all PayrollItems, call export, assert 200 with header-only CSV (one row) |
| `test_invalid_export_type` | Call `/export/invalid/`, assert 400 |
| `test_filename_format` | Assert `Content-Disposition` value matches `attachment; filename="paye_{run_id}_06-2025.csv"` |

**Parsing helper used in tests:**

```python
import csv, io

def parse_csv_response(response):
    content = b''.join(response.streaming_content).decode('utf-8')
    reader = csv.reader(io.StringIO(content))
    return list(reader)
```

### Frontend tests (`StatutoryExportButtons.test.tsx`)

Uses **React Testing Library** + **Jest** + **axios-mock-adapter**:

| Test | What it verifies |
|------|-----------------|
| `renders four export buttons` | Four buttons with correct labels render from fixed props |
| `triggers blob download on success` | Mock axios 200 blob response; assert `URL.createObjectURL` called |
| `shows plan upgrade alert on 403` | Mock 403 with JSON error blob; assert `window.alert` called with error message |
| `shows generic alert on 500` | Mock 500; assert `window.alert` called with generic message |
| `disables button while loading` | Mock delayed response; assert button is disabled during request, re-enabled after |
| `only one button disabled at a time` | Start one download, assert only that button is disabled, others are enabled |

### What is NOT tested here

- The arithmetic correctness of `calculate_nssf`, `calculate_shif`, `calculate_paye`, and `calculate_housing_levy` — these are already covered exhaustively in `payroll/tests_statutory.py`.
- M-Pesa or bank export flows — unrelated to this feature.
- CSV streaming performance at high row counts — considered an operational concern outside unit test scope.
