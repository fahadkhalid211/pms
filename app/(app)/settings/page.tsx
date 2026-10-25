"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Organization and property configuration.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Organization</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Organization-level settings, retention policies, and data management.</p>
          <button type="button" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Save organization settings</button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Property settings</CardTitle><CardDescription>Per-property timezone, currency, and policies.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Property-level settings are managed within the Properties module.</p>
        </CardContent>
      </Card>
    </div>
  );
}
