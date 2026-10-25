"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function StaffPage() {
  const [members, setMembers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    void (async () => {
      const res = await fetch("/api/staff");
      const json = await res.json();
      if (res.ok && json.success) setMembers(json.data);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Staff and permissions</h1>
        <p className="text-muted-foreground">Organization members and their roles.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Members</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : members.length === 0 ? <p className="text-sm text-muted-foreground">No members found.</p> : members.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="font-medium">{m.user?.name ?? m.user?.email}</div>
                <div className="text-sm text-muted-foreground">{m.user?.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{m.role?.name ?? m.roleKey ?? "member"}</Badge>
                <Badge variant={m.status === "active" ? "default" : "muted"}>{m.status}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
