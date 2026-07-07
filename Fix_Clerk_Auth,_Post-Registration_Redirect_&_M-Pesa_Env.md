# Fix Clerk Auth, Post-Registration Redirect & M-Pesa Env

## Summary

Fix the three configuration/code issues that are blocking the entire application from working correctly in development.

## Task 1 — Fix Clerk Authentication (Backend)

**File:** file:backend/core/authentication.py

The `_verify_clerk_token` method currently returns `None` when `CLERK_AUDIENCE` is an empty string (lines 156–161). Clerk development tokens have no `aud` claim. The fix: when `CLERK_AUDIENCE` is empty/blank, call `jwt.decode()` with `audience=None` to skip audience validation instead of aborting.

**File:** file:backend/.env

Add the following lines:

```
CLERK_ISSUER=https://sought-narwhal-50.clerk.accounts.dev
CLERK_ALLOWED_ISSUERS=https://sought-narwhal-50.clerk.accounts.dev
CLERK_JWKS_URL=https://sought-narwhal-50.clerk.accounts.dev/.well-known/jwks.json
CLERK_AUDIENCE=
MPESA_STK_CALLBACK_URL=https://almanac-hassle-remake.ngrok-free.dev/api/mpesa/stk-push-callback/
```

## Task 2 — Fix Post-Registration Redirect to Admin Dashboard

**File:** file:frontend/src/app/page.tsx

Currently the dashboard renders the empty state (with "Add First Employee" button) while `user` is still `null` (profile fetch in progress). This makes it look like the user was sent to the wrong page.

**Fix:** Add a loading guard — while `isLoading` is `true` in `useAuthStore`, show a full-screen spinner instead of the empty state. Only render the empty state once the profile has loaded and confirmed the user is ADMIN with zero employees.

```ts
// Pseudocode — add before the isEmpty check:
if (authStore.isLoading) return <FullScreenSpinner />;
```

## Task 3 — Fix M-Pesa STK Push Env Key Mismatch

**File:** file:backend/.env

The existing `.env` has `MPESA_CALLBACK_URL` but file:backend/tenants/views.py reads `settings.MPESA_STK_CALLBACK_URL`. The settings file (file:backend/config/settings.py) maps `MPESA_STK_CALLBACK_URL` from the env var of the same name. Add the correctly-named key:

```
MPESA_STK_CALLBACK_URL=https://almanac-hassle-remake.ngrok-free.dev/api/mpesa/stk-push-callback/
```

## Acceptance Criteria

After adding Clerk env vars and restarting Django, GET /api/users/me/ returns 200 with role: "ADMIN"Sidebar shows all nav items (Employees, Payroll, Reports, Audit Trail, Billing) after loginAfter registration + email verification, landing on / shows a loading spinner briefly, then the Admin dashboard — not the employees pagePOST /api/mpesa/stk-push/ with a valid sandbox phone number returns checkout_request_id (not 401 or 500)The billing page M-Pesa modal progresses to "Check Your Phone" state instead of "Payment Failed"