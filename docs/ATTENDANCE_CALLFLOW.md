# Attendance–CallFlow connection

The CFL dashboard and CallFlow now use the same workshop registrations, attendance responses and lead ownership.

- In **Leads → Add Lead**, choose **Auto-register for workshop**. Saving the lead and registration is atomic. Registration never marks somebody present.
- Existing leads can be registered from **Workshop Attendance → Attendance–CallFlow connection**, or from the lead’s **Workshop attendance** section in CallFlow 1.16.0.
- Existing attendance, including introduction sessions, appears automatically for matching assigned leads using mobile number, workshop and session. Other batches are kept separate.
- Attendance options are Present, Late, Joined Zoom, Completed and Absent. Absent removes the positive check-in from active attendance and preserves the previous response in the registration’s audit history.
- A salesperson can transfer their own participant to another active salesperson. The CRM lead and registration ownership change together. The previous owner loses access and receives removal records on mobile sync; the new owner receives the lead and its attendance.
- The dashboard panel refreshes every 30 seconds and on window focus. CallFlow refreshes on opening/resuming the screen, after saves, or with Refresh from CFL.
- All writes require a live connection. Failed writes are shown as failures; they are not treated as saved offline.

## Deployment

Deploy this commit over the current CFL main branch, preserving newer unrelated commits. No new schema migration or secret is required: added fields live inside the existing JSON records. Roll back using the prior application commit if needed; existing registration and attendance data remain in the database.

## Validation

- Six focused domain tests cover registration without fabricated presence, attendance matching, corrections with audit preservation, reassignment and access boundaries.
- 24 local HTTP integration checks against a real PostgreSQL database and the optimized production build cover admin/mobile reads and writes, automatic registration, idempotency, authorization, corrections, reassignment, and mobile removals.
- Dashboard production build and TypeScript checks pass.
- Dashboard regression: 244 passing tests, one existing skipped test. The existing server-only Supabase test is run separately with the react-server condition.
- Android: 144 unit tests and an emulator Compose flow passed. The emulator flow registers a participant, marks Present and transfers with explicit confirmation. Tests use synthetic participants only.
