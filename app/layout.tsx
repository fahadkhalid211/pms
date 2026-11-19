import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Pent House PMS",
    template: "%s | Pent House PMS",
  },
  description:
    "Pent House PMS is an institutional-grade, AI-powered property management system for luxury penthouses, long-let student accommodations, and premium serviced residences.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
