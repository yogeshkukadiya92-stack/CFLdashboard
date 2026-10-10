# Salesperson call reports

CFL: open CRM → Call Analytics. Select the salesperson and From/To dates. The on-screen report updates automatically. Use Refresh calls after the phone syncs, then Download call report.

Company dashboards: open Company → Sales analytics. Select the salesperson, dates and optional source, then Download call report. The download queries the signed-in company’s synced call events directly, rather than exporting a cached analytics summary.

CSV opens in Excel or Google Sheets. Columns include salesperson, customer, phone, direction, start/end time, duration, connected status and result. Selected dates follow India business-day boundaries; timestamp columns retain UTC. Gujarati names are supported. Empty selections produce a header-only report. Reports over 50,000 calls require a smaller date range; no records are silently omitted.

## Deploy

Apply the files in CFL-salesperson-call-reports-dashboard.zip to the dashboard source and deploy through its existing deployment process. No database migration or Android APK update is required. This package does not deploy itself. Reports include only calls that have synced successfully to the selected dashboard.

The company download endpoint is GET /api/company/crm/call-report?from=YYYY-MM-DD&to=YYYY-MM-DD&owner=SALESPERSON_MEMBERSHIP_ID&source=SOURCE. It requires a company manager session and enforces tenant-scoped database access. Other custom dashboards must implement report generation using their own authenticated synced call storage; changing Android’s connector URL alone cannot add a report UI to an external dashboard.

## Validation

Call analytics and existing sales analytics checks pass, including salesperson ID matching, India midnight boundaries, spreadsheet escaping, Gujarati text, and empty reports. Live database/download verification requires a configured dashboard database and signed-in company account.

The company dashboard platform is not yet tracked on this repository’s main branch. Its report changes are included in the update ZIP for use with the existing local company platform. The main branch source change enables the CFL CRM report download.
