# Requirements Document

## Introduction

The Statutory Export feature extends WorkWise payroll with four government-mandated file download endpoints. Each endpoint generates a correctly formatted CSV (or TXT for NSSF) that employers can submit directly to the respective Kenyan government authority: KRA iTax, NSSF, SHIF, and the Affordable Housing Levy administrator. Endpoints are protected behind a Business/Enterprise plan gate and are accessible from the payroll run detail page in the frontend.

## Glossary

- **Statutory_Export_Engine**: The backend component responsible for reading a processed `PayrollRun` and writing government-format return files.
- **PayrollRun**: An existing model representing one month of processed payroll for a tenant, containing one `PayrollItem` per employee.
- **PayrollItem**: A record storing `gross_salary`, `nssf`, `shif`, `ahl`, `paye`, and `net_pay` for one employee within a `PayrollRun`.
- **Export_Type**: One of four values: `paye`, `nssf`, `shif`, `ahl` — identifies which statutory return is requested.
- **PAYE_Return**: A CSV formatted for KRA iTax P10 monthly filing.
- **NSSF_Return**: A CSV formatted for NSSF employer monthly contribution remittance.
- **SHIF_Return**: A CSV formatted for SHIF monthly deduction remittance.
- **AHL_Return**: A CSV formatted for Affordable Housing Levy monthly remittance, including both employee and employer portions.
- **Tenant**: The multi-tenant organization object, carrying a `plan` field (`STARTER`, `GROWTH`, `BUSINESS`, `ENTERPRISE`).
- **Premium_Plans**: The set of plan values `{BUSINESS, ENTERPRISE}` that are entitled to use statutory exports.
- **KRA_PIN**: Kenya Revenue Authority Personal Identification Number assigned to each employee and stored encrypted on the `Employee` model.
- **Period**: A human-readable `MM-YYYY` string derived from the `PayrollRun.month` and `PayrollRun.year` fields.

---

## Requirements

### Requirement 1: Statutory Export Endpoint

**User Story:** As an HR administrator, I want to download a government-ready return file for a specific statutory type from a processed payroll run, so that I can file the return directly with the relevant authority.

#### Acceptance Criteria

1. WHEN a request is made to `GET /api/payroll/{id}/statutory-export/{type}/`, THE Statutory_Export_Engine SHALL return a downloadable file as an HTTP response with `Content-Disposition: attachment`.
2. WHEN the `{type}` path parameter is `paye`, `nssf`, `shif`, or `ahl`, THE Statutory_Export_Engine SHALL generate the return file corresponding to that Export_Type.
3. WHEN the `{type}` path parameter is not one of `paye`, `nssf`, `shif`, or `ahl`, THE Statutory_Export_Engine SHALL return an HTTP 400 response with a descriptive error message.
4. WHEN the payroll run identified by `{id}` does not belong to the requesting user's tenant, THE Statutory_Export_Engine SHALL return an HTTP 404 response.
5. WHEN the payroll run identified by `{id}` has a status of `draft`, THE Statutory_Export_Engine SHALL return an HTTP 400 response indicating the run must be processed before exporting.
6. THE Statutory_Export_Engine SHALL require an authenticated user on every export request.

---

### Requirement 2: Plan-Based Access Control

**User Story:** As a product owner, I want statutory exports restricted to Business and Enterprise plan holders, so that the feature is monetised as a premium capability.

#### Acceptance Criteria

1. WHEN the requesting user's tenant has a `plan` of `BUSINESS` or `ENTERPRISE`, THE Statutory_Export_Engine SHALL permit the export request to proceed.
2. WHEN the requesting user's tenant has a `plan` of `STARTER` or `GROWTH`, THE Statutory_Export_Engine SHALL return an HTTP 403 response with an `upgrade_required: true` field, the tenant's `current_plan`, and the `required_plan` value.
3. THE Statutory_Export_Engine SHALL evaluate the plan check before generating any file content.

---

### Requirement 3: KRA PAYE Return (iTax P10 Format)

**User Story:** As an HR administrator, I want to download a PAYE return CSV formatted for KRA iTax, so that I can upload it directly during P10 monthly filing.

#### Acceptance Criteria

1. WHEN the Export_Type is `paye`, THE Statutory_Export_Engine SHALL produce a CSV file with the filename `paye_return_MM-YYYY.csv`, where `MM-YYYY` is the Period of the payroll run.
2. THE PAYE_Return CSV SHALL contain the header row: `PIN of Employee,Employee Name,Gross Pay,NSSF,SHIF,Housing Levy,PAYE,Net Pay,Period`.
3. FOR EACH `PayrollItem` in the `PayrollRun`, THE PAYE_Return CSV SHALL contain one data row with the employee's `kra_pin`, `name`, `gross_salary`, `nssf`, `shif`, `ahl`, `paye`, `net_pay`, and the Period string in `MM-YYYY` format.
4. WHEN an employee's `kra_pin` field is blank or null, THE Statutory_Export_Engine SHALL write an empty string in the `PIN of Employee` column for that row.
5. THE PAYE_Return CSV SHALL encode all monetary values as plain decimal numbers rounded to two decimal places with no currency symbols or thousand separators.

---

### Requirement 4: NSSF Return Format

**User Story:** As an HR administrator, I want to download an NSSF contribution return, so that I can remit both employee and employer contributions to NSSF each month.

#### Acceptance Criteria

1. WHEN the Export_Type is `nssf`, THE Statutory_Export_Engine SHALL produce a CSV file with the filename `nssf_return_MM-YYYY.csv`.
2. THE NSSF_Return CSV SHALL contain the header row: `Employee Name,ID/KRA PIN,Gross Salary,NSSF Tier 1 (Employee),NSSF Tier 2 (Employee),Total Employee NSSF,Employer NSSF,Total NSSF,Period`.
3. FOR EACH `PayrollItem` in the `PayrollRun`, THE NSSF_Return CSV SHALL contain one data row with the employee's `name`, `kra_pin`, `gross_salary`, the Tier 1 employee contribution, Tier 2 employee contribution, total employee NSSF, total employer NSSF (equal to total employee NSSF), total combined NSSF (employee + employer), and the Period string.
4. THE Statutory_Export_Engine SHALL re-derive NSSF Tier 1 and Tier 2 values by calling `calculate_nssf(gross_salary)` for each employee, since the `PayrollItem` stores only the combined NSSF total.
5. THE NSSF_Return CSV SHALL encode all monetary values as plain decimal numbers rounded to two decimal places.

---

### Requirement 5: SHIF Return Format

**User Story:** As an HR administrator, I want to download a SHIF deduction return, so that I can remit employee Social Health Insurance Fund contributions monthly.

#### Acceptance Criteria

1. WHEN the Export_Type is `shif`, THE Statutory_Export_Engine SHALL produce a CSV file with the filename `shif_return_MM-YYYY.csv`.
2. THE SHIF_Return CSV SHALL contain the header row: `Employee Name,ID/KRA PIN,Gross Salary,SHIF Deduction,Period`.
3. FOR EACH `PayrollItem` in the `PayrollRun`, THE SHIF_Return CSV SHALL contain one data row with the employee's `name`, `kra_pin`, `gross_salary`, `shif` deduction, and the Period string.
4. THE SHIF_Return CSV SHALL encode all monetary values as plain decimal numbers rounded to two decimal places.

---

### Requirement 6: Affordable Housing Levy Return Format

**User Story:** As an HR administrator, I want to download an Affordable Housing Levy return, so that I can remit both employee and employer AHL contributions monthly.

#### Acceptance Criteria

1. WHEN the Export_Type is `ahl`, THE Statutory_Export_Engine SHALL produce a CSV file with the filename `ahl_return_MM-YYYY.csv`.
2. THE AHL_Return CSV SHALL contain the header row: `Employee Name,ID/KRA PIN,Gross Salary,Employee AHL (1.5%),Employer AHL (1.5%),Total AHL,Period`.
3. FOR EACH `PayrollItem` in the `PayrollRun`, THE AHL_Return CSV SHALL contain one data row with the employee's `name`, `kra_pin`, `gross_salary`, the employee AHL amount (1.5% of gross), the employer AHL amount (1.5% of gross), the total AHL (employee + employer), and the Period string.
4. THE Statutory_Export_Engine SHALL re-derive the employer AHL amount by calling `calculate_housing_levy(gross_salary)` for each employee, since `PayrollItem.ahl` stores only the employee portion.
5. THE AHL_Return CSV SHALL encode all monetary values as plain decimal numbers rounded to two decimal places.

---

### Requirement 7: Frontend Download Buttons

**User Story:** As an HR administrator, I want clearly labelled download buttons on the payroll run detail page, so that I can trigger each statutory export with a single click.

#### Acceptance Criteria

1. WHEN a payroll run has a status of `processed`, `approved`, or `paid`, THE Frontend SHALL display four download buttons labelled: "Download KRA Returns", "Download NSSF", "Download SHIF", and "Download AHL".
2. WHEN a download button is clicked, THE Frontend SHALL issue a `GET` request to the corresponding `/api/payroll/{id}/statutory-export/{type}/` endpoint and prompt the browser to save the returned file.
3. WHEN the API responds with HTTP 403 (plan gate), THE Frontend SHALL display a user-facing upgrade notice indicating the feature requires a Business or Enterprise plan.
4. WHEN the API responds with HTTP 400 or another error status, THE Frontend SHALL display a non-blocking error notification to the user.
5. WHILE a download is in progress, THE Frontend SHALL show a loading indicator on the clicked button and disable it to prevent duplicate requests.
6. WHERE the payroll run status is `draft`, THE Frontend SHALL hide or disable the statutory export buttons.
