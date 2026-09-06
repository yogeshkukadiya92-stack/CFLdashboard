# Workflow wiring audit

The workflow catalog is not yet fully live. A saved or successful test does not prove a production action is implemented.

| Area | Current wiring | Remaining work |
|---|---|---|
| Registration triggers | Live workshop and registration form selectors; engine scope checks | Connect public/manual registration submissions to workflow dispatcher and pass form ID |
| Attendance triggers | Live workshop and attendance form selectors; attendance submission dispatch; scope exclusion propagates downstream | Verify against production attendance submissions |
| Payment triggers | Workshop selector; Razorpay event dispatch | Verify event registration context includes workshop ID |
| Conditions / filters | Labeled branch selection; false unlabelled paths skipped | Extend condition operators and field coverage |
| Transforms | Output passed to subsequent condition evaluation | Unify all downstream actions on transformed context |
| Sales assignment | Real assignment decision | Persist workflow-selected owner |
| Other CRM actions | Production explicitly skipped without persistence handler | Connect follow-up, tag, status, escalation, reassignment and inbox services |
| Workshop actions | Live workshop and batch selectors | Persist assignments, transfers, waiting promotion and capacity checks |
| Repeater lookup | Selected-workshop read-only matching | Pass registrations into every production dispatcher |
| Attendance actions | Event context available | Persist attendance updates and no-show actions |
| Registration data lookup | Actual scoped records returned with row limit and contact redaction | Implement other dashboard data scopes |
| CSV export | Attendance registration CSV in manual test route | Respect graph ancestry and support multiple export nodes |
| WhatsApp / SMS / internal alerts | Configuration UI; production delivery skipped | Replace hardcoded templates/credentials and connect delivery handlers |
| Payment actions | Payment event context only | Connect finance updates, follow-up and receipts |
| Schedule / delay | Schedule processor exists | Durable delay continuation |
| HTTP / webhook response | Configuration only | Approved outbound request execution and response handling |
| AI / Telegram | Configuration only | Connect approved credentials, data grounding and delivery |

No schema or environment changes were made in this pass. Provider credentials alone will not resolve the missing handlers above. Existing integration services must be connected and verified before claiming these nodes live-ready.
