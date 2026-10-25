"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  Printer,
  ArrowLeft,
  CreditCard,
  RotateCcw,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitAmount: string | number;
  total: string | number;
}

interface Refund {
  id: string;
  amount: string | number;
  currency: string;
  status: string;
  reason?: string | null;
  approvedBy?: string | null;
  createdAt: string;
}

interface Payment {
  id: string;
  amount: string | number;
  currency: string;
  status: string;
  method?: string | null;
  providerRef?: string | null;
  createdAt: string;
  refunds?: Refund[];
}

interface InvoiceFolio {
  id: string;
  number: string;
  status: string;
  issueDate: string;
  dueDate?: string | null;
  currency: string;
  notes?: string | null;
  property: {
    name: string;
    currency: string;
    addressLine1?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  reservation?: {
    code: string;
    checkIn: string;
    checkOut: string;
    guest?: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string | null;
    } | null;
  } | null;
  lineItems: LineItem[];
  payments: Payment[];
  summary: {
    subtotal: string;
    discount: string;
    tax: string;
    total: string;
    totalCaptured: string;
    totalRefunded: string;
    netPaid: string;
    balanceDue: string;
    isFullyPaid: boolean;
  };
}

export default function InvoiceFolioPage() {
  const params = useParams();
  const invoiceId = params?.id as string;
  const { toast } = useToast();

  const [folio, setFolio] = React.useState<InvoiceFolio | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Quick Payment Modal
  const [payAmount, setPayAmount] = React.useState("");
  const [payMethod, setPayMethod] = React.useState("card");
  const [paying, setPaying] = React.useState(false);
  const [showPayModal, setShowPayModal] = React.useState(false);

  // Quick Refund Modal
  const [refundPaymentId, setRefundPaymentId] = React.useState<string | null>(null);
  const [refundAmount, setRefundAmount] = React.useState("");
  const [refundReason, setRefundReason] = React.useState("");
  const [refunding, setRefunding] = React.useState(false);

  const loadFolio = React.useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({ title: "Failed to load invoice", description: json.error?.message, variant: "destructive" });
        return;
      }
      setFolio(json.data);
      if (json.data?.summary?.balanceDue) {
        setPayAmount(json.data.summary.balanceDue);
      }
    } catch (e: any) {
      toast({ title: "Network error", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [invoiceId, toast]);

  React.useEffect(() => {
    void loadFolio();
  }, [loadFolio]);

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!folio) return;
    setPaying(true);
    try {
      const res = await fetch(`/api/invoices/${folio.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(payAmount),
          method: payMethod,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({ title: "Payment recording failed", description: json.error?.message, variant: "destructive" });
        return;
      }
      toast({ title: "Payment recorded", description: `$${parseFloat(payAmount).toFixed(2)} recorded successfully.` });
      setShowPayModal(false);
      await loadFolio();
    } finally {
      setPaying(false);
    }
  }

  async function handleRequestRefund(e: React.FormEvent) {
    e.preventDefault();
    if (!refundPaymentId) return;
    setRefunding(true);
    try {
      const res = await fetch(`/api/payments/${refundPaymentId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(refundAmount),
          reason: refundReason || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({ title: "Refund request failed", description: json.error?.message, variant: "destructive" });
        return;
      }
      toast({ title: "Refund requested", description: `Pending approval by manager ($${parseFloat(refundAmount).toFixed(2)}).` });
      setRefundPaymentId(null);
      await loadFolio();
    } finally {
      setRefunding(false);
    }
  }

  async function handleApproveRefund(refundId: string) {
    try {
      const res = await fetch(`/api/refunds/${refundId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({ title: "Refund approval failed", description: json.error?.message, variant: "destructive" });
        return;
      }
      toast({ title: "Refund approved", description: "Payment refunded and invoice reconciled." });
      await loadFolio();
    } catch (e: any) {
      toast({ title: "Approval error", description: e?.message, variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading invoice folio…</p>
      </div>
    );
  }

  if (!folio) {
    return (
      <div className="space-y-4">
        <Link href="/billing" className="inline-flex items-center text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Invoices
        </Link>
        <p className="text-sm text-destructive">Invoice not found or access denied.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      {/* Action Navigation Header - Hidden in Print */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <Link href="/billing" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Invoices
        </Link>
        <div className="flex items-center gap-2">
          {parseFloat(folio.summary.balanceDue) > 0 && (
            <Button size="sm" onClick={() => setShowPayModal(true)}>
              <CreditCard className="mr-1.5 h-4 w-4" /> Record Payment
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" /> Print Folio / Receipt
          </Button>
        </div>
      </div>

      {/* Printable Folio Card */}
      <Card className="border-border shadow-sm print:border-none print:shadow-none">
        <CardContent className="p-8 space-y-8">
          {/* Header & Property Info */}
          <div className="flex flex-col justify-between gap-4 border-b pb-6 sm:flex-row sm:items-start">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="h-6 w-6 text-primary" />
                <span className="text-xl font-bold tracking-tight">{folio.property.name}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {folio.property.addressLine1 && <div>{folio.property.addressLine1}</div>}
                {(folio.property.city || folio.property.state) && (
                  <div>{[folio.property.city, folio.property.state, folio.property.postalCode].filter(Boolean).join(", ")}</div>
                )}
                {folio.property.email && <div>{folio.property.email}</div>}
                {folio.property.phone && <div>{folio.property.phone}</div>}
              </div>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-2xl font-black tracking-tight text-foreground">GUEST FOLIO</div>
              <div className="font-mono text-sm font-semibold text-muted-foreground">{folio.number}</div>
              <div className="mt-2 flex items-center gap-2 sm:justify-end">
                <Badge
                  variant={
                    folio.status === "paid"
                      ? "default"
                      : folio.status === "partially_paid"
                      ? "secondary"
                      : folio.status === "overdue"
                      ? "destructive"
                      : "secondary"
                  }
                  className="capitalize"
                >
                  {folio.status.replace("_", " ")}
                </Badge>
              </div>
            </div>
          </div>

          {/* Guest & Reservation Details */}
          <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
            <div>
              <div className="font-semibold text-muted-foreground">BILLED TO</div>
              <div className="mt-1 font-medium text-foreground">
                {folio.reservation?.guest
                  ? `${folio.reservation.guest.firstName} ${folio.reservation.guest.lastName}`
                  : "Walk-in Guest"}
              </div>
              {folio.reservation?.guest?.email && <div className="text-muted-foreground">{folio.reservation.guest.email}</div>}
            </div>
            <div>
              <div className="font-semibold text-muted-foreground">RESERVATION</div>
              <div className="mt-1 font-mono font-medium text-primary">
                {folio.reservation?.code ?? "Non-Room Invoice"}
              </div>
              {folio.reservation?.checkIn && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {new Date(folio.reservation.checkIn).toLocaleDateString()} - {new Date(folio.reservation.checkOut).toLocaleDateString()}
                </div>
              )}
            </div>
            <div>
              <div className="font-semibold text-muted-foreground">ISSUE DATE</div>
              <div className="mt-1 font-medium">{new Date(folio.issueDate).toLocaleDateString()}</div>
              {folio.dueDate && (
                <div className="text-muted-foreground">Due: {new Date(folio.dueDate).toLocaleDateString()}</div>
              )}
            </div>
            <div>
              <div className="font-semibold text-muted-foreground">BALANCE DUE</div>
              <div className={`mt-1 font-mono text-base font-bold ${parseFloat(folio.summary.balanceDue) > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                ${folio.summary.balanceDue} {folio.currency}
              </div>
            </div>
          </div>

          {/* Itemized Line Items Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Charges & Line Items</h3>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 font-semibold text-muted-foreground">
                  <tr>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3 text-right">Unit Price</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {folio.lineItems.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/20">
                      <td className="p-3 font-medium text-foreground">{item.description}</td>
                      <td className="p-3 text-center text-muted-foreground">{item.quantity}</td>
                      <td className="p-3 text-right font-mono text-muted-foreground">${Number(item.unitAmount).toFixed(2)}</td>
                      <td className="p-3 text-right font-mono font-semibold text-foreground">${Number(item.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Calculation Breakdown */}
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-mono">${folio.summary.subtotal}</span>
              </div>
              {parseFloat(folio.summary.discount) > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span className="font-mono">-${folio.summary.discount}</span>
                </div>
              )}
              {parseFloat(folio.summary.tax) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Taxes & Fees</span>
                  <span className="font-mono">${folio.summary.tax}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 font-semibold text-foreground">
                <span>Invoice Total</span>
                <span className="font-mono font-bold">${folio.summary.total} {folio.currency}</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>Total Paid (Net)</span>
                <span className="font-mono">-${folio.summary.netPaid}</span>
              </div>
              <div className="flex justify-between border-t-2 border-primary/20 pt-2 text-sm font-black">
                <span>Balance Due</span>
                <span className={`font-mono ${parseFloat(folio.summary.balanceDue) > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  ${folio.summary.balanceDue} {folio.currency}
                </span>
              </div>
            </div>
          </div>

          {/* Payment History */}
          <div className="space-y-3 border-t pt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment & Refund History</h3>
            {folio.payments.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No payments recorded against this folio yet.</p>
            ) : (
              <div className="space-y-2">
                {folio.payments.map((p) => (
                  <div key={p.id} className="rounded-md border p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {p.status === "captured" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        )}
                        <div>
                          <span className="font-semibold capitalize text-foreground">{p.method ?? "Card"} Payment</span>
                          <span className="text-muted-foreground"> · {new Date(p.createdAt).toLocaleString()}</span>
                          {p.providerRef && <span className="font-mono text-[10px] text-muted-foreground"> ({p.providerRef})</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">${Number(p.amount).toFixed(2)}</span>
                        <Badge variant={p.status === "captured" ? "default" : "secondary"} className="text-[10px] capitalize">
                          {p.status.replace("_", " ")}
                        </Badge>
                        {p.status === "captured" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px] text-rose-600 print:hidden"
                            onClick={() => {
                              setRefundPaymentId(p.id);
                              setRefundAmount(Number(p.amount).toFixed(2));
                            }}
                          >
                            <RotateCcw className="mr-1 h-3 w-3" /> Refund
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Associated Refunds */}
                    {p.refunds && p.refunds.length > 0 && (
                      <div className="mt-2 space-y-1 rounded bg-muted/40 p-2 text-[11px]">
                        {p.refunds.map((r) => (
                          <div key={r.id} className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              ↳ Refund: ${Number(r.amount).toFixed(2)} ({r.reason ?? "Guest requested"}) - Status:{" "}
                              <strong className="capitalize">{r.status}</strong>
                            </span>
                            {r.status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-5 px-2 text-[10px] text-emerald-600 print:hidden"
                                onClick={() => void handleApproveRefund(r.id)}
                              >
                                Approve Refund
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Folio Footer */}
          <div className="border-t pt-4 text-center text-[10px] text-muted-foreground">
            Thank you for choosing {folio.property.name}. For questions concerning this folio, contact {folio.property.email || "frontdesk"}.
          </div>
        </CardContent>
      </Card>

      {/* Record Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold">Record Payment</h2>
              <p className="text-xs text-muted-foreground">Payment will be reconciled against folio {folio.number}.</p>
              <form onSubmit={handleRecordPayment} className="mt-4 space-y-4">
                <div>
                  <label className="text-xs font-medium">Payment Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={folio.summary.balanceDue}
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
                  />
                  <span className="text-[10px] text-muted-foreground">Outstanding balance: ${folio.summary.balanceDue}</span>
                </div>
                <div>
                  <label className="text-xs font-medium">Payment Method</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
                  >
                    <option value="card">Credit / Debit Card</option>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowPayModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={paying}>
                    {paying ? "Recording…" : "Confirm Payment"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Request Refund Modal */}
      {refundPaymentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold">Request Refund</h2>
              <p className="text-xs text-muted-foreground">Submits a refund request for manager approval.</p>
              <form onSubmit={handleRequestRefund} className="mt-4 space-y-4">
                <div>
                  <label className="text-xs font-medium">Refund Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Reason for Refund</label>
                  <input
                    type="text"
                    placeholder="e.g. Early checkout / satisfaction guarantee"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setRefundPaymentId(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" variant="destructive" disabled={refunding}>
                    {refunding ? "Submitting…" : "Request Refund"}
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
