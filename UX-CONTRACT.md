# UX Contract

## Product context

- Audience: CFL administrators, workshop operators, and permissioned sales/attendance staff.
- Primary jobs: Create and schedule workshops, manage registrations, confirm participants, operate follow-ups, import/export data, and review outcomes.
- Target market(s): India-first, with business evidence in `docs/product-architecture.md` and Indian formatting/timezone conventions in the maintained code.
- Active locales: English UI with `en-IN` domain formatting.
- Language/content register and native-review policy: Plain operational English; business owners review customer-facing registration copy.
- Timezone/calendar policy: Gregorian calendar; workshop-domain time uses `Asia/Kolkata` where a timezone is required.
- Accessibility target: WCAG 2.2 AA.

## Business-context sources

| Domain / scope | Authoritative source | Source type | Reviewed date |
|---|---|---|---|
| Product scope and data scale | `docs/product-architecture.md` | Product architecture | 2026-08-31 |
| Permission model | `docs/product-architecture.md`, `proxy.ts`, `lib/sales-permissions.ts` | Product architecture + enforced route contract | 2026-08-31 |
| Registration persistence | `lib/live-state.ts`, registration API routes | Runtime/API contract | 2026-08-31 |
| Deletion / retention | Retention policy is not yet documented; current hard-delete behavior is implementation evidence only | Policy gap | 2026-08-31 |
| Billing / payment | `docs/product-architecture.md`, Razorpay API/webhook routes | Product architecture + API contract | 2026-08-31 |
| Market / content conventions | `DESIGN.md`, maintained `en-IN` and `Asia/Kolkata` formatters | Design context + runtime evidence | 2026-08-31 |

## Visual contract

- Project `DESIGN.md`: `DESIGN.md`.
- Token ownership model: Existing runtime source is canonical (Model B).
- Runtime design-system/token source: `app/globals.css` and `tailwind.config.ts`.
- Mapping/export/adapters: CSS semantic variables feed global states; Tailwind utilities and shared components consume them.
- Token drift gate: DESIGN.md lint, premium project audit, typecheck/build, and representative browser screenshots.
- Supported themes: Light is current product default; dark mappings remain maintained in `app/globals.css`.
- Design-context owner/review policy: Durable visual changes update runtime tokens and `DESIGN.md` together.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Table Selection | Workshop response table selection model in `app/workshop-master/page.tsx` | This contract + page behavior | visible results only | keyboard + targeted browser flow |
| Select/Listbox | Native select for current admin forms | This contract | native when platform popup is accepted | keyboard + open-popup browser check |
| Date | Native date/time inputs for current admin forms | This contract | native Gregorian | locale + keyboard check |
| Form | Page form state plus shared global field treatment | Page behavior + this contract | create / edit | typecheck + submission flow |
| Scrollbar | Global baseline in `app/globals.css` | `DESIGN.md` | thin geometry exception | computed/rendered browser check |
| Toast | Page-owned `aria-live` status region pending provider migration | This contract | success / error | live-region check |
| CRUD | Route component + `lib/live-state.ts`/API behavior | Product/API code + this contract | return / stay as ledgered below | full-flow check |

## Component behavior

| Component | Default | Hover | Focus | Active | Disabled | Busy | Error |
|---|---|---|---|---|---|---|---|
| Button | semantic intent + stable label | tonal emphasis | visible emerald ring | 1px press feedback | non-interactive, reduced opacity | stable dimensions | inline/dialog recovery |
| Icon button | accessible name required | semantic surface | visible ring | press feedback | unavailable | stable dimensions | nearby text/status |
| Input | labeled, 36px admin height | stronger border | emerald ring | n/a | non-editable appearance | adornment slot | associated text |
| Search | local filtering + clear button | clear action visible | input retains focus after clear | immediate clear | n/a | reserved indicator if remote | no-results message |
| Textarea | `resize: none` | stronger border | emerald ring | n/a | non-editable | stable | associated text |
| Table/list | semantic table + sticky header | row tint | focused controls remain visible | selected count toolbar | unavailable actions stay placed | stable viewport | empty/no-results/retry region |

## Dataset navigation

- Admin tables: Server cursor pagination for large historical/CRM datasets; bounded render-all is accepted for the current locally hydrated workshop response and attendance datasets.
- Exploratory lists: Explicit load-more if introduced; no default infinite scroll.
- URL state: Server-backed committed filters/page/sort use URL state. Workshop response visibility filters currently persist per workshop in local storage because the modal is transient and preserves existing behavior.
- Page size: API-defined for paginated datasets; current workshop response modal renders its bounded visible result set in an internal viewport.
- Empty/no-results/error/loading treatment: Distinguish an empty workshop from no search matches; keep the table frame stable.
- Back/scroll restoration: Route-backed datasets restore URL state; closing the workshop dialog restores focus to the workshop trigger.
- Selection scope: “Select all” means all currently visible response rows, never all server results. Filter/scope changes clear or constrain selection. Bulk actions show the exact selected count and preserve a logical focus location.

## Flow ledger

| Operation | Trigger | Pending | Success destination | Success feedback | Failure recovery | Focus outcome | Source ref |
|---|---|---|---|---|---|---|---|
| Create workshop | Create workshop / Save | stable submit action | Workshop list | status message | preserve draft and retry | owning list/workshop | `app/workshop-master/page.tsx` |
| Edit workshop | Edit / Update | stable submit action | Existing form/list behavior | status message | preserve values and retry | edited context | `app/workshop-master/page.tsx` |
| Delete response | Delete response | confirmation action | Open workshop roster | status message | dialog remains/retry where supported | next logical roster control | `app/workshop-master/page.tsx` |
| Search responses | Search field | immediate local filter | Same dialog | result set/count | clear search | search input | `app/workshop-master/page.tsx` |
| Bulk confirm/share | Confirm selected / Share selected | stable dialog/action | Same roster | status message | preserve selection and explain failure | bulk toolbar or surviving row | `app/workshop-master/page.tsx` |
| Import/export | Import / Excel / Waiting CSV | route or browser download | Import route / same dialog | download/status message | remain in current context | trigger/current route | `app/workshop-master/page.tsx` |
| Cancel/back | Close dialog | none | Workshop list | none | n/a | opening workshop trigger | `app/workshop-master/page.tsx` |
| Review attendance | Session / attendance scope | immediate local comparison | Same attendance workspace | stable counts and roster | clear filters / refresh | scope control or roster | `app/workshop-attendance/page.tsx` |
| Update attendance status | Status select | persisted update | Same attendance roster | updated row state | keep current roster and retry | edited status control | `app/workshop-attendance/page.tsx` |

## Navigation and responsive behavior

- Route document title policy: `{Page} — Coach For Life`; loading/error routes must not retain a stale title.
- Route error / 403 page behavior: APIs return 401/403; dedicated app-owned route error surfaces remain a tracked platform gap.
- Breadcrumb/tab/route-state policy: Use route links for destinations and pressed-state controls for transient response scopes.
- Sidebar/drawer/bottom-sheet transformation: Persistent desktop sidebar; modal navigation drawer on narrow screens with inert background and focus restoration.
- Responsive table strategy: Horizontal scroll preserves row comparison. Sticky identifier columns apply only at large breakpoints. Related contact and payment values share labeled cells; no data or action is silently hidden.
- Truncation/full-value access: Email truncation has its full value in the accessible/title path; primary names and call notes wrap.
- Focus restoration and sticky-obstruction policy: Dialogs trap focus, Escape-close when no child modal is active, and restore the opening trigger. Sticky headers remain opaque.

## Overlays and feedback

- Dialog primitive: Existing app-owned dialogs; the workshop response dialog owns viewport bounds, focus trap, Escape, backdrop close, and focus restoration.
- Destructive confirmation levels: Existing response deletion is treated as irreversible and requires a named app-owned confirmation. Retention policy must be resolved before changing lifecycle behavior.
- Toast placement/duration/deduplication: Top-right page-owned live region, stable geometry, manual dismiss, short timeout; migrate to one shared provider before adding another toast implementation.
- Alert/banner scope and persistence: Waiting mode appears as a compact persistent dataset condition inside the status rail.
- Tooltip delay/dismissal: Icon-only actions have accessible names and short product tooltips/title as an interim pattern.
- Unsaved-changes behavior: Long workshop forms should guard dirty navigation; current implementation remains a known gap.
- Layer/z-index contract: base < sticky chrome < popover < page dialog < confirmation dialog < status notification.

## Async and resilience

- Mutation default: Pessimistic for destructive, payment, confirmation, and external messaging actions.
- Idempotency and duplicate-submit policy: Disable/reject repeat activation while an operation is pending; use API idempotency when available.
- Offline/read-stale/write behavior: Keep last successful registrations visible when polling fails; do not claim a refresh succeeded.
- Retry/backoff/timeout behavior: Bounded/manual retry for mutations; background registration refresh does not blank existing content.
- Version conflict and multi-tab behavior: Storage events refresh local state; authoritative API state wins where enabled.
- Session expiry/re-authentication: 401 returns to approved login; 403 must explain the access boundary without exposing hidden data.
- Stale-request cancellation/invalidation and pending-state ownership: Older work must not overwrite newer route/filter state.
- Dialog/form preservation and retry after mutation failure: Keep user context open until server-confirmed success for irreversible actions.

## Validation

- Schema/validation layer: Existing page validation and API checks; introduce a shared schema adapter when repeated form migration begins.
- Trigger timing: Submit first, then correct invalid fields without destructive clearing.
- Error summary/inline policy: Long forms need form-level summary plus associated inline errors; brief action failures remain in their dialog/panel.
- Server error mapping: Human-readable product text; never raw backend payloads.
- Sensitive-value handling: Do not place secrets or private participant values in URLs, notifications, or logs.
- Product forms use `noValidate`, focus the first invalid field when implemented, prevent duplicate submit, preserve non-sensitive values, and guard unsaved changes.

## Permission and clipboard

- Permission UI strategy: Server/API authorization is authoritative. Hide unavailable navigation, disable only when the reason is useful in context, and show a dedicated 403 surface for direct forbidden routes.
- Clipboard copy policy: Copy full intended values only from explicit controls; never put secret values in a toast.
- Disabled-state explanation: Use nearby text or a tooltip when the reason is not obvious.

## Migration status

- Migration ledger location: This contract records the current touched slice; a broader ledger should be added only when the team begins cross-route migration.
- Canonical primitives and owners: Global tokens/scrollbars in `app/globals.css`; shell in `components/admin-platform-shell.tsx`; current shared confirmation/filter components under `components/`.
- Current risk-prioritized slice: Workshop response and attendance density, focus, dataset controls, and table overflow.
- Legacy import/token enforcement: New work consumes CSS semantic variables/shared utilities instead of new screen-local raw palettes.
- Rollout/rollback and removal gates: Keep API/data behavior unchanged; visual slice can revert independently from persistence logic.

## Verification

- Required static commands: premium strict audit, DESIGN.md lint, `npm run typecheck`, `npm run test:crm`, `npm run build`.
- Browser/device/locale/theme matrix: Desktop and narrow viewport, English/en-IN, light mode; dark mapping checked when enabled.
- Accessibility checks: Keyboard, focus trap/restoration, visible focus, accessible names, selection scope, no-results state.
- Component-state/visual regression coverage: Representative dialog screenshots at desktop and narrow widths.
- Canonical sibling flow used for comparison: Workshop Attendance response table and Admin Platform shell.
- Project audit command/result: Recorded with each material UI task.
- CRUD full-flow evidence: Workshop list/open/search/select/close plus applicable mutations.
- Failure-path evidence: Existing last-good-data behavior and mutation error messaging; destructive-dialog retry remains an explicit check.
