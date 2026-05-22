# Business Central Time Tracker (Azure DevOps Extension)

Tracks time inside Azure DevOps work items and syncs entries to Microsoft Dynamics 365 Business Central.

## Features
- Manual time entry (date, hours, description, optional BC job number)
- Work-item scoped history with total time
- Date-range filtering
- Sync status labels (`synced`, `pending`, `error`)
- OAuth connect button for Business Central access token flow

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
Edit `auth.js` and set:
- `AUTH_CONFIG.clientId`

Then set BC config in localStorage (or extend settings UI):
- `tenantId`
- `companyId`
- `employeeId` (optional per your BC setup)
