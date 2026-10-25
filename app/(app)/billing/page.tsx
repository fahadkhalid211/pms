"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

interface Invoice {
  id: string;
  number: string;
  status: string;
  total: number;
  currency: string;
  reservation: { code: string } | null;
}

export default function BillingPage() {
  const { toast } = useToast();
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [markingPaid, setMarkingPaid] = React.useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/invoices");
    const json = await res.json();
    if (res.ok && json.success) setInvoices(json.data?.invoices ?? []);
    setLoading(false);
  }

  React.useEffect(() => { void load(); }, []);

  async function markPaid(invoice: Invoice) {
    setMarkingPaid(invoice.id);
    const res = await fetch(`/api/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid" }),
    });
    const json = await res.json();
    setMarkingPaid(null);
    if (!res.ok || !json.success) { toast({ title: "Failed", description: json.error?.message, variant: "destructive" }); return; }
    toast({ title: `Invoice ${invoice.number} marked as paid` });
    await load();
  }

  const openTotal = invoices.filter((i) => ["issued", "overdue"].includes(i.status)).reduce((a, i) => a + Number(i.total ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payments and invoices</h1>
        <p className="text-muted-foreground">Outstanding balances and payment status.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Open invoices</div><div className="text-2xl font-bold">{invoices.filter((i) => ["issued", "overdue"].includes(i.status)).length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Open balance</div><div className="text-2xl font-bold">${openTotal.toFixed(2)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Collected (captured)</div><div className="text-2xl font-bold">${invoices.filter((i) => i.status === "paid").reduce((a, i) => a + Number(i.total ?? 0), 0).toFixed(2)}</div></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Invoices</CardTitle><CardDescription>Recent invoices and balances.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : invoices.length === 0 ? <p className="text-sm text-muted-foreground">No invoices yet.</p> : invoices.map((i) => (
            <div key={i.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="font-medium">{i.number}</div>
                <div className="text-sm text-muted-foreground">{i.reservation?.code ?? "—"} · ${Number(i.total ?? 0).toFixed(2)}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={i.status === "paid" ? "default" : "secondary"}>{i.status}</Badge>
                {["issued", "overdue"].includes(i.status) && (
                  <Button size="sm" variant="outline" disabled={markingPaid === i.id} onClick={() => void markPaid(i)}>Mark paid</Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
