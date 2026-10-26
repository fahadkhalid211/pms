"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  Mail,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  Ban,
  Calendar,
  Layers,
  Search,
  PlusCircle,
} from "lucide-react";

interface NotificationItem {
  id: string;
  propertyId?: string | null;
  guestId?: string | null;
  userId?: string | null;
  channel: string;
  type: string;
  status: "queued" | "processing" | "sent" | "failed" | "cancelled" | "suppressed";
  payload: any;
  toEmail?: string | null;
  toPhone?: string | null;
  subject?: string | null;
  runAt?: string | null;
  sentAt?: string | null;
  failedAt?: string | null;
  lastError?: string | null;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
}

interface DeliveryLogItem {
  id: string;
  notificationId: string;
  channel: string;
  status: "sent" | "failed";
  provider: string;
  providerRef?: string | null;
  providerMessageId?: string | null;
  error?: string | null;
  metadata?: any;
  timestamp: string;
}

export default function NotificationsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState<"queue" | "logs">("queue");
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [logs, setLogs] = React.useState<DeliveryLogItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  // Actions state
  const [processingQueue, setProcessingQueue] = React.useState(false);
  const [runningReminders, setRunningReminders] = React.useState(false);
  const [retryingId, setRetryingId] = React.useState<string | null>(null);

  // Preview Template Modal
  const [showPreviewModal, setShowPreviewModal] = React.useState(false);
  const [previewTemplateCode, setPreviewTemplateCode] = React.useState("pre_arrival");
  const [previewData, setPreviewData] = React.useState<{ subject: string; html: string; text: string } | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);

  // New Notification Modal
  const [showNewModal, setShowNewModal] = React.useState(false);
  const [newRecipient, setNewRecipient] = React.useState("");
  const [newTemplate, setNewTemplate] = React.useState("pre_arrival");
  const [newGuestName, setNewGuestName] = React.useState("Eleanor Vance");
  const [enqueuePending, setEnqueuePending] = React.useState(false);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [notifsRes, logsRes] = await Promise.all([
        fetch("/api/notifications"),
        fetch("/api/notifications/logs"),
      ]);

      const notifsJson = await notifsRes.json();
      const logsJson = await logsRes.json();

      if (notifsRes.ok && notifsJson.success) {
        setNotifications(notifsJson.data || []);
      }
      if (logsRes.ok && logsJson.success) {
        setLogs(logsJson.data || []);
      }
    } catch {
      toast({
        title: "Error loading notifications",
        description: "Failed to communicate with notifications API",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Load template preview
  const fetchTemplatePreview = React.useCallback(
    async (code: string) => {
      setPreviewLoading(true);
      try {
        const res = await fetch("/api/notifications/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateCode: code }),
        });
        const json = await res.json();
        if (res.ok && json.success) {
          setPreviewData(json.data);
        } else {
          toast({
            title: "Preview Error",
            description: json.error?.message ?? "Failed to compile template preview",
            variant: "destructive",
          });
        }
      } catch {
        toast({
          title: "Preview Error",
          description: "Network error while compiling template",
          variant: "destructive",
        });
      } finally {
        setPreviewLoading(false);
      }
    },
    [toast],
  );

  React.useEffect(() => {
    if (showPreviewModal) {
      fetchTemplatePreview(previewTemplateCode);
    }
  }, [showPreviewModal, previewTemplateCode, fetchTemplatePreview]);

  // Handlers
  const handleProcessQueue = async () => {
    setProcessingQueue(true);
    try {
      const res = await fetch("/api/notifications/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 20 }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast({
          title: "Queue Processed",
          description: `Processed: ${json.data.processed ?? 0}, Sent: ${json.data.succeeded ?? 0}, Failed: ${json.data.failed ?? 0}`,
        });
        await loadData();
      } else {
        toast({
          title: "Processing Failed",
          description: json.error?.message ?? "Queue worker returned an error",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Network Error",
        description: "Failed to execute queue processing worker",
        variant: "destructive",
      });
    } finally {
      setProcessingQueue(false);
    }
  };

  const handleRunReminders = async () => {
    setRunningReminders(true);
    try {
      const res = await fetch("/api/notifications/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "all" }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        const r = json.data;
        const total =
          (r.preArrival?.triggered || r.preArrival?.enqueuedCount || 0) +
          (r.checkIn?.triggered || r.checkIn?.enqueuedCount || 0) +
          (r.checkOut?.triggered || r.checkOut?.enqueuedCount || 0) +
          (r.payment?.triggered || r.payment?.enqueuedCount || 0);

        toast({
          title: "Automated Reminders Generated",
          description: `Created ${total} reminder notifications across pre-arrival, check-in, checkout, and payments.`,
        });
        await loadData();
      } else {
        toast({
          title: "Reminder Generation Failed",
          description: json.error?.message ?? "Unable to trigger reminder cycle",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Network Error",
        description: "Failed to run automated reminders",
        variant: "destructive",
      });
    } finally {
      setRunningReminders(false);
    }
  };

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    try {
      const res = await fetch(`/api/notifications/${id}/retry`, {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast({
          title: "Notification Re-queued",
          description: "Notification reset to queued and scheduled for immediate retry.",
        });
        await loadData();
      } else {
        toast({
          title: "Retry Failed",
          description: json.error?.message ?? "Could not re-queue notification",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Network Error",
        description: "Failed to trigger retry",
        variant: "destructive",
      });
    } finally {
      setRetryingId(null);
    }
  };

  const handleCreateNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipient) {
      toast({ title: "Recipient required", description: "Please enter an email address", variant: "destructive" });
      return;
    }

    setEnqueuePending(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "email",
          type: newTemplate,
          templateCode: newTemplate,
          toEmail: newRecipient,
          variables: {
            guestName: newGuestName,
            bookingCode: "RES-TEST" + Math.floor(Math.random() * 9000 + 1000),
            checkInDate: "2026-11-01",
            checkOutDate: "2026-11-05",
            roomType: "Executive King",
            roomNumber: "305",
            amountDue: "$350.00",
            amountPaid: "$350.00",
            invoiceNumber: "INV-2026-DEMO",
            dueDate: "2026-10-31",
          },
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast({
          title: "Notification Enqueued",
          description: "Notification successfully placed into transactional dispatch queue.",
        });
        setShowNewModal(false);
        setNewRecipient("");
        await loadData();
      } else {
        toast({
          title: "Enqueue Failed",
          description: json.error?.message ?? "Failed to enqueue notification",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Network Error",
        description: "Failed to communicate with API",
        variant: "destructive",
      });
    } finally {
      setEnqueuePending(false);
    }
  };

  // Stats calculation
  const queuedCount = notifications.filter((n) => n.status === "queued" || n.status === "processing").length;
  const sentCount = notifications.filter((n) => n.status === "sent").length;
  const failedCount = notifications.filter((n) => n.status === "failed").length;
  const suppressedCount = notifications.filter((n) => n.status === "suppressed" || n.status === "cancelled").length;

  // Filtered notifications
  const filteredNotifications = notifications.filter((n) => {
    if (statusFilter !== "all" && n.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const email = (n.toEmail || "").toLowerCase();
      const type = (n.type || "").toLowerCase();
      const subject = (n.subject || "").toLowerCase();
      return email.includes(q) || type.includes(q) || subject.includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header and Quick Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications & Messaging</h1>
          <p className="text-sm text-muted-foreground">
            Property-branded email dispatch, transactional queue management, and automated guest reminders.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowPreviewModal(true)}
            className="flex items-center gap-1.5"
          >
            <Eye className="h-4 w-4" />
            Preview Templates
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRunReminders}
            disabled={runningReminders}
            className="flex items-center gap-1.5"
          >
            <Calendar className={`h-4 w-4 ${runningReminders ? "animate-spin" : ""}`} />
            {runningReminders ? "Running..." : "Trigger Reminders"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleProcessQueue}
            disabled={processingQueue}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${processingQueue ? "animate-spin" : ""}`} />
            {processingQueue ? "Processing..." : "Process Queue"}
          </Button>
          <Button
            size="sm"
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5"
          >
            <PlusCircle className="h-4 w-4" />
            Enqueue Notification
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Queue</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queuedCount}</div>
            <p className="text-xs text-muted-foreground">Awaiting provider dispatch</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered (Sent)</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sentCount}</div>
            <p className="text-xs text-muted-foreground">Successfully transmitted</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Attempts</CardTitle>
            <AlertCircle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failedCount}</div>
            <p className="text-xs text-muted-foreground">Require retry or attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suppressed</CardTitle>
            <Ban className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suppressedCount}</div>
            <p className="text-xs text-muted-foreground">Guest opt-outs & preferences</p>
          </CardContent>
        </Card>
      </div>

      {/* Workspace Tabs & Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div className="flex gap-2">
          <Button
            variant={activeTab === "queue" ? "default" : "secondary"}
            size="sm"
            onClick={() => setActiveTab("queue")}
            className="flex items-center gap-1.5"
          >
            <Layers className="h-4 w-4" />
            Dispatch Queue ({notifications.length})
          </Button>
          <Button
            variant={activeTab === "logs" ? "default" : "secondary"}
            size="sm"
            onClick={() => setActiveTab("logs")}
            className="flex items-center gap-1.5"
          >
            <Mail className="h-4 w-4" />
            Delivery Logs ({logs.length})
          </Button>
        </div>

        {activeTab === "queue" && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search recipient or type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">All Statuses</option>
              <option value="queued">Queued</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="suppressed">Suppressed</option>
            </select>
          </div>
        )}
      </div>

      {/* Main View: Queue */}
      {activeTab === "queue" && (
        <Card>
          <CardHeader>
            <CardTitle>Transactional Queue</CardTitle>
            <CardDescription>
              All outbound messages scheduled and processed via exponential backoff.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">Loading queue entries...</div>
            ) : filteredNotifications.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No notifications found matching current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
                    <tr>
                      <th className="px-4 py-3">Recipient</th>
                      <th className="px-4 py-3">Type & Subject</th>
                      <th className="px-4 py-3">Channel</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Attempts</th>
                      <th className="px-4 py-3">Created / Scheduled</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredNotifications.map((notif) => {
                      const isFailed = notif.status === "failed";
                      const isSent = notif.status === "sent";

                      return (
                        <tr key={notif.id} className="hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-3 font-medium">
                            <div>{notif.toEmail || notif.toPhone || "In-App / System"}</div>
                            {notif.payload?.guestName && (
                              <div className="text-xs text-muted-foreground">
                                {notif.payload.guestName}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold">{notif.type}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-xs">
                              {notif.subject || notif.payload?.title || notif.payload?.bookingCode || "—"}
                            </div>
                            {notif.lastError && (
                              <div className="text-xs text-rose-500 truncate max-w-xs mt-0.5">
                                Error: {notif.lastError}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="uppercase text-[10px]">
                              {notif.channel}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={
                                isSent
                                  ? "default"
                                  : isFailed
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {notif.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {notif.attempts} / {notif.maxAttempts}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            <div>{new Date(notif.createdAt).toLocaleTimeString()}</div>
                            <div>{new Date(notif.createdAt).toLocaleDateString()}</div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isFailed && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleRetry(notif.id)}
                                disabled={retryingId === notif.id}
                                className="h-8 text-xs"
                              >
                                {retryingId === notif.id ? "Retrying..." : "Retry"}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main View: Delivery Logs */}
      {activeTab === "logs" && (
        <Card>
          <CardHeader>
            <CardTitle>Delivery Audit Logs</CardTitle>
            <CardDescription>
              Raw transmission verification records from provider adapters.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">Loading delivery logs...</div>
            ) : logs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No delivery logs recorded yet. Run &quot;Process Queue&quot; to trigger dispatch.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
                    <tr>
                      <th className="px-4 py-3">Log ID / Ref</th>
                      <th className="px-4 py-3">Provider</th>
                      <th className="px-4 py-3">Channel</th>
                      <th className="px-4 py-3">Result</th>
                      <th className="px-4 py-3">Message ID / Error</th>
                      <th className="px-4 py-3 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs">
                          {log.id.slice(0, 8)}...
                        </td>
                        <td className="px-4 py-3 font-semibold uppercase text-xs">
                          {log.provider}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="uppercase text-[10px]">
                            {log.channel}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={log.status === "sent" ? "default" : "destructive"}>
                            {log.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {log.status === "sent" ? (
                            <span className="font-mono text-muted-foreground">
                              {log.providerRef || log.providerMessageId || "OK"}
                            </span>
                          ) : (
                            <span className="text-rose-500 font-medium">
                              {log.error || "Delivery failure"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-bold">Property-Branded Template Preview</h2>
                <p className="text-xs text-muted-foreground">
                  Preview rendered HTML emails sent to guests with dynamic property headers & styles.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium">Select Template:</label>
                <select
                  value={previewTemplateCode}
                  onChange={(e) => setPreviewTemplateCode(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm"
                >
                  <option value="pre_arrival">Pre-Arrival Confirmation</option>
                  <option value="check_in_welcome">Check-in Welcome & Wi-Fi</option>
                  <option value="check_out_thanks">Post-Checkout Thank You</option>
                  <option value="payment_receipt">Payment Receipt</option>
                  <option value="payment_reminder">Payment Due Reminder</option>
                </select>
              </div>

              {previewLoading ? (
                <div className="py-20 text-center text-muted-foreground">Compiling template...</div>
              ) : previewData ? (
                <div className="space-y-3">
                  <div className="rounded border bg-muted/40 p-3 text-sm">
                    <strong>Subject Line:</strong> {previewData.subject}
                  </div>
                  <div className="rounded border bg-white p-2 text-foreground">
                    <iframe
                      title="Email Preview"
                      srcDoc={previewData.html}
                      className="w-full h-[400px] border-0 rounded"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex justify-end border-t px-6 py-4">
              <Button variant="secondary" onClick={() => setShowPreviewModal(false)}>
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Enqueue Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border bg-background shadow-xl">
            <form onSubmit={handleCreateNotification}>
              <div className="flex items-center justify-between border-b px-6 py-4">
                <h2 className="text-lg font-bold">Enqueue Manual Notification</h2>
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Recipient Email</label>
                  <Input
                    type="email"
                    required
                    placeholder="guest@example.com"
                    value={newRecipient}
                    onChange={(e) => setNewRecipient(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Guest Name</label>
                  <Input
                    type="text"
                    required
                    placeholder="Eleanor Vance"
                    value={newGuestName}
                    onChange={(e) => setNewGuestName(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Template</label>
                  <select
                    value={newTemplate}
                    onChange={(e) => setNewTemplate(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                  >
                    <option value="pre_arrival">Pre-Arrival Confirmation</option>
                    <option value="check_in_welcome">Check-in Welcome</option>
                    <option value="check_out_thanks">Post-Checkout Thank You</option>
                    <option value="payment_receipt">Payment Receipt</option>
                    <option value="payment_reminder">Payment Reminder</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t px-6 py-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowNewModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={enqueuePending}>
                  {enqueuePending ? "Enqueueing..." : "Enqueue Notification"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
