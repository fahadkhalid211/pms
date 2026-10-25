"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Integration {
  id: string;
  provider: string;
  name: string;
  status: string;
  lastSyncAt: string | null;
  lastError: string | null;
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = React.useState<Integration[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    void (async () => {
      const res = await fetch("/api/integrations");
      const json = await res.json();
      if (res.ok && json.success) setIntegrations(json.data);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground">External booking channels, payments, and webhooks.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Connected integrations</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : integrations.length === 0 ? <p className="text-sm text-muted-foreground">No integrations configured yet.</p> : integrations.map((i) => (
            <div key={i.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="font-medium">{i.name}</div>
                <div className="text-sm text-muted-foreground">{i.provider}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={i.status === "active" ? "default" : "secondary"}>{i.status}</Badge>
                {i.lastSyncAt ? <span className="text-xs text-muted-foreground">Last sync {new Date(i.lastSyncAt).toDateString()}</span> : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
