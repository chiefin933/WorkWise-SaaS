Clerk environment variables required by the WorkWise backend

This file documents the Clerk-related environment variables the backend expects.

- CLERK_ISSUER
  - Description: The canonical Clerk issuer URL (e.g., https://clerk.example.com).
  - Usage: Used as a fallback to derive the trusted JWKS URL when `CLERK_JWKS_URL` is not set.
  - Example: `https://issuer.clerk.example.com`

- CLERK_ALLOWED_ISSUERS
  - Description: Comma-separated list of allowed `iss` values for incoming Clerk tokens.
  - Usage: When set, tokens with an `iss` claim not in this list are rejected.
  - Example: `https://issuer.clerk.example.com,https://other-trusted-issuer.example.com`

- CLERK_JWKS_URL
  - Description: Explicit JWKS endpoint URL to use for signature verification.
  - Usage: Preferred over deriving the JWKS URL from token claims. Must point to a JSON document
    following the JWKS spec (contains `keys`). Example: `https://issuer.clerk.example.com/.well-known/jwks.json`

- CLERK_AUDIENCE
  - Description: Expected audience value present in Clerk session tokens.
  - Usage: Required. Tokens without this audience will be rejected during validation.
  - Example: `api://default` or your Clerk frontend/backend audience string.

Notes
- For security, prefer setting `CLERK_JWKS_URL` explicitly in production.
- Ensure `CLERK_ALLOWED_ISSUERS` includes only trusted issuers.
- When deploying, set these env vars in your deployment environment or in the process supervisor.
