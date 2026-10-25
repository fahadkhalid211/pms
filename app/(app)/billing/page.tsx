"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  CreditCard,
  FileText,
  PlusCircle,
  Search,
} from "lucide-react";

interface Payment {
  id: string;
  amount: string | number;
  status: string;
  method?: string | null;
}

interface Invoice {
  id: string;
  number: string;
  status: string;
  subtotal: string | number;
  tax: string | number;
  total: string | number;
  currency: string;
  issueDate: string;
  dueDate?: string | null;
  reservation?: { code: string } | null;
  property?: { name: string; currency: string } | null;
  payments?: Payment[];
}

interface ReservationOption {
  id: string;
  code: string;
  totalAmount: string | number;
  guest?: { firstName: string; lastName: string } | null;
}

export default function BillingPage() {
  const { toast } = useToast();
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Record Payment Modal
  const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState("card");
  const [paymentPending, setPaymentPending] = React.useState(false);

  // Generate Invoice Modal
  const [showGenerateModal, setShowGenerateModal] = React.useState(false);
  const [reservations, setReservations] = React.useState<ReservationOption[]>([]);
  const [selectedResId, setSelectedResId] = React.useState("");
  const [generatePending, setGeneratePending] = React.useState(false);

  const loadInvoices = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/invoices");
      const json = await res.json();
      if (res.ok && json.success) {
        const list = Array.isArray(json.data) ? json.data : json.data?.invoices ?? [];
        setInvoices(list);
      }
    } catch (e: any) {
      toast({ title: "Failed to load invoices", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  async function openGenerateModal() {
    setShowGenerateModal(true);
    try {
      const res = await fetch("/api/reservations?limit=50");
      const json = await res.json();
      if (res.ok && json.success) {
        const list = Array.isArray(json.data) ? json.data : json.data?.reservations ?? [];
        setReservations(list);
        if (list.length > 0) setSelectedResId(list[0].id);
      }
    } catch {
      // ignore
    }
  }

  async function handleGenerateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedResId) return;
    setGeneratePending(true);
    try {
      const res = await fetch("/api/invoices/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId: selectedResId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({ title: "Generation failed", description: json.error?.message, variant: "destructive" });
        return;
      }
      toast({ title: "Invoice generated", description: `Folio ${json.data.number} created from reservation.` });
      setShowGenerateModal(false);
      await loadInvoices();
    } finally {
      setGeneratePending(false);
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInvoice) return;
    setPaymentPending(true);
    try {
      const res = await fetch(`/api/invoices/${selectedInvoice.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(paymentAmount),
          method: paymentMethod,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({ title: "Payment recording failed", description: json.error?.message, variant: "destructive" });
        return;
      }
      toast({
        title: "Payment reconciled",
        description: `Recorded $${parseFloat(paymentAmount).toFixed(2)}. Folio status: ${json.data.invoice.status}.`,
      });
      setSelectedInvoice(null);
      await loadInvoices();
    } finally {
      setPaymentPending(false);
    }
  }

  // Calculate metrics
  const totalInvoiced = invoices
    .filter((i) => i.status !== "void")
    .reduce((acc, i) => acc + Number(i.total ?? 0), 0);

  const openInvoices = invoices.filter((i) => ["issued", "overdue", "partially_paid"].includes(i.status));
  const openBalance = openInvoices.reduce((acc, i) => {
    const paid = (i.payments ?? [])
      .filter((p) => p.status === "captured")
      .reduce((s, p) => s + Number(p.amount ?? 0), 0);
    return acc + Math.max(0, Number(i.total ?? 0) - paid);
  }, 0);

  const collectedTotal = invoices.reduce((acc, i) => {
    const paid = (i.payments ?? [])
      .filter((p) => p.status === "captured")
      .reduce((s, p) => s + Number(p.amount ?? 0), 0);
    return acc + paid;
  }, 0);

  // Filtered list
  const filtered = invoices.filter((i) => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const numMatch = i.number.toLowerCase().includes(q);
      const codeMatch = i.reservation?.code.toLowerCase().includes(q);
      if (!numMatch && !codeMatch) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing & Invoices</h1>
          <p className="text-muted-foreground">Server-calculated folios, payments, deposits, and refunds.</p>
        </div>
        <Button onClick={openGenerateModal}>
          <PlusCircle className="mr-1.5 h-4 w-4" /> Generate from Reservation
        </Button>
      </div>

      {/* Financial KPIs */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-muted-foreground">Open Balance</div>
            <div className="text-2xl font-bold text-rose-600">${openBalance.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">{openInvoices.length} unpaid / partial folios</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-muted-foreground">Collected Revenue</div>
            <div className="text-2xl font-bold text-emerald-600">${collectedTotal.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Reconciled payments</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-muted-foreground">Total Invoiced</div>
            <div className="text-2xl font-bold">${totalInvoiced.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">{invoices.filter((i) => i.status !== "void").length} active folios</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-muted-foreground">Overdue Folios</div>
            <div className="text-2xl font-bold text-amber-600">
              {invoices.filter((i) => i.status === "overdue").length}
            </div>
            <div className="text-xs text-muted-foreground">Passed due date</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Folio Table Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <CardTitle>Invoices & Guest Folios</CardTitle>
              <CardDescription>Server-side financial precision with line-item auditing.</CardDescription>
            </div>
            {/* Search & Status Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search number or booking..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-md border bg-background pl-8 pr-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-md border bg-background px-3 py-1.5 text-xs shadow-sm focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="issued">Issued</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="refunded">Refunded</option>
                <option value="void">Void</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading invoices…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices matching current filter.</p>
          ) : (
            <div className="divide-y rounded-md border">
              {filtered.map((inv) => {
                const paid = (inv.payments ?? [])
                  .filter((p) => p.status === "captured")
                  .reduce((s, p) => s + Number(p.amount ?? 0), 0);
                const remaining = Math.max(0, Number(inv.total ?? 0) - paid);

                return (
                  <div key={inv.id} className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">{inv.number}</span>
                        <Badge
                          variant={
                            inv.status === "paid"
                              ? "default"
                              : inv.status === "partially_paid"
                              ? "secondary"
                              : inv.status === "overdue"
                              ? "destructive"
                              : "secondary"
                          }
                          className="capitalize text-[10px]"
                        >
                          {inv.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Reservation: <span className="font-mono text-primary">{inv.reservation?.code ?? "—"}</span> · Total:{" "}
                        <strong>${Number(inv.total ?? 0).toFixed(2)}</strong>
                        {paid > 0 && <span className="text-emerald-600"> · Paid: ${paid.toFixed(2)}</span>}
                        {remaining > 0 && <span className="text-rose-600"> · Balance Due: ${remaining.toFixed(2)}</span>}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Issued: {new Date(inv.issueDate).toLocaleDateString()}
                        {inv.dueDate && ` · Due: ${new Date(inv.dueDate).toLocaleDateString()}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {remaining > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setPaymentAmount(remaining.toFixed(2));
                          }}
                        >
                          <CreditCard className="mr-1.5 h-3.5 w-3.5" /> Record Payment
                        </Button>
                      )}
                      <Link href={`/billing/${inv.id}`}>
                        <Button size="sm" variant="ghost">
                          <FileText className="mr-1.5 h-3.5 w-3.5" /> View Folio
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record Payment Dialog */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold">Record Reconciled Payment</h2>
              <p className="text-xs text-muted-foreground">
                Recording payment against {selectedInvoice.number}. Amount reconciles automatically.
              </p>
              <form onSubmit={handleRecordPayment} className="mt-4 space-y-4">
                <div>
                  <label className="text-xs font-medium">Payment Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
                  >
                    <option value="card">Credit / Debit Card</option>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setSelectedInvoice(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={paymentPending}>
                    {paymentPending ? "Recording…" : "Save Payment"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Generate From Reservation Dialog */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold">Generate Invoice from Reservation</h2>
              <p className="text-xs text-muted-foreground">
                Computes server-side line items for room nights, taxes, fees, and discounts.
              </p>
              <form onSubmit={handleGenerateSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="text-xs font-medium">Select Reservation</label>
                  {reservations.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">No active reservations found.</p>
                  ) : (
                    <select
                      value={selectedResId}
                      onChange={(e) => setSelectedResId(e.target.value)}
                      className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
                    >
                      {reservations.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.code} - {r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : "Guest"} (${Number(r.totalAmount).toFixed(2)})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowGenerateModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={generatePending || !selectedResId}>
                    {generatePending ? "Generating…" : "Generate Folio"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
