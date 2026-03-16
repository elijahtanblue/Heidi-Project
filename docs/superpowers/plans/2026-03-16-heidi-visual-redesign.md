# Heidi Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the Kinetic MVP frontend to match the Heidi Health visual language — dark maroon navbar, vivid gold, DM Serif Display headings, soft card surfaces — across all pages, with a warmer patient-dashboard variant.

**Architecture:** Purely visual changes. New CSS tokens flow through all components automatically. Typography is applied globally via a CSS rule. The Navbar gains a `variant` prop to serve two distinct treatments from one component. No logic, API, or test behaviour changes.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS v4, `next/font/google` (DM Serif Display), Jest + Testing Library

**Spec:** `docs/superpowers/specs/2026-03-16-heidi-visual-redesign.md`

---

## File Map

| File | Action | What changes |
|---|---|---|
| `app/globals.css` | Modify | New tokens, serif global rule |
| `app/layout.tsx` | Modify | Load DM Serif Display, apply `.variable` to `<html>` |
| `components/Navbar.tsx` | Modify | `variant` prop, maroon clinician style, cream patient style |
| `app/(routes)/layout.tsx` | Modify | Pass `variant` to Navbar based on `user?.role` |
| `app/login/page.tsx` | Modify | Maroon top strip on card, remove `font-bold` from headings, dark button text |
| `app/(routes)/dashboard/page.tsx` | Modify | Remove `font-bold`/`font-semibold` from h1/h2, `border` → `shadow-sm`, `mb-6` → `mb-8` |
| `app/(routes)/check-access/page.tsx` | Modify | Remove `font-bold` from h1 |
| `app/(routes)/patient-dashboard/page.tsx` | Modify | Remove `font-bold`, h1 `text-3xl`, subtitle copy, warm empty state |
| `app/(routes)/patient-dashboard/present/page.tsx` | Modify | Remove `font-bold` from h1 |
| `components/EpisodesSection.tsx` | Modify | Remove `font-semibold` from h2, `border` → `shadow-sm`, button text dark |
| `components/CreateEpisodeForm.tsx` | Modify | `border` → `shadow-sm`, button text dark |
| `components/AddUpdateForm.tsx` | Modify | Button text dark |
| `components/PatientPresentForm.tsx` | Modify | `border` → `shadow-sm`, divider label maroon, button text dark |
| `components/CreatePatientForm.tsx` | Modify | `border` → `shadow-sm`, button text dark, `hover:opacity-90` → hover token |
| `components/PatientManagement.tsx` | Modify | `border` → `shadow-sm` |
| `components/SimulationPanel.tsx` | Modify | `border` → `shadow-sm`, remove `font-semibold` from h2, button text dark |
| `tests/navbar.test.tsx` | Create | Verify `variant` prop: patient hides nav links, clinician shows them |

> **Note on SimulationPanel:** The spec's file list omits `SimulationPanel.tsx`, but it uses the same border/font/button patterns as other components and lives on the `check-access` page. It is included here to prevent a visually inconsistent admin panel.

---

## Chunk 1: Foundation — Tokens and Typography

### Task 1: Update CSS tokens and load DM Serif Display

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

No tests needed — purely CSS/font changes with no testable behaviour.

- [ ] **Step 1: Update `app/globals.css`**

Replace the entire `:root` block and add the serif rule:

```css
@import "tailwindcss";

:root {
  --kinetic-maroon: #3D0B1A;
  --kinetic-maroon-light: #7A1D35;
  --kinetic-gold: #F2CE3D;
  --kinetic-gold-hover: #DDB82A;
  --kinetic-gold-light: #FEF5C3;
  --kinetic-dark: #1a1a1a;
  --kinetic-gray: #6b7280;
  --kinetic-bg: #F7F3EE;
}

h1, h2 {
  font-family: var(--font-serif);
  font-weight: 400;
}
```

- [ ] **Step 2: Update `app/layout.tsx`**

Replace the entire file:

```tsx
import type { Metadata } from "next";
import { DM_Serif_Display } from "next/font/google";
import "./globals.css";

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Kinetic",
  description: "Shared Patient History — Access earned through contributing updates.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={dmSerif.variable}>
      <body className="bg-[var(--kinetic-bg)] text-[var(--kinetic-dark)] antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Run the dev server to spot-check (optional manual check)**

```bash
cd "d:/Vibe Coded Projects/Heidi Project" && npx next build 2>&1 | tail -20
```

Expected: build succeeds (font loaded, no type errors).

- [ ] **Step 4: Run full test suite to confirm no regressions**

```bash
cd "d:/Vibe Coded Projects/Heidi Project" && npx jest --no-coverage 2>&1 | tail -10
```

Expected: same pass count as before (389 tests).

- [ ] **Step 5: Commit**

```bash
cd "d:/Vibe Coded Projects/Heidi Project" && git add app/globals.css app/layout.tsx && git commit -m "feat: add Heidi design tokens and DM Serif Display font"
```

---

## Chunk 2: Navbar

### Task 2: Add variant prop and apply maroon/patient treatments

**Files:**
- Modify: `components/Navbar.tsx`
- Modify: `app/(routes)/layout.tsx`
- Create: `tests/navbar.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/navbar.test.tsx`:

```tsx
/**
 * Tests for Navbar variant prop.
 * Clinician variant shows nav links; patient variant hides them.
 */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
jest.mock("next-auth/react", () => ({ signOut: jest.fn() }));

import Navbar from "@/components/Navbar";

describe("Navbar", () => {
  test("clinician variant renders nav links", () => {
    render(<Navbar variant="clinician" />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  test("patient variant does not render nav links", () => {
    render(<Navbar variant="patient" />);
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  test("defaults to clinician variant when variant prop is omitted", () => {
    render(<Navbar />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  test("patient variant renders sign out button", () => {
    render(<Navbar variant="patient" />);
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "d:/Vibe Coded Projects/Heidi Project" && npx jest --no-coverage tests/navbar.test.tsx 2>&1 | tail -15
```

Expected: FAIL — `variant` prop doesn't exist yet.

- [ ] **Step 3: Rewrite `components/Navbar.tsx`**

Replace the entire file:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const allNavLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/check-access", label: "Check Access", adminOnly: true },
];

interface NavbarProps {
  isAdmin?: boolean;
  variant?: "clinician" | "patient";
}

export default function Navbar({ isAdmin = false, variant = "clinician" }: NavbarProps) {
  const navLinks = allNavLinks.filter((link) => !link.adminOnly || isAdmin);
  const pathname = usePathname();
  const isPatient = variant === "patient";

  async function handleSignOut() {
    await signOut({ redirect: false });
    window.location.href = `${window.location.origin}/login`;
  }

  return (
    <header
      className={
        isPatient
          ? "bg-[var(--kinetic-bg)] border-b border-[var(--kinetic-maroon)]/20"
          : "bg-[var(--kinetic-maroon)]"
      }
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-6">
            <Link href={isPatient ? "/patient-dashboard" : "/dashboard"} className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-[var(--kinetic-gold)] flex items-center justify-center">
                <span className="text-white font-bold text-xs">K</span>
              </div>
              <span
                className={`font-bold text-lg ${
                  isPatient ? "text-[var(--kinetic-maroon)]" : "text-white"
                }`}
              >
                Kinetic
              </span>
            </Link>

            {/* Nav Links — clinician only */}
            {!isPatient && (
              <nav className="flex items-center gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      pathname === link.href
                        ? "bg-[var(--kinetic-maroon-light)] text-white"
                        : "text-white/70 hover:text-white"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              isPatient
                ? "bg-[var(--kinetic-maroon)] text-white hover:bg-[var(--kinetic-maroon-light)]"
                : "bg-[var(--kinetic-gold)] text-[var(--kinetic-dark)] hover:bg-[var(--kinetic-gold-hover)]"
            }`}
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Update `app/(routes)/layout.tsx`**

Replace the entire file:

```tsx
import Navbar from "@/components/Navbar";
import { auth } from "@/lib/auth";

export default async function RoutesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user as unknown as Record<string, unknown> | undefined;
  const isAdmin = user?.role === "admin";
  const isPatient = user?.role === "patient";

  return (
    <>
      <Navbar isAdmin={isAdmin} variant={isPatient ? "patient" : "clinician"} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </>
  );
}
```

- [ ] **Step 5: Run Navbar tests**

```bash
cd "d:/Vibe Coded Projects/Heidi Project" && npx jest --no-coverage tests/navbar.test.tsx 2>&1 | tail -15
```

Expected: all 4 tests PASS.

- [ ] **Step 6: Run full suite**

```bash
cd "d:/Vibe Coded Projects/Heidi Project" && npx jest --no-coverage 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
cd "d:/Vibe Coded Projects/Heidi Project" && git add components/Navbar.tsx "app/(routes)/layout.tsx" tests/navbar.test.tsx && git commit -m "feat: add Navbar variant prop with maroon clinician and cream patient treatments"
```

---

## Chunk 3: Pages

### Task 3: Login, dashboard, check-access, and patient dashboard pages

**Files:**
- Modify: `app/login/page.tsx`
- Modify: `app/(routes)/dashboard/page.tsx`
- Modify: `app/(routes)/check-access/page.tsx`
- Modify: `app/(routes)/patient-dashboard/page.tsx`
- Modify: `app/(routes)/patient-dashboard/present/page.tsx`

No new tests — these are class-level changes on server components. The existing routing tests cover the guard logic and are unaffected.

- [ ] **Step 1: Update `app/login/page.tsx`**

Make three changes:

1. The `<h1>` "Kinetic": remove `font-bold`
   ```diff
   - <h1 className="text-2xl font-bold text-[var(--kinetic-dark)]">
   + <h1 className="text-2xl text-[var(--kinetic-dark)]">
   ```

2. The `<h2>` "Sign in to your account": remove `font-semibold`
   ```diff
   - <h2 className="text-lg font-semibold mb-4 text-[var(--kinetic-dark)]">
   + <h2 className="text-lg mb-4 text-[var(--kinetic-dark)]">
   ```

3. The login card `div`: remove border, add maroon top strip
   ```diff
   - <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
   + <div className="bg-white rounded-lg shadow-sm border-t-4 border-[var(--kinetic-maroon)] p-6">
   ```

4. The submit button: dark text, hover token
   ```diff
   - className="w-full py-2 px-4 bg-[var(--kinetic-gold)] text-white font-medium rounded-md text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
   + className="w-full py-2 px-4 bg-[var(--kinetic-gold)] text-[var(--kinetic-dark)] font-medium rounded-md text-sm hover:bg-[var(--kinetic-gold-hover)] transition-colors disabled:opacity-50"
   ```

- [ ] **Step 2: Update `app/(routes)/dashboard/page.tsx`**

Five changes:

1. Page h1 "Shared Patient History": remove `font-bold`
   ```diff
   - <h1 className="text-xl font-bold text-[var(--kinetic-dark)]">
   + <h1 className="text-xl text-[var(--kinetic-dark)]">
   ```

2. Section h2 "Your Access Level": remove `font-semibold`
   ```diff
   - <h2 className="text-sm font-semibold text-[var(--kinetic-dark)]">Your Access Level</h2>
   + <h2 className="text-sm text-[var(--kinetic-dark)]">Your Access Level</h2>
   ```

3. Section h2 "Clinics": remove `font-semibold`
   ```diff
   - <h2 className="text-sm font-semibold text-[var(--kinetic-dark)]">
   + <h2 className="text-sm text-[var(--kinetic-dark)]">
   ```
   (The "Clinics" heading is inside `<div className="px-4 py-3 border-b border-gray-200">`)

4. Section h2 "Patient Consent": same removal
   ```diff
   - <h2 className="text-sm font-semibold text-[var(--kinetic-dark)]">
   + <h2 className="text-sm text-[var(--kinetic-dark)]">
   ```
   (The "Patient Consent" heading, in the lower table)

5. Card containers — remove `border border-gray-200`, add `shadow-sm`, change `mb-6` to `mb-8` on section wrappers. There are three card containers:
   - Access progress card: `data-testid="access-progress-card"`
     ```diff
     - <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6" data-testid="access-progress-card">
     + <div className="bg-white rounded-lg shadow-sm p-4 mb-8" data-testid="access-progress-card">
     ```
   - Clinics table outer wrapper:
     ```diff
     - <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
     + <div className="bg-white rounded-lg shadow-sm overflow-hidden">
     ```
   - Patient consent table outer wrapper:
     ```diff
     - <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mt-6">
     + <div className="bg-white rounded-lg shadow-sm overflow-hidden mt-8">
     ```
   - Patient Visits section wrapper — increase spacing:
     ```diff
     - <div className="mb-6">
     + <div className="mb-8">
     ```
     (The `<div className="mb-6">` that wraps `<EpisodesSection>`)

- [ ] **Step 3: Update `app/(routes)/check-access/page.tsx`**

One change — remove `font-bold` from h1:

```diff
- <h1 className="text-2xl font-bold text-[var(--kinetic-dark)]">
+ <h1 className="text-2xl text-[var(--kinetic-dark)]">
```

- [ ] **Step 4: Update `app/(routes)/patient-dashboard/page.tsx`**

Four changes:

1. Patient name h1: remove `font-bold`, increase to `text-3xl`
   ```diff
   - <h1 className="text-2xl font-bold text-[var(--kinetic-dark)]">
   + <h1 className="text-3xl text-[var(--kinetic-dark)]">
   ```

2. Subtitle text: change copy
   ```diff
   - <p className="text-sm text-[var(--kinetic-gray)] mt-1">Your treatment history</p>
   + <p className="text-sm text-[var(--kinetic-gray)] mt-1">Your care journey</p>
   ```

3. "Present to Physio" button: dark text
   ```diff
   - className="px-4 py-2 text-sm font-medium text-white bg-[var(--kinetic-gold)] rounded-md hover:bg-[var(--kinetic-gold-hover)] transition-colors"
   + className="px-4 py-2 text-sm font-medium text-[var(--kinetic-dark)] bg-[var(--kinetic-gold)] rounded-md hover:bg-[var(--kinetic-gold-hover)] transition-colors"
   ```

4. Empty state card: warm background, remove border (no shadow — warm bg is sufficient)
   ```diff
   - <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
   + <div className="bg-[var(--kinetic-gold-light)] rounded-lg p-8 text-center">
   ```

- [ ] **Step 5: Update `app/(routes)/patient-dashboard/present/page.tsx`**

One change — remove `font-bold` from h1:

```diff
- <h1 className="text-2xl font-bold text-[var(--kinetic-dark)]">Present to Physio</h1>
+ <h1 className="text-2xl text-[var(--kinetic-dark)]">Present to Physio</h1>
```

- [ ] **Step 6: Run full test suite**

```bash
cd "d:/Vibe Coded Projects/Heidi Project" && npx jest --no-coverage 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
cd "d:/Vibe Coded Projects/Heidi Project" && git add "app/login/page.tsx" "app/(routes)/dashboard/page.tsx" "app/(routes)/check-access/page.tsx" "app/(routes)/patient-dashboard/page.tsx" "app/(routes)/patient-dashboard/present/page.tsx" && git commit -m "feat: apply Heidi styling to all pages"
```

---

## Chunk 4: Components

### Task 4: Update component styling

**Files:**
- Modify: `components/EpisodesSection.tsx`
- Modify: `components/CreateEpisodeForm.tsx`
- Modify: `components/AddUpdateForm.tsx`
- Modify: `components/PatientPresentForm.tsx`
- Modify: `components/CreatePatientForm.tsx`
- Modify: `components/PatientManagement.tsx`
- Modify: `components/SimulationPanel.tsx`

No new tests. `PatientSnapshot.tsx`, `ClinicOptInToggle.tsx`, and `ConsentToggle.tsx` require no changes — their gold accents update automatically via the CSS token.

- [ ] **Step 1: Update `components/EpisodesSection.tsx`**

Three changes:

1. h2 "Patient Visits" (line ~95): remove `font-semibold`
   ```diff
   - <h2 className="text-sm font-semibold text-[var(--kinetic-dark)]">
   + <h2 className="text-sm text-[var(--kinetic-dark)]">
   ```

2. Empty state div (line ~102): `border border-gray-200` → `shadow-sm`
   ```diff
   - <div className="bg-white rounded-lg border border-gray-200 px-4 py-6 text-center">
   + <div className="bg-white rounded-lg shadow-sm px-4 py-6 text-center">
   ```

3. Episode card div (line ~112): `border border-gray-200` → `shadow-sm`
   ```diff
   - className="bg-white rounded-lg border border-gray-200 p-4"
   + className="bg-white rounded-lg shadow-sm p-4"
   ```

4. Save/submit button inside edit form (line ~411 — search for `bg-[var(--kinetic-gold)] text-white text-xs rounded`): dark text
   ```diff
   - className="px-2 py-1 bg-[var(--kinetic-gold)] text-white text-xs rounded hover:opacity-90 disabled:opacity-50"
   + className="px-2 py-1 bg-[var(--kinetic-gold)] text-[var(--kinetic-dark)] text-xs rounded hover:bg-[var(--kinetic-gold-hover)] disabled:opacity-50"
   ```

- [ ] **Step 2: Update `components/CreateEpisodeForm.tsx`**

Three changes:

1. "Add Visit" trigger button (line ~62 — search for `bg-[var(--kinetic-gold)] text-white text-sm font-medium rounded-md` inside an `inline-flex`): dark text
   ```diff
   - className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--kinetic-gold)] text-white text-sm font-medium rounded-md hover:bg-[var(--kinetic-gold-hover)] transition-colors"
   + className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--kinetic-gold)] text-[var(--kinetic-dark)] text-sm font-medium rounded-md hover:bg-[var(--kinetic-gold-hover)] transition-colors"
   ```

2. Form card (line ~70): `border border-gray-200` → `shadow-sm`
   ```diff
   - <div className="bg-white rounded-lg border border-gray-200 p-4">
   + <div className="bg-white rounded-lg shadow-sm p-4">
   ```

3. Submit button inside form (line ~141 — search for `bg-[var(--kinetic-gold)] text-white text-sm font-medium rounded-md`): dark text
   ```diff
   - className="px-3 py-1.5 bg-[var(--kinetic-gold)] text-white text-sm font-medium rounded-md hover:bg-[var(--kinetic-gold-hover)] transition-colors disabled:opacity-50"
   + className="px-3 py-1.5 bg-[var(--kinetic-gold)] text-[var(--kinetic-dark)] text-sm font-medium rounded-md hover:bg-[var(--kinetic-gold-hover)] transition-colors disabled:opacity-50"
   ```

- [ ] **Step 3: Update `components/AddUpdateForm.tsx`**

One change — submit button (line ~361, search for `bg-[var(--kinetic-gold)] text-white text-xs font-medium`): dark text

```diff
- className="px-2 py-1 bg-[var(--kinetic-gold)] text-white text-xs font-medium rounded-md hover:bg-[var(--kinetic-gold-hover)] transition-colors disabled:opacity-50"
+ className="px-2 py-1 bg-[var(--kinetic-gold)] text-[var(--kinetic-dark)] text-xs font-medium rounded-md hover:bg-[var(--kinetic-gold-hover)] transition-colors disabled:opacity-50"
```

> The `bg-gray-50 border border-gray-200` panels inside AddUpdateForm (workflow selector and structured/QH form panels) are inner form sections, NOT card containers — leave them unchanged.

- [ ] **Step 4: Update `components/PatientPresentForm.tsx`**

Three changes:

1. Form wrapper (line ~79): `border border-gray-200` → `shadow-sm`
   ```diff
   - <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
   + <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6 space-y-4">
   ```

2. Divider label (search for `"Physiotherapist fills in below"`): `text-gray-500` → `text-[var(--kinetic-maroon)]`
   ```diff
   - <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
   + <p className="text-xs font-medium text-[var(--kinetic-maroon)] uppercase tracking-wide mb-3">
   ```

3. Submit button (line ~210): dark text
   ```diff
   - className="w-full px-4 py-2 text-sm font-medium text-white bg-[var(--kinetic-gold)] rounded-md hover:bg-[var(--kinetic-gold-hover)] disabled:opacity-50 transition-colors"
   + className="w-full px-4 py-2 text-sm font-medium text-[var(--kinetic-dark)] bg-[var(--kinetic-gold)] rounded-md hover:bg-[var(--kinetic-gold-hover)] disabled:opacity-50 transition-colors"
   ```

- [ ] **Step 5: Update `components/CreatePatientForm.tsx`**

Three changes:

1. "Add Patient" trigger button (line ~52): dark text, hover token
   ```diff
   - className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--kinetic-gold)] text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity"
   + className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--kinetic-gold)] text-[var(--kinetic-dark)] text-sm font-medium rounded-md hover:bg-[var(--kinetic-gold-hover)] transition-colors"
   ```

2. Form card (line ~60): `border border-gray-200` → `shadow-sm`
   ```diff
   - <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4" data-testid="create-patient-form">
   + <div className="bg-white rounded-lg shadow-sm p-4 mb-4" data-testid="create-patient-form">
   ```

3. Submit button (line ~129): dark text, hover token
   ```diff
   - className="px-3 py-1.5 bg-[var(--kinetic-gold)] text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
   + className="px-3 py-1.5 bg-[var(--kinetic-gold)] text-[var(--kinetic-dark)] text-sm font-medium rounded-md hover:bg-[var(--kinetic-gold-hover)] transition-colors disabled:opacity-50"
   ```

- [ ] **Step 6: Update `components/PatientManagement.tsx`**

One change — outer card (line ~57): `border border-gray-200` → `shadow-sm`

```diff
- <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mt-6" data-testid="patient-management">
+ <div className="bg-white rounded-lg shadow-sm overflow-hidden mt-6" data-testid="patient-management">
```

Also remove `font-semibold` from the h2 "Patient Management" (line ~59):
```diff
- <h2 className="text-sm font-semibold text-[var(--kinetic-dark)]">
+ <h2 className="text-sm text-[var(--kinetic-dark)]">
```

- [ ] **Step 7: Update `components/SimulationPanel.tsx`**

Five changes (search by the text content to locate each):

1. "Check Access Decision" card (search for `<div className="bg-white rounded-lg border border-gray-200 p-6">`  — first occurrence): border → shadow
   ```diff
   - <div className="bg-white rounded-lg border border-gray-200 p-6">
   + <div className="bg-white rounded-lg shadow-sm p-6">
   ```
   Apply this replacement to **all three** `bg-white rounded-lg border border-gray-200 p-6` occurrences in this file (Check Access Decision, Replay Timeline, Event Log panels).

2. h2 "Check Access Decision": remove `font-semibold`
   ```diff
   - <h2 className="text-lg font-semibold text-gray-900 mb-4">Check Access Decision</h2>
   + <h2 className="text-lg text-gray-900 mb-4">Check Access Decision</h2>
   ```

3. h2 "Replay Timeline": remove `font-semibold`
   ```diff
   - <h2 className="text-lg font-semibold text-gray-900 mb-4">Replay Timeline</h2>
   + <h2 className="text-lg text-gray-900 mb-4">Replay Timeline</h2>
   ```

4. h2 "Event Log": remove `font-semibold`
   ```diff
   - <h2 className="text-lg font-semibold text-gray-900">Event Log</h2>
   + <h2 className="text-lg text-gray-900">Event Log</h2>
   ```

5. "Check Access" submit button (search for `text-white bg-[var(--kinetic-gold)] rounded-md hover:bg-[var(--kinetic-gold-hover)]`): dark text
   ```diff
   - className="px-4 py-2 text-sm font-medium text-white bg-[var(--kinetic-gold)] rounded-md hover:bg-[var(--kinetic-gold-hover)] disabled:opacity-50 transition-colors"
   + className="px-4 py-2 text-sm font-medium text-[var(--kinetic-dark)] bg-[var(--kinetic-gold)] rounded-md hover:bg-[var(--kinetic-gold-hover)] disabled:opacity-50 transition-colors"
   ```

- [ ] **Step 8: Run full test suite**

```bash
cd "d:/Vibe Coded Projects/Heidi Project" && npx jest --no-coverage 2>&1 | tail -10
```

Expected: all tests pass (no behaviour was changed, only class names).

- [ ] **Step 9: Commit**

```bash
cd "d:/Vibe Coded Projects/Heidi Project" && git add components/EpisodesSection.tsx components/CreateEpisodeForm.tsx components/AddUpdateForm.tsx components/PatientPresentForm.tsx components/CreatePatientForm.tsx components/PatientManagement.tsx components/SimulationPanel.tsx && git commit -m "feat: apply Heidi styling to all components"
```
