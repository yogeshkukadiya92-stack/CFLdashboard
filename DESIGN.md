---
version: alpha
name: "CFL OS"
description: "A dense, calm operating console for workshop and coaching teams who need to scan and act quickly."
colors:
  primary: "#059669"
  primary-hover: "#047857"
  primary-soft: "#ECFDF5"
  ink: "#0B1220"
  muted: "#607086"
  canvas: "#F3F6F9"
  surface: "#FFFFFF"
  surface-subtle: "#F8FAFC"
  border: "#DFE6EE"
  border-strong: "#CBD5E1"
  danger: "#E11D48"
  warning: "#F59E0B"
  info: "#4F46E5"
typography:
  sans:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
  data:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
rounded:
  DEFAULT: "0.625rem"
  sm: "0.5rem"
  md: "0.625rem"
  lg: "0.75rem"
  panel: "0.875rem"
spacing:
  control-height: "2.25rem"
  section-gap: "0.75rem"
  panel-padding: "0.75rem"
  page-max: "100rem"
components:
  button: {}
  input: {}
  panel: {}
  dialog: {}
  table: {}
  status-rail: {}
---

# CFL OS Design System

## Overview

### Creative North Star

CFL OS should feel like a well-run workshop registration desk: a clear roster, a compact status strip, and tools placed where an operator reaches for them. The interface is operational rather than promotional; information hierarchy comes from alignment, dividers, and semantic status color instead of large decorative cards.

### Product context and register

- **Audience and primary job:** CFL administrators and operations staff create workshops, manage registrations, confirm attendance, and follow up with participants.
- **Target market and evidence:** India-first operations are reflected by `en-IN` number/date formatting, INR values, and the `Asia/Kolkata` domain timezone in the implementation. `docs/product-architecture.md` defines the broader workshop, CRM, payment, and reporting scope.
- **Locales and language policy:** The maintained admin UI is English. Data formatting uses Indian conventions where the domain requires it. UI copy remains plain, short, and action-led.
- **Usage scene:** Frequent desktop work with large tables, quick scanning, and occasional narrow-screen access. Density is intentional because operators compare many registrations in one session.
- **Register:** Product/admin for authenticated routes; branded public registration routes may be more expressive while retaining the same logo and semantic palette.
- **Memorable signature:** A slim operational status rail that puts live counts beside the controls they affect.
- **Restraint:** Forms, filters, tables, dialogs, and destructive actions use familiar patterns. Only one primary action is emphasized in each decision area.
- **Anti-references:** Avoid marketing-style hero layouts, grids of oversized KPI cards, excessive pill containers, gradients used as decoration, and whitespace that separates controls from the data they operate on.
- **Token ownership/runtime mapping:** Existing runtime tokens are canonical (Model B). `app/globals.css` owns semantic CSS variables and global behavior; `tailwind.config.ts` provides established utility aliases. This file mirrors accepted values and rationale. Drift is checked by design lint, project audit, and rendered browser comparison.

## Colors

Emerald is the CFL action and positive-state color. Slate ink and neutral surfaces carry the dense operational content. Amber means waiting/caution, rose is reserved for destructive or failed states, and indigo is an informational accent rather than a competing primary brand. Light surfaces use borders before shadows; dark mode remaps semantic variables in `app/globals.css` without changing intent.

Focus rings use the primary hue with sufficient visible spread. Status never relies on color alone: labels, icons, or counts carry the same meaning.

## Typography

Inter with system fallbacks is the canonical UI and data face. Page headings use heavy weight sparingly; table cells use 12–13px text, concise labels, and tabular numerals for comparable counts. Utility labels may use uppercase at 10–11px only for short structural labels. Long instructions and user-provided values stay sentence case and wrap when their full meaning matters.

## Layout

Authenticated screens use a 1600px maximum workspace with a persistent desktop sidebar and compact 12px section rhythm. Controls default to 36px high on desktop and 40px on narrow screens. Dense tables own their horizontal and vertical overflow inside the table panel; page or dialog shells must not clip sibling forms.

Workshop response dialogs and attendance rosters use the same fixed-density sequence: context/actions, a slim status rail, dataset controls, and the table viewport. The remaining space belongs to the records rather than spacer cards. On narrow screens, toolbars reflow and genuine data tables scroll horizontally rather than silently dropping fields.

## Elevation & Depth

Borders and tonal surfaces establish most hierarchy. The app shell and primary modal may use the shared panel shadow; nested static cards should not stack multiple shadows. Sticky headers use an opaque surface and a subtle divider so scrolling content never shows through.

## Shapes

Controls use 8–10px radii, panels use 12–14px radii, and status badges may be fully rounded. Rounded geometry signals grouping, not decoration. Dense table rows stay mostly flat; action icon backgrounds and semantic badges are the deliberate exceptions.

## Components

### Foundational visual states

Every interactive element has default, hover, focus-visible, active, disabled, and busy treatment where applicable. Disabled controls keep their footprint and lose interactivity. Loading, empty, no-results, and error states preserve the surrounding panel geometry. Reduced motion removes transforms and shortens transitions.

### Buttons and actions

Buttons combine emphasis with intent. Emerald solid is the main safe action, slate/white outline is utility, amber is caution, and rose is destructive. Compact table actions may be icon-only only when they have an accessible name and tooltip/title. Labels use specific verbs and do not change while busy.

### Navigation and data display

The dark sidebar provides product navigation; the current route remains visually distinct. Status rails replace separate metric cards when counts belong to one dataset. Tables use semantic markup, sticky headers, visible scrollbars, and stable identifiers. Related values such as mobile/email or payment/paid/due may share one cell when labels preserve comprehension.

### Forms and overlays

Fields use shared borders, white or subtle surfaces, and the emerald focus treatment. Product forms own validation and disable native validation bubbles. Textareas do not resize manually. Native select/date controls are accepted for admin workflows where platform-owned popups are acceptable. Dialogs stay within the visual viewport, trap focus, close with Escape when safe, and restore focus.

### Iconography

Lucide is the canonical icon family, normally at 14–18px with consistent stroke weight. Icons support labels; they replace text only for familiar row-level actions with accessible names.

### Motion

Transitions are quiet 140–200ms state feedback. Routine tables do not animate rows on every refresh. Reduced-motion mode makes interactions effectively immediate.

### Content and data visualization

Copy is concise and operational: “Share summary,” “Import,” “Confirm selected.” Counts use tabular numerals; INR and `en-IN` formatting remain consistent. Empty and failure text explains the next useful action.

## Do's and Don'ts

- **Do:** Keep response and attendance controls physically attached to the roster they affect.
- **Do:** Merge related table values when labels and full-value access remain intact.
- **Do:** Use the status rail for one dataset instead of repeating separate KPI cards.
- **Don't:** add empty spacer rows or helper cards between a toolbar and its table.
- **Don't:** hide columns or destructive consequences merely to make the layout look smaller.
