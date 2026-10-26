import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { ActivityTracker } from "@/components/activity-tracker";
import { Suspense } from "react";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return (
    <AppShell userName={user.name}>
      <Suspense fallback={null}>
        <ActivityTracker />
      </Suspense>
      {children}
    </AppShell>
  );
}
