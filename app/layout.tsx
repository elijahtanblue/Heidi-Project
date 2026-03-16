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
