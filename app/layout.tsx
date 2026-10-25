import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Lumina PMS — AI-powered hospitality management",
    template: "%s | Lumina PMS",
  },
  description:
    "Lumina PMS is an AI-powered property management system for hotels, resorts, guesthouses, and serviced apartments.",
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
