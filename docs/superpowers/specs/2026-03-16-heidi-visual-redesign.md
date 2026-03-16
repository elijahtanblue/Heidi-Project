# Heidi Visual Redesign Spec

**Date:** 2026-03-16
**Goal:** Overhaul the Kinetic MVP frontend to match the visual language of the Heidi Health parent company website, while retaining the "Kinetic" brand name and all existing functionality.

---

## Overview

The redesign adopts Heidi's aesthetic — dark maroon brand colour, vivid yellow gold, display serif headings, soft card surfaces — across all pages. No logic, data model, API, or layout structure changes. The patient dashboard receives a softer, more personal variant of the same design language.

---

## 1. Design Tokens (`app/globals.css`)

| Token | Old Value | New Value | Usage |
|---|---|---|---|
| `--kinetic-maroon` | _(new)_ | `#3D0B1A` | Navbar bg, strong accents |
| `--kinetic-maroon-light` | _(new)_ | `#7A1D35` | Active/hover states on maroon surfaces |
| `--kinetic-gold` | `#D4A843` | `#F2CE3D` | CTA buttons, focus rings, logo mark bg |
| `--kinetic-gold-hover` | `#C49733` | `#DDB82A` | Gold button hover state |
| `--kinetic-gold-light` | `#F5E6C8` | `#FEF5C3` | Soft yellow highlight (patient empty state, active nav on light bg) |
| `--kinetic-bg` | `#f5f5f0` | `#F7F3EE` | Page background (warmer cream) |
| `--kinetic-dark` | `#1a1a1a` | `#1a1a1a` | Unchanged |
| `--kinetic-gray` | `#6b7280` | `#6b7280` | Unchanged |

---

## 2. Typography

- **Font:** DM Serif Display, loaded via `next/font/google` in `app/layout.tsx`
- **Application:** CSS variable `--font-serif` exposed on `:root`, applied to all `h1` and `h2` elements via a global rule in `globals.css`
- **Body text:** Unchanged — system sans-serif for all labels, table content, form text, and paragraphs. High readability for clinical data.

---

## 3. Clinician Navbar (`components/Navbar.tsx`)

- Background: `--kinetic-maroon` (`#3D0B1A`)
- Logo mark: gold (`--kinetic-gold`) background, white "K" — unchanged treatment, pops against maroon
- "Kinetic" wordmark: white text
- Nav links: `text-white/70` inactive, `text-white` active, active state has `--kinetic-maroon-light` pill background
- Sign out button: gold background (`--kinetic-gold`), dark text — unchanged treatment
- Remove `border-b border-gray-200` — dark/cream contrast handles separation naturally

---

## 4. Patient Navbar

The patient-facing navbar (rendered on `/patient-dashboard` and `/patient-dashboard/present`) uses an **inverted treatment** to feel warmer and less institutional:

- Background: `bg-[var(--kinetic-bg)]` (cream) with a bottom border `border-[var(--kinetic-maroon)]/20`
- Logo mark: gold background, white "K" — same as clinician
- "Kinetic" wordmark: `--kinetic-maroon` text
- No nav links (patient has no sub-navigation)
- Sign out button: `--kinetic-maroon` background, white text

> **Implementation note:** The patient pages do not currently use the `Navbar` component. A separate `PatientNavbar` component should be created, or the existing `Navbar` extended with a `variant` prop. Either approach is acceptable; a `variant="patient"` prop on the existing component avoids duplication.

---

## 5. Login Page (`app/login/page.tsx`)

- Background: `--kinetic-bg` (cream) — unchanged
- Layout: centred card — unchanged
- Card: `bg-white rounded-lg shadow-sm` — **remove** `border border-gray-200`, add a `4px` maroon top accent strip (`border-t-4 border-[var(--kinetic-maroon)]`)
- "Kinetic" heading: DM Serif Display (inherits from global h1 rule)
- "Sign in to your account" subheading: DM Serif Display (inherits from global h2 rule)
- Button: updated gold `#F2CE3D`, dark text (gold is too light for white text at this brightness — use `text-[var(--kinetic-dark)]`)
- Input focus ring: `focus:ring-[var(--kinetic-gold)]`

> **Important:** At `#F2CE3D`, the gold is too bright for white button text. All gold buttons across the app should use `text-[var(--kinetic-dark)]` rather than `text-white`.

---

## 6. Cards and Surfaces (global)

- All card containers: remove `border border-gray-200`, replace with `shadow-sm`
- Table internal row dividers (`border-gray-50`, `border-gray-100`) are **retained** — functional separators for clinical data
- Vertical spacing between dashboard sections: increase from `mb-6` to `mb-8` to compensate for lost border definition

---

## 7. Clinician Dashboard (`app/(routes)/dashboard/page.tsx`)

- Page heading "Shared Patient History": h1 — picks up DM Serif Display from global rule
- Section headings "Your Access Level", "Clinics", "Patient Consent": h2 — picks up DM Serif Display
- Access progress card: `shadow-sm`, no border
- Clinics table card: `shadow-sm`, no border
- Patient consent table: `shadow-sm`, no border
- Status tier badges (Full/Limited/Minimal/Inactive): **unchanged** — semantic green/yellow/orange/red retained for clinical clarity

---

## 8. Patient Dashboard (`app/(routes)/patient-dashboard/page.tsx`)

- Patient name heading (`{patient.firstName} {patient.lastName}`): DM Serif Display at `text-3xl` (larger than current `text-2xl`) — more of a personal greeting than a dashboard title
- Subtitle: change "Your treatment history" → **"Your care journey"**
- "Present to Physio" button: updated gold, dark text
- Empty state card: background `--kinetic-gold-light` (`#FEF5C3`) instead of white — warm and inviting
- Patient navbar: uses inverted variant (see Section 4)

---

## 9. Forms and Components

### `AddUpdateForm.tsx` and `PatientPresentForm.tsx`
- Section divider label ("Physiotherapist fills in below"): change text colour from `text-gray-500` to `text-[var(--kinetic-maroon)]`
- All buttons: updated gold, dark text
- Input focus rings: updated gold

### All other components (`CreatePatientForm`, `CreateEpisodeForm`, `PatientManagement`, `PatientSnapshot`, `ClinicOptInToggle`, `ConsentToggle`, `EpisodesSection`)
- Buttons: updated gold token (automatic via CSS variable)
- Input focus rings: updated gold token (automatic)
- Card containers: `shadow-sm`, no border
- Section headings (h2): DM Serif Display via global rule

---

## 10. Check-Access Page (`app/(routes)/check-access/page.tsx`)

- Page heading: h1 — picks up DM Serif Display
- No other structural changes

---

## 11. What Does NOT Change

- All page layouts and route structure
- All component logic and props
- All tests (purely visual changes, no behaviour changes)
- Status badge colours (green/yellow/orange/red)
- All API endpoints and data models
- Mobile/responsive breakpoints (out of scope)

---

## 12. Files Affected

| File | Change Type |
|---|---|
| `app/globals.css` | New tokens, serif global rule |
| `app/layout.tsx` | Import DM Serif Display font |
| `components/Navbar.tsx` | Dark maroon treatment + `variant` prop for patient |
| `app/login/page.tsx` | Maroon top strip, serif headings, gold button |
| `app/(routes)/dashboard/page.tsx` | Serif headings, card shadow/no-border, spacing |
| `app/(routes)/patient-dashboard/page.tsx` | Larger serif heading, subtitle copy, warm empty state, patient navbar |
| `app/(routes)/patient-dashboard/present/page.tsx` | Patient navbar |
| `components/EpisodesSection.tsx` | Card shadow/no-border |
| `components/AddUpdateForm.tsx` | Maroon divider label, gold button |
| `components/PatientPresentForm.tsx` | Maroon divider label, gold button |
| `components/PatientManagement.tsx` | Card shadow/no-border |
| `components/PatientSnapshot.tsx` | Card shadow/no-border |
| `components/CreatePatientForm.tsx` | Gold button |
| `components/CreateEpisodeForm.tsx` | Gold button |
| `components/ClinicOptInToggle.tsx` | Gold accent |
| `components/ConsentToggle.tsx` | Gold accent |
| `app/(routes)/check-access/page.tsx` | Serif heading |
