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
