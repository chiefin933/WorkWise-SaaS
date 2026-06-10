# Requirements Document

## Introduction

WorkWise SaaS requires four statutory export endpoints to support Kenyan government compliance filing. These endpoints generate downloadable CSV files from processed payroll run data, formatted to the exact specifications required by KRA iTax (PAYE), NSSF, SHIF, and the Affordable Housing Levy (AHL) authorities. The feature is gated behind Business and Enterprise plans and is exposed via a frontend component on the payroll run detail page.

## Glossary

- **StatutoryExporter**: The backend service class (`payroll/export_services.py`) responsible for generating CSV content for each statutory authority.
- **StatutoryExportView**: The DRF `APIView` (`payroll/views.py`) that handles the four export endpoints, enforces plan gating, and returns CSV HTTP responses.
- **PayrollRun**: A Django model representing a monthly batch payroll computation for a tenant, identified by a UUID.
- **PayrollItem**: A Django model representing the computed payroll figures for a single employee within a `PayrollRun`.
- **Tenant**: A Django model representing a customer organisation on WorkWise; includes a `plan` field indicating subscription tier.
- **KRA_PIN**: The Kenya Revenue Authority tax identification number stored as an encrypted field on the `Employee` model; may be empty.
- **NSSF**: National Social Security Fund — a mandatory Kenyan employee/employer contribution scheme with tiered contribution bands.
- **SHIF**: Social Health Insurance Fund — a mandatory levy at 2.75% of gross pay with a floor of KES 300.
- **AHL**: Affordable Housing Levy — a mandatory levy at 1.5% of gross pay, matched equally by the employer.
- **PAYE**: Pay As You Earn — income tax withheld at source per the KRA progressive tax bands.
- **Period**: A payroll period expressed in `MM-YYYY` format (e.g., `06-2025`).
- **Plan_Gate**: The access-control check that verifies whether the authenticated user's tenant subscription plan includes `statutory_export` access (Business or Enterprise tiers).
- **StatutoryExportButtons**: The frontend React component on the payroll run detail page that triggers CSV downloads via the export endpoints.

---

## Requirements

### Requirement 1: Plan-Gated Access Control

**User Story:** As a Business or Enterprise plan subscriber, I want to access statutory export endpoints so that only eligible tenants can download compliance files.

#### Acceptance Criteria

1. WHEN a request is made to any statutory export endpoint, THE StatutoryExportView SHALL verify that the authenticated user's tenant plan is `BUSINESS` or `ENTERPRISE` before processing the request.
2. IF the tenant plan is not `BUSINESS` or `ENTERPRISE`, THEN THE StatutoryExportView SHALL return HTTP 403 with the body `{"error": "Upgrade your plan to access statutory exports."}`.
3. WHEN a request is made to any statutory export endpoint without a valid JWT, THE StatutoryExportView SHALL return HTTP 401.
4. WHEN an authenticated user with an eligible plan requests an export for a `payroll_run_id` that does not belong to their tenant, THE StatutoryExportView SHALL return HTTP 404 to avoid disclosing the existence of other tenants' data.

---

### Requirement 2: KRA PAYE (iTax) Export

**User Story:** As an HR administrator, I want to download a PAYE CSV in the KRA iTax format so that I can file monthly PAYE returns directly.

#### Acceptance Criteria

1. WHEN an eligible user sends `GET /api/payroll/{payroll_run_id}/export/paye/`, THE StatutoryExportView SHALL return an HTTP 200 response with `Content-Type: text/csv` and `Content-Disposition: attachment; filename="paye_{id}_{MM-YYYY}.csv"`.
2. THE StatutoryExporter SHALL produce a CSV with exactly the columns `PIN of Employee,Employee Name,Gross Pay,NSSF,SHIF,Housing Levy,PAYE,Net Pay,Period` in that order as the header row.
3. FOR EACH `PayrollItem` in the `PayrollRun`, THE StatutoryExporter SHALL include one data row where monetary values are formatted to exactly 2 decimal places with no thousands separator.
4. WHEN an employee's `kra_pin` field is empty or absent, THE StatutoryExporter SHALL write an empty string for `PIN of Employee` without raising an error.
5. THE StatutoryExporter SHALL populate the `Period` column with the string `MM-YYYY` derived from the `PayrollRun`'s month and year fields.
6. THE StatutoryExporter SHALL sort rows by `PIN of Employee` in ascending order, with empty PINs sorted last.

---

### Requirement 3: NSSF Export

**User Story:** As an HR administrator, I want to download an NSSF CSV so that I can file monthly NSSF contributions.

#### Acceptance Criteria

1. WHEN an eligible user sends `GET /api/payroll/{payroll_run_id}/export/nssf/`, THE StatutoryExportView SHALL return an HTTP 200 response with `Content-Type: text/csv` and `Content-Disposition: attachment; filename="nssf_{id}_{MM-YYYY}.csv"`.
2. THE StatutoryExporter SHALL produce a CSV with exactly the columns `NSSF Number,Employee Name,PIN,Gross Earnings,Tier 1 Contribution,Tier 2 Contribution,Total Employee Contribution,Employer Contribution,Period` in that order as the header row.
3. FOR EACH `PayrollItem`, THE StatutoryExporter SHALL compute `Tier 1 Contribution` as `min(gross_salary, 7000) * 0.06` capped at `420.00`.
4. FOR EACH `PayrollItem`, THE StatutoryExporter SHALL compute `Tier 2 Contribution` as `max(0, min(gross_salary, 36000) - 7000) * 0.06` capped at `1740.00`.
5. FOR EACH `PayrollItem`, THE StatutoryExporter SHALL compute `Total Employee Contribution` as the sum of `Tier 1 Contribution` and `Tier 2 Contribution`.
6. FOR EACH `PayrollItem`, THE StatutoryExporter SHALL set `Employer Contribution` equal to `Total Employee Contribution`.
7. THE StatutoryExporter SHALL format all monetary values to exactly 2 decimal places with no thousands separator.

---

### Requirement 4: SHIF Export

**User Story:** As an HR administrator, I want to download a SHIF CSV so that I can file monthly SHIF contributions.

#### Acceptance Criteria

1. WHEN an eligible user sends `GET /api/payroll/{payroll_run_id}/export/shif/`, THE StatutoryExportView SHALL return an HTTP 200 response with `Content-Type: text/csv` and `Content-Disposition: attachment; filename="shif_{id}_{MM-YYYY}.csv"`.
2. THE StatutoryExporter SHALL produce a CSV with exactly the columns `Employee Name,ID Number (PIN),Gross Salary,SHIF Deduction,Month,Year` in that order as the header row.
3. FOR EACH `PayrollItem`, THE StatutoryExporter SHALL derive `SHIF Deduction` from the stored `shif` field on the `PayrollItem`; WHEN the stored value is below `300.00`, THE StatutoryExporter SHALL use `300.00` as the minimum floor.
4. THE StatutoryExporter SHALL write `Month` and `Year` as separate integer columns derived from the `PayrollRun`'s month and year fields.
5. THE StatutoryExporter SHALL format `Gross Salary` and `SHIF Deduction` to exactly 2 decimal places with no thousands separator.

---

### Requirement 5: AHL Export

**User Story:** As an HR administrator, I want to download an AHL CSV so that I can file monthly Affordable Housing Levy returns.

#### Acceptance Criteria

1. WHEN an eligible user sends `GET /api/payroll/{payroll_run_id}/export/ahl/`, THE StatutoryExportView SHALL return an HTTP 200 response with `Content-Type: text/csv` and `Content-Disposition: attachment; filename="ahl_{id}_{MM-YYYY}.csv"`.
2. THE StatutoryExporter SHALL produce a CSV with exactly the columns `Employee Name,PIN,Gross Pay,Employee AHL,Employer AHL,Total AHL,Period` in that order as the header row.
3. FOR EACH `PayrollItem`, THE StatutoryExporter SHALL set `Employee AHL` to `1.5%` of `gross_salary` rounded to 2 decimal places.
4. FOR EACH `PayrollItem`, THE StatutoryExporter SHALL set `Employer AHL` equal to `Employee AHL`.
5. FOR EACH `PayrollItem`, THE StatutoryExporter SHALL set `Total AHL` as the sum of `Employee AHL` and `Employer AHL`.
6. THE StatutoryExporter SHALL format all monetary values to exactly 2 decimal places with no thousands separator.

---

### Requirement 6: Filename and HTTP Response Format

**User Story:** As an HR administrator, I want exported CSV files to have consistent, identifiable filenames so that I can organise them by type and payroll period.

#### Acceptance Criteria

1. THE StatutoryExportView SHALL construct the filename for each export as `{type}_{payroll_run_id}_{MM-YYYY}.csv` where `{type}` is one of `paye`, `nssf`, `shif`, or `ahl`.
2. THE StatutoryExportView SHALL set `Content-Type` to `text/csv` on all export responses.
3. THE StatutoryExportView SHALL set `Content-Disposition` to `attachment; filename="{filename}"` on all export responses.
4. WHEN a `PayrollRun` has no `PayrollItem` records, THE StatutoryExportView SHALL return an HTTP 200 response with only the header row and no data rows.
5. WHEN a `PayrollRun` has one or more `PayrollItem` records, THE StatutoryExportView SHALL include one data row per item in the CSV response body.

---

### Requirement 7: Frontend Export Buttons

**User Story:** As an HR administrator, I want export buttons on the payroll run detail page so that I can trigger downloads without leaving the application.

#### Acceptance Criteria

1. THE StatutoryExportButtons SHALL render four buttons labelled `KRA PAYE`, `NSSF`, `SHIF`, and `Housing Levy` on the payroll run detail page.
2. WHEN a user clicks any export button, THE StatutoryExportButtons SHALL send an authenticated `GET` request to the corresponding export endpoint and trigger a browser file download using a Blob URL.
3. WHEN the export endpoint returns HTTP 403, THE StatutoryExportButtons SHALL display an alert to the user with the message from the error response.
4. WHEN the export endpoint returns any non-200 status other than 403, THE StatutoryExportButtons SHALL display a generic error alert to the user.
5. WHILE a download is in progress, THE StatutoryExportButtons SHALL disable the clicked button and show a loading indicator to prevent duplicate requests.
6. WHEN a download request is received for a `payroll_run_id` and export type that the same authenticated user has already requested within the last 5 seconds, THE StatutoryExportView SHALL return the CSV response without blocking the request, and the frontend SHALL rely on button disabling as the primary duplicate-prevention mechanism.
