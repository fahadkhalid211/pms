import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { ActivityTracker } from "@/components/activity-tracker";
import { prisma } from "@/lib/db";
import { Suspense } from "react";
import type { OrganizationBranding } from "@/lib/branding";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  let branding: OrganizationBranding | null = null;
  if (user.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        primaryColor: true,
        accentColor: true,
        branding: true,
      },
    });

    if (org) {
      branding = {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl,
        primaryColor: org.primaryColor || "#000000",
        accentColor: org.accentColor || "#ffffff",
        branding: (org.branding as any) || undefined,
      };
    }
  }

  return (
    <AppShell userName={user.name} initialBranding={branding}>
      <Suspense fallback={null}>
        <ActivityTracker />
      </Suspense>
      {children}
    </AppShell>
  );
}
