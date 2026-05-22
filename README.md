# Business Central Time Tracker (Azure DevOps Extension)

Tracks time inside Azure DevOps work items and syncs entries to Microsoft Dynamics 365 Business Central.

## Features
- Manual time entry (date, hours, description, optional BC job number)
- Work-item scoped history with total time
- Date-range filtering
- Sync status labels (`synced`, `pending`, `error`)
- OAuth 2.0 Authorization Code + PKCE connect flow for Business Central

## Files
- `vss-extension.json` extension manifest
- `time-tracker.html` UI shell
- `time-tracker.css` styles
- `time-tracker.js` work-item integration + state
- `auth.js` auth handling (demo-safe no secret-in-code flow)
- `bc-api.js` Business Central API adapter + local fallback

## Dev/Test (standalone)
Open `time-tracker.html?workItemId=12345` via local static file host to test UI logic.

## Packaging
Install tfx CLI and package:

```bash
npm i -g tfx-cli

tfx extension create --manifest-globs vss-extension.json
```

## Security notes
- No client secret is embedded in source.
- In production, use backend + PKCE + secure token handling.
- This implementation stores token and local refs in localStorage for MVP only.

## Required config before real BC sync
Use the in-extension settings form to set:
- Azure AD application/client ID
- Business Central tenant ID
- Business Central environment
- Business Central company ID
- Employee ID, if required by your BC setup

The app uses browser-only PKCE for the MVP and does not embed a client secret. Production deployments should still consider a backend token broker depending on organizational policy.
