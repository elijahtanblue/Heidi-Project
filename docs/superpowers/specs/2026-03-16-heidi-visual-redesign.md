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

- **Font:** DM Serif Display, loaded via `next/font/google` in `app/layout.tsx`, variable name `--font-serif`
- **DOM application:** The font's `.variable` className must be applied to the `<html>` element in `app/layout.tsx` for the CSS variable to resolve:
  ```tsx
  import { DM_Serif_Display } from "next/font/google";
  const dmSerif = DM_Serif_Display({ subsets: ["latin"], weight: ["400"], variable: "--font-serif" });
  // In RootLayout:
  <html lang="en" className={dmSerif.variable}>
  ```
- **Global CSS rule:** Add to `globals.css`:
  ```css
  h1, h2 {
    font-family: var(--font-serif);
    font-weight: 400;
  }
  ```
  DM Serif Display only ships at weight 400. Setting `font-weight: 400` explicitly prevents the browser from synthesizing a faux-bold, which would look degraded.
- **Font weight cleanup:** Search every file listed in Section 12 for `<h1` and `<h2` elements and remove any `font-bold` or `font-semibold` Tailwind classes on those elements. The global CSS rule handles weight. Known instances across: `app/login/page.tsx`, `app/(routes)/dashboard/page.tsx`, `app/(routes)/patient-dashboard/page.tsx`, `app/(routes)/patient-dashboard/present/page.tsx`, `app/(routes)/check-access/page.tsx`.
- **Body text:** Unchanged — system sans-serif for all labels, table content, form text, and paragraphs.

---

## 3. Clinician Navbar (`components/Navbar.tsx`)

- Background: `--kinetic-maroon` (`#3D0B1A`)
- Logo mark: gold (`--kinetic-gold`) background, white "K" — unchanged treatment, pops against maroon
- "Kinetic" wordmark: white text
- Nav links: `text-white/70` inactive, `text-white` active, active state has `--kinetic-maroon-light` pill background
- Sign out button: gold background (`--kinetic-gold`), **dark text** (`text-[var(--kinetic-dark)]`) — **changed from current `text-white`** (gold at `#F2CE3D` is too bright for white text)
- Remove `border-b border-gray-200` — dark/cream contrast handles separation naturally

---

## 4. Patient Navbar

The patient-facing navbar uses an **inverted treatment** to feel warmer and less institutional:

- Background: `bg-[var(--kinetic-bg)]` (cream) with a bottom border `border-[var(--kinetic-maroon)]/20`
- Logo mark: gold background, white "K" — same as clinician
- "Kinetic" wordmark: `--kinetic-maroon` text
- No nav links (patient has no sub-navigation)
- Sign out button: `--kinetic-maroon` background, white text — **same `onClick` handler as the clinician variant** (reuse, not duplicate). The `variant` prop only changes styling; the sign-out logic (`signOut({ redirect: false })` + `window.location.href`) is shared.

### Wiring

`app/(routes)/layout.tsx` already reads `user?.role`. Add a `variant` prop to `Navbar` (`"clinician" | "patient"`, defaulting to `"clinician"`):

```tsx
// In app/(routes)/layout.tsx
const isPatient = user?.role === "patient";
// ...
<Navbar isAdmin={isAdmin} variant={isPatient ? "patient" : "clinician"} />
```

The `Navbar` component conditionally renders its **styling and structure** based on `variant`:
- When `variant === "patient"`: suppress the `<nav>` link block entirely (e.g., `{variant !== "patient" && <nav>...</nav>}`). Patients have no sub-navigation.
- When `variant === "clinician"` (default): render nav links as now.

No separate layout file needed.

> **Note:** `app/(routes)/layout.tsx` relies on the existing auth redirect to guarantee authenticated users reach this layout. `user` may be `undefined` for unauthenticated requests — this is identical to the existing `isAdmin` behaviour and is acceptable for this app.

---

## 5. Login Page (`app/login/page.tsx`)

- Background: `--kinetic-bg` (cream) — unchanged
- Layout: centred card — unchanged
- Card: `bg-white rounded-lg shadow-sm` — **remove** `border border-gray-200`, add a `4px` maroon top accent strip (`border-t-4 border-[var(--kinetic-maroon)]`)
- "Kinetic" heading: DM Serif Display (inherits from global h1 rule)
- "Sign in to your account" subheading: DM Serif Display (inherits from global h2 rule)
- Button: `bg-[var(--kinetic-gold)]`, `text-[var(--kinetic-dark)]`, `hover:bg-[var(--kinetic-gold-hover)]` — replace existing `hover:opacity-90` with the hover token for consistency
- Input focus ring: `focus:ring-[var(--kinetic-gold)]`

> **Important:** At `#F2CE3D`, the gold is too bright for white button text. All gold buttons across the app should use `text-[var(--kinetic-dark)]` rather than `text-white`.

---

## 6. Cards and Surfaces (global)

A "card container" is any `div` that uses `border border-gray-200` as its outer boundary (i.e., a container that holds content, not a table row divider). For every such element:
- Remove `border border-gray-200`
- Add `shadow-sm` (unless the element has special treatment specified in its own section — e.g., the login card gets a maroon top strip per Section 5, and the patient empty-state card gets a warm background per Section 8)
- The patient dashboard empty-state card (`border border-gray-200 p-8`) should also have its border removed

Table internal row dividers (`border-gray-50`, `border-gray-100`) are **retained** — functional separators for clinical data.

Vertical spacing between dashboard sections: increase from `mb-6` to `mb-8` to compensate for lost border definition.

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
- Empty state card: background `bg-[var(--kinetic-gold-light)]` (`#FEF5C3`) instead of white — warm and inviting. **No `shadow-sm`** on this element; the warm background provides sufficient visual distinction without a shadow.
- Patient navbar: uses inverted variant (see Section 4)

---

## 9. Forms and Components

### `PatientPresentForm.tsx`
- Section divider label — search for the exact string `"Physiotherapist fills in below"` — change its text colour class from `text-gray-500` to `text-[var(--kinetic-maroon)]`
- (`AddUpdateForm.tsx` does not contain this string — no divider label change needed there)
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
| `app/(routes)/layout.tsx` | Pass `variant` prop to Navbar based on `user?.role` |
| `components/Navbar.tsx` | Dark maroon treatment + `variant` prop for patient |
| `app/login/page.tsx` | Maroon top strip, serif headings, gold button |
| `app/(routes)/dashboard/page.tsx` | Serif headings, card shadow/no-border, spacing |
| `app/(routes)/patient-dashboard/page.tsx` | Larger serif heading, subtitle copy, warm empty state, patient navbar |
| `app/(routes)/patient-dashboard/present/page.tsx` | Patient navbar |
| `components/EpisodesSection.tsx` | Card shadow/no-border |
| `components/AddUpdateForm.tsx` | Gold button |
| `components/PatientPresentForm.tsx` | Maroon divider label, gold button |
| `components/PatientManagement.tsx` | Card shadow/no-border |
| `components/PatientSnapshot.tsx` | Card shadow/no-border |
| `components/CreatePatientForm.tsx` | Gold button |
| `components/CreateEpisodeForm.tsx` | Gold button |
| `components/ClinicOptInToggle.tsx` | Gold accent |
| `components/ConsentToggle.tsx` | Gold accent |
| `app/(routes)/check-access/page.tsx` | Serif heading |
