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

            {/* Nav Links — patient only */}
            {isPatient && (
              <nav className="flex items-center gap-1">
                <Link
                  href="/patient-dashboard"
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    pathname === "/patient-dashboard"
                      ? "text-[var(--kinetic-maroon)] bg-[var(--kinetic-maroon)]/10"
                      : "text-[var(--kinetic-maroon)]/60 hover:text-[var(--kinetic-maroon)]"
                  }`}
                >
                  My Dashboard
                </Link>
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
