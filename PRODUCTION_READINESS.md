# FieldFace Production-Readiness Assessment

**Assessment date:** 12 September 2026  
**Repository reviewed:** `kamogeloralph-ux/FieldFace`  
**Conclusion:** FieldFace is a functional prototype with a coherent employee clocking flow, management dashboard, platform administrator console, selfie/GPS evidence, and payslip generation. It is **not yet ready for production attendance or payroll use** because several correctness and security controls are incomplete. The application should first pass the release gates in this report.

> **Release recommendation:** Do not onboard real employees or generate legally relied-upon payslips until the Critical and High items below are addressed and tested against a production-like database and storage environment.

## 1. Executive priority summary

| Priority | Area | Finding | Release impact | Recommended action |
|---|---|---|---|---|
| Critical | Offline clocking | A request can succeed on the server while the client loses the response and later retries the same action. There is no idempotency key, so duplicate clock entries are possible. | Incorrect attendance and payroll records | Add a client-generated clock-action ID, persist it in the database, and make the clock mutation idempotent. |
| Critical | Clock sequencing | The server reads the last entry and inserts the next entry without a transaction or row lock. Two requests can both pass the sequence check. | Double clock-ins, invalid shifts, inconsistent reports | Use a transaction with a per-employee lock or advisory lock and enforce database-level invariants. |
| Critical | Database deployment | `supabase-schema.sql` is materially behind `drizzle/schema.ts`. It omits current employer tax/UIF fields, employee tax number, and the platform-admin table definition while later referencing it. | A fresh production database may fail or silently lack required fields | Replace the hand-maintained schema with versioned migrations and test a clean install plus an upgrade from the current schema. |
| High | Payslip privacy | `/share/payslip/:payslipId` is a public bearer route. Anyone who obtains the UUID can request a redirect to a signed PDF URL. | Payslip and personal payroll data can be disclosed | Require authenticated management access or issue revocable, expiring share tokens with audit logging. |
| High | Login protection | Employee and management login endpoints have no rate limiting, lockout, abuse detection, or audit trail. Employee numbers and short PINs are susceptible to automated guessing. | Account takeover and impersonated attendance | Add rate limits by IP and identifier, progressive delays, lockout rules, and security event logging. |
| High | Offline semantics | Offline entries use server receipt time when synchronized rather than a verified capture time. The local status cache can also become stale when another device clocks the employee. | Payroll time and ordering can be wrong | Store capture time, sync time, device/action ID, and define a conflict policy. Prefer server-authoritative reconciliation. |
| High | Evidence uploads | Base64 images accept arbitrary content types and have no explicit decoded-size, pixel-dimension, or format limits. | Memory exhaustion, oversized uploads, storage abuse | Restrict to JPEG/PNG, validate decoded bytes, resize/compress server-side, and enforce request and object quotas. |
| High | Payroll controls | Payslips can be regenerated and overwrite the period record without an approval/finalization workflow or immutable payroll snapshot. | Historical payroll can change after payment | Add draft/finalized states, period locking, adjustment records, and an audit trail. |
| Medium | Observability | The app has console logging but no structured logs, request IDs, error monitoring, metrics, alerting, or operational dashboard. | Incidents will be difficult to detect and investigate | Add centralized structured logging, error reporting, health checks, and alerts. |
| Medium | Test coverage | No automated test files were found. The only routine verification is TypeScript compilation and a production build. | Regressions in payroll, auth, and offline sync are likely | Add unit, integration, security, and browser acceptance tests in CI. |
| Medium | Account administration | The repository has seed-based supervisor setup but no complete production workflow for inviting, disabling, resetting, and auditing management accounts. | Operational access changes require manual database work | Add owner-managed invitations, role changes, deactivation, MFA enforcement, and recovery procedures. |

## 2. What is already in good shape

The current implementation has several useful foundations. Authentication is separated into employee, company-admin, and platform-admin sessions. Management queries are generally scoped to the authenticated employer. Employee PINs are bcrypt-hashed rather than stored in plaintext. Private storage is used for selfies, site photos, and payslips, with signed URLs for normal application access. The employee application now has an optional persistent session, an app-shell service worker, a local offline queue, and a management-only payslip-generation path. Employee rates and company settings are restricted in the UI and, in the main paths, in server procedures as well.

The build is reproducible enough to run `npm run check` and `npm run build`, and the main user journeys are represented: employee login, selfie clocking, daily report, employee administration, site administration, payslip generation, and a platform company console.

## 3. Critical correctness issues

### 3.1 Offline submissions are not idempotent

The offline queue stores the clock payload in IndexedDB and replays it through the normal clock mutation. The payload does not contain a unique action identifier. If the server inserts the entry but the network fails before the client receives the response, the queue retains the payload. When synchronization runs, the same clock action can be inserted again.

The affected flow is in [`offlineClock.ts`](client/src/lib/offlineClock.ts) and [`ClockScreen.tsx`](client/src/pages/ClockScreen.tsx). The server mutation in [`timeEntries.ts`](server/routers/timeEntries.ts) has no idempotency check.

**Required design:** generate a UUID when the employee confirms a clock action; store it with the offline payload; add an `idempotency_key` column scoped to the employee; add a unique constraint; return the original result when the key is replayed. The client should remove the queue item only after receiving a confirmed idempotent response. Add tests for response loss, retry, duplicate browser tabs, and repeated online submissions.

### 3.2 Clock sequencing is vulnerable to concurrent requests

The mutation reads the most recent entry at lines 67–73 of [`timeEntries.ts`](server/routers/timeEntries.ts), validates the expected action, then inserts. Two requests for the same employee can read the same previous entry before either insert commits. The code can therefore accept two clock-ins or two clock-outs.

The entry insert and shift insert are also not wrapped in one database transaction. A successful time-entry insert followed by a failed shift insert can leave a clock-out without its completed shift.

**Required design:** perform the read, sequence validation, time-entry insert, and shift creation in one transaction. Acquire a per-employee PostgreSQL advisory lock or lock the employee row with `FOR UPDATE`. Add a database invariant or a transaction-level test that proves only one open clock-in exists. Decide how a stale offline action is handled when a different device has already changed the employee state.

### 3.3 Schema files are out of sync

[`drizzle/schema.ts`](drizzle/schema.ts) includes employer tax and UIF fields, employee tax numbers, platform administrators, and payslip UIF deductions. [`supabase-schema.sql`](supabase-schema.sql) does not define all of those fields or the `platform_admins` table before referencing it in an RLS statement. This is a production deployment blocker because a clean database created from the documented SQL is not equivalent to the schema used by the application.

**Required design:** choose Drizzle migrations or SQL migrations as the single source of truth, commit every migration, run migrations in CI against a disposable Postgres database, and document a safe production migration procedure. Add a schema-drift check that compares the application schema with the deployed database.

## 4. High-priority security and privacy issues

### 4.1 Employee login needs abuse controls

Employee login uses an employee number and a four-to-eight-digit PIN. The authentication router has no rate limit, progressive delay, lockout, device challenge, or security event logging. The same concern applies to Supabase-backed management login at the application boundary, even though Supabase provides some provider-level controls.

Add per-IP and per-employee-number throttling, failed-attempt counters, temporary lockout, generic error responses, and alerts for abnormal login activity. Management accounts should require multi-factor authentication before production use. Do not log PINs, access tokens, selfie data, or signed URLs.

### 4.2 Payslip sharing is a public bearer workflow

The route in [`server/index.ts`](server/index.ts) accepts a payslip UUID without an authenticated session and redirects to a temporary signed object URL. The UUID is not a sufficient authorization policy for payroll data. Even if UUIDs are difficult to guess, links can be copied from browser history, referrers, messages, screenshots, or logs.

Replace the route with one of the following policies: authenticated employee download, authenticated management download, or an explicitly created share token with short expiry, revocation, audience, and audit record. The token should not expose the underlying storage path.

### 4.3 Uploads need strict validation and resource limits

[`storage.ts`](server/storage.ts) decodes arbitrary data URLs and uses the declared MIME type to determine the object extension and content type. There is no decoded byte limit, image dimension limit, format verification, or server-side recompression. The tRPC request limit is 12 MB, but that limit applies to the base64 request rather than a validated image policy.

Restrict selfie and site-photo uploads to approved formats, cap dimensions and decoded size, strip metadata where appropriate, recompress to a known format, and reject malformed or polyglot content. Add per-employer storage quotas and a cleanup policy for abandoned uploads and replaced site photos.

### 4.4 Security headers and request protections are absent

The Express server does not configure a security-header middleware, explicit origin policy, request correlation IDs, or a CSRF strategy. SameSite cookies reduce some cross-site risk but are not a complete application policy.

Add secure headers, a strict Content Security Policy compatible with the app, HTTPS enforcement behind the deployment proxy, an explicit allowed-origin policy, CSRF protection or strict Origin checks for state-changing requests, and a documented reverse-proxy configuration.

## 5. Payroll and attendance product gaps

### 5.1 Payroll periods need finalization and auditability

The payslip generator upserts a single row for an employee and period. A later regeneration replaces the PDF path and totals. There is no version history, approval, finalization, correction reason, or immutable snapshot of the rates and inputs used at issuance.

A production payroll workflow should include a draft period, validation, approval, finalization, and controlled correction process. Store the exact rates, shift IDs, deductions, company settings, generator identity, generation time, and approval identity in an auditable payroll run. Once finalized, corrections should create an adjustment or replacement version rather than silently rewriting history.

### 5.2 The monthly cron job needs production safeguards

[`server/cron.ts`](server/cron.ts) starts an in-process scheduler. If multiple application instances run, each instance may execute the monthly job. A process restart near the scheduled time can also skip execution. The code logs success or failure to stdout but does not persist job state or alert an operator.

Move scheduled generation to one controlled worker or an external scheduler. Add a database-backed job lock, a run record, retry behavior, dead-letter handling, and a reconciliation command that reports employers or employees missing a payslip for a finalized period. Configure the timezone explicitly, especially if the business operates in South Africa.

### 5.3 Payroll calculations require domain confirmation

The current model supports weekday/weekend hourly rates and UIF deduction. It does not model overtime, unpaid breaks, leave, public holidays, allowances, bonuses, advances, PAYE, garnishees, employment status, pay frequency, or jurisdiction-specific rules. That may be acceptable for a narrow first release, but it must be explicitly defined and approved by a payroll specialist before legal reliance.

The product should also define rounding rules, overnight shifts, shifts spanning month boundaries, maximum shift length, missing clock-outs, manual corrections, and whether an out-of-geofence entry is payable.

### 5.4 Timezone and date policy must be explicit

Daily reports use UTC date boundaries in [`reports.ts`](server/routers/reports.ts), and payslip periods are calculated from date strings and JavaScript dates. The application displays times in the browser's local timezone, while the server and cron process may use a different timezone.

Store timestamps in UTC, store the employer's IANA timezone such as `Africa/Johannesburg`, calculate report and payroll boundaries in that timezone, and show the active timezone in management settings. Add tests for daylight-saving transitions, month boundaries, overnight shifts, and devices in a different timezone.

## 6. Data model and operational gaps

The employee code is checked for duplicates in application code but is not protected by a unique database constraint in [`drizzle/schema.ts`](drizzle/schema.ts). Concurrent employee creation can therefore create duplicate login identifiers. Add a unique constraint on `(employer_id, employee_code)` after cleaning any existing duplicates. Add appropriate indexes for employer-scoped employee lists, time entries, shifts, payslips, and report date queries.

There is no audit log for employee profile changes, rate changes, PIN resets, company setting changes, site changes, payslip generation, payslip sharing, activation/deactivation, or administrative impersonation. Payroll and attendance disputes require a durable history of who changed what, when, and why.

There is no documented backup and restore process. Production needs automated database backups, storage retention and deletion policies, restore drills, recovery-point and recovery-time objectives, and a plan for orphaned storage objects. Selfies and payslips contain personal information and require retention, access, deletion, and privacy policies suitable for the operating jurisdiction.

The platform administrator can delete a company, and the UI warns that the deletion is permanent. A production system should use a soft-delete or suspension period, require an explicit typed confirmation, record the actor, and restrict hard deletion to a controlled support workflow with backups.

## 7. Account and permission administration

The repository provides seed-based initial setup but does not provide a complete operational workflow for management accounts. Production should support inviting a supervisor, accepting an invitation, assigning an employer, changing roles, disabling access immediately, resetting access, enforcing MFA, and reviewing active sessions.

The distinction between **platform administrator** and **company management user** is now present in the main permission paths. It should be formalized in a permission matrix and tested at the API level. Every management router should have tests proving cross-company IDs cannot be read or modified. Platform operations such as impersonation should generate an audit event and display a clear banner while active.

## 8. Offline and mobile readiness

The offline shell and queue are useful, but offline operation needs a defined contract. The application should display pending actions, synchronization success, synchronization failure, retry count, and a manual retry control. It should protect the queue from unbounded growth and warn before clearing site data. A clock action should preserve capture time, device identifier, GPS accuracy, and a unique action ID.

The current offline flow does not allow a new employee to authenticate without an existing valid session. That is a reasonable security choice, but it should be stated clearly. The 30-day persistent employee cookie also requires a shared-device policy. Provide a prominent logout action and consider device enrollment or a shorter default for shared work phones.

Test offline behavior on Android Chrome with the app suspended, the browser killed, storage pressure, camera permission changes, GPS denial, clock changes, reconnect during upload, and multiple queued actions. Test whether the queue survives service-worker updates and whether old cached assets can be invalidated safely.

## 9. Quality, deployment, and operations

No automated tests were found. Before production, add at least the following layers:

| Test layer | Required coverage |
|---|---|
| Unit | Geofence distance, payroll rounding, UIF calculation, overnight shifts, month boundaries, timezone conversions, input normalization. |
| Database integration | Unique employee codes, transaction locking, idempotent clock actions, cross-employer authorization, payslip period uniqueness, migration upgrade paths. |
| API security | Brute-force controls, invalid sessions, role boundaries, IDOR attempts, public-share policy, upload limits, malformed data URLs. |
| Browser acceptance | Employee login, persistent session, camera/GPS permissions, online clocking, offline queue, reconnect sync, management report expansion, payslip issuance/download. |
| Operations | Cron single-run behavior, retry and recovery, backup restore, signed URL expiry, health checks, structured logs, alert delivery. |

The deployment should include a staged environment, environment-variable validation at startup, secret rotation procedures, database migration gates, rollback instructions, HTTPS, domain and DNS ownership, storage CORS policy if applicable, and a smoke-test checklist. Add `/api/health` checks for database connectivity and storage availability rather than returning only a static success response.

The application currently has no visible product analytics or error reporting. Add privacy-conscious operational telemetry, including request latency, failed mutations, queue depth, clock-sync failures, payroll generation failures, and storage failures. Keep personal content and credentials out of telemetry.

## 10. Recommended release sequence

### Release gate 1: Correctness and security

Implement idempotent offline clock actions, transactional clock sequencing, unique employee-number constraints, strict upload validation, login rate limits, secure headers, a safe payslip access policy, and versioned database migrations. Add the corresponding automated tests before onboarding any real workforce.

### Release gate 2: Payroll governance

Add employer timezone, payroll period finalization, audit history, correction/versioning, cron locking, retry and reconciliation, explicit rounding and overnight-shift rules, and a payroll-domain review. Confirm which statutory deductions and reports are in scope.

### Release gate 3: Operational readiness

Set up production monitoring, backups, restore drills, storage retention, alerting, secret rotation, staged deployment, rollback, account-management workflows, and a documented incident-response process.

### Release gate 4: Controlled pilot

Run a pilot with one company and a small employee group. Compare every generated shift and payslip against a manual control workbook for at least one complete pay period. Test offline synchronization in the actual field locations. Only after reconciliation should the system be expanded to additional companies.

## 11. Suggested first implementation batch

The best next engineering batch is not another visual feature. It should focus on the integrity boundary:

1. Add `clock_action_id`, client capture timestamp, sync timestamp, and a unique employee-scoped constraint.
2. Refactor the clock mutation into a transaction with a per-employee lock and idempotent replay.
3. Add a real migration that updates both fresh and existing databases, including the missing current fields in `supabase-schema.sql`.
4. Add rate limiting and security event logging to employee login and management access.
5. Replace public payslip bearer links with authenticated or explicitly revocable share tokens.
6. Add upload validation and storage quotas.
7. Create integration tests for the above behaviors and run them in CI.

## References

[1]: drizzle/schema.ts "FieldFace Drizzle database schema"
[2]: supabase-schema.sql "FieldFace Supabase SQL schema"
[3]: server/routers/timeEntries.ts "FieldFace time-entry API router"
[4]: client/src/lib/offlineClock.ts "FieldFace offline clock queue"
[5]: server/index.ts "FieldFace Express server entrypoint and payslip share route"
[6]: server/storage.ts "FieldFace storage upload and signed URL implementation"
[7]: server/payslipGeneration.ts "FieldFace payslip generation implementation"
[8]: server/routers/reports.ts "FieldFace reports API router"
[9]: server/cron.ts "FieldFace scheduled payslip generation"
[10]: package.json "FieldFace scripts and dependencies"
