"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sliders,
  Send,
  RefreshCw,
  Clock,
  ShieldCheck,
  ChevronRight,
  User,
  Bot,
} from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string | null;
  toolCalls?: Array<{ name: string; arguments: any }>;
  approvalId?: string;
}

interface ApprovalItem {
  id: string;
  toolName: string;
  summary: string;
  status: string;
  createdAt: string;
  execution?: {
    id: string;
    requestSummary: string;
  };
}

interface ExecutionItem {
  id: string;
  status: string;
  requestSummary: string;
  finalSummary: string | null;
  error: string | null;
  createdAt: string;
  toolExecutions?: Array<{
    id: string;
    toolName: string;
    status: string;
  }>;
}

export default function AiOperationsPage() {
  const { toast } = useToast();
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hello. I am your autonomous PMS operations co-pilot. I can check live room availability, retrieve guest records, draft guest communications, inspect invoices, and manage room status. Sensitive tasks (like cancellations and refunds) are automatically routed for supervisory review.",
    },
  ]);
  const [input, setInput] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [executions, setExecutions] = React.useState<ExecutionItem[]>([]);
  const [approvals, setApprovals] = React.useState<ApprovalItem[]>([]);
  const [rejectReason, setRejectReason] = React.useState("");
  const [activeApprovalId, setActiveApprovalId] = React.useState<string | null>(null);

  const fetchDashboardData = React.useCallback(async () => {
    try {
      const [execRes, apprRes] = await Promise.all([
        fetch("/api/ai/executions"),
        fetch("/api/ai/approvals?status=pending"),
      ]);

      if (execRes.ok) {
        const execJson = await execRes.json();
        if (execJson.success) setExecutions(execJson.data);
      }

      if (apprRes.ok) {
        const apprJson = await apprRes.json();
        if (apprJson.success) setApprovals(apprJson.data);
      }
    } catch {
      // Ignore background refresh errors
    }
  }, []);

  React.useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  async function send(customPrompt?: string) {
    const message = (customPrompt ?? input).trim();
    if (!message || pending) return;

    if (!customPrompt) setInput("");
    setPending(true);
    setMessages((prev) => [...prev, { role: "user", content: message }]);

    try {
      const res = await fetch("/api/ai/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${json.error?.message ?? "Execution failed"}` },
        ]);
        toast({ title: "Operation failed", description: json.error?.message, variant: "destructive" });
        setPending(false);
        return;
      }

      const outcome = json.data;
      if (outcome.status === "awaiting_approval") {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `This action requires managerial approval before execution. Request #${outcome.approvalId.slice(0, 8)} has been queued.`,
            approvalId: outcome.approvalId,
          },
        ]);
        toast({ title: "Approval required", description: "Sensitive action placed in supervisor review queue." });
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: outcome.finalContent ?? (outcome.error ? `Error: ${outcome.error}` : "Operation completed successfully."),
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Network error: ${err.message}` }]);
    } finally {
      setPending(false);
      await fetchDashboardData();
    }
  }

  async function resolveApproval(approvalId: string, action: "approve" | "reject") {
    try {
      const res = await fetch(`/api/ai/approvals/${approvalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: rejectReason || undefined }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({ title: "Resolution failed", description: json.error?.message, variant: "destructive" });
        return;
      }

      toast({
        title: action === "approve" ? "Action executed" : "Action rejected",
        description: action === "approve" ? "Approved action executed against PMS core." : "Request marked as rejected.",
      });

      setActiveApprovalId(null);
      setRejectReason("");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            action === "approve"
              ? `Approved action #${approvalId.slice(0, 8)} executed successfully: ${json.data.result}`
              : `Approval request #${approvalId.slice(0, 8)} was rejected.`,
        },
      ]);

      await fetchDashboardData();
    } catch (err: any) {
      toast({ title: "Network error", description: err.message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Operations Hub</h1>
            <Badge variant="outline" className="border-violet-500/30 bg-violet-500/10 text-violet-400">
              <Sparkles className="mr-1 h-3 w-3" /> Autonomous PMS
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Execute permission-controlled operational workflows with supervised supervisor approvals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void fetchDashboardData()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Link href="/ai/providers">
            <Button variant="outline" size="sm">
              <Sliders className="mr-2 h-4 w-4" /> AI Providers
            </Button>
          </Link>
        </div>
      </div>

      {/* Pending Approvals Banner */}
      {approvals.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="h-5 w-5" />
                <CardTitle className="text-base text-amber-300">
                  Pending Supervisor Approvals ({approvals.length})
                </CardTitle>
              </div>
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400">
                Action Required
              </Badge>
            </div>
            <CardDescription className="text-amber-200/70">
              The AI agent paused execution on high-risk operations awaiting manager verification.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {approvals.map((appr) => (
              <div
                key={appr.id}
                className="flex flex-col gap-3 rounded-lg border border-amber-500/20 bg-background/50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {appr.toolName}
                    </Badge>
                    <span className="text-xs text-muted-foreground">ID: #{appr.id.slice(0, 8)}</span>
                  </div>
                  <p className="text-sm text-foreground">{appr.summary}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => void resolveApproval(appr.id, "approve")}
                  >
                    <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                    onClick={() => {
                      if (activeApprovalId === appr.id) {
                        void resolveApproval(appr.id, "reject");
                      } else {
                        setActiveApprovalId(appr.id);
                      }
                    }}
                  >
                    <XCircle className="mr-1.5 h-4 w-4" /> {activeApprovalId === appr.id ? "Confirm Reject" : "Reject"}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Main Grid: Interactive Chat Console & Activity Feed */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chat Console */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Operations Console</CardTitle>
                <CardDescription>Direct conversational dispatch with strict RBAC enforcement</CardDescription>
              </div>
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                <ShieldCheck className="mr-1 h-3 w-3" /> Zero IDOR Scope
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quick Action Chips */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void send("Check room availability for the next 3 days")}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition hover:border-violet-500 hover:text-foreground"
              >
                <Clock className="h-3 w-3 text-violet-400" /> Availability Check
              </button>
              <button
                type="button"
                onClick={() => void send("Search for reservations under the name Smith")}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition hover:border-violet-500 hover:text-foreground"
              >
                <User className="h-3 w-3 text-violet-400" /> Search Reservations
              </button>
              <button
                type="button"
                onClick={() => void send("Generate an operational summary report with ADR and RevPAR")}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition hover:border-violet-500 hover:text-foreground"
              >
                <Sparkles className="h-3 w-3 text-violet-400" /> Operational Report
              </button>
              <button
                type="button"
                onClick={() => void send("List outstanding invoices and payment totals")}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition hover:border-violet-500 hover:text-foreground"
              >
                <CheckCircle2 className="h-3 w-3 text-violet-400" /> Invoices Summary
              </button>
            </div>

            {/* Conversation Log */}
            <div className="max-h-[480px] min-h-[300px] space-y-3 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-4">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 rounded-lg p-3 text-sm ${
                    m.role === "user"
                      ? "ml-8 border border-violet-500/20 bg-violet-500/10 text-foreground"
                      : "mr-8 border border-border bg-card text-foreground"
                  }`}
                >
                  <div className="shrink-0">
                    {m.role === "user" ? (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-white">
                        <User className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-violet-400">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{m.role === "user" ? "You" : "Lumina Agent"}</span>
                      {m.approvalId && (
                        <Badge variant="outline" className="border-amber-500/30 text-amber-400">
                          Awaiting Approval
                        </Badge>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                  </div>
                </div>
              ))}
              {pending && (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin text-violet-400" />
                  <span>Agent analyzing request and coordinating tools...</span>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="Ask Lumina Agent (e.g. 'Check availability for tomorrow', 'Clean room 102', 'Cancel reservation RES-123')..."
                className="min-h-[64px]"
              />
              <Button
                onClick={() => void send()}
                disabled={pending || !input.trim()}
                className="h-auto bg-violet-600 px-6 hover:bg-violet-700"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Executions Stream */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Audit & Activity Log</CardTitle>
              <Link href="/activity-logs" className="text-xs text-violet-400 hover:underline">
                View All
              </Link>
            </div>
            <CardDescription className="text-xs">Recent agent invocations and tool triggers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {executions.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">No recent executions recorded.</p>
            ) : (
              executions.slice(0, 8).map((ex) => (
                <div key={ex.id} className="rounded-lg border border-border/60 bg-card p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-muted-foreground">#{ex.id.slice(0, 8)}</span>
                    <Badge
                      variant={
                        ex.status === "completed"
                          ? "default"
                          : ex.status === "failed"
                          ? "destructive"
                          : ex.status === "awaiting_approval"
                          ? "outline"
                          : "secondary"
                      }
                      className={
                        ex.status === "completed"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : ex.status === "awaiting_approval"
                          ? "border-amber-500/30 text-amber-400 bg-amber-500/10"
                          : undefined
                      }
                    >
                      {ex.status}
                    </Badge>
                  </div>
                  <div className="font-medium text-foreground line-clamp-1">{ex.requestSummary}</div>
                  {ex.finalSummary && (
                    <div className="text-muted-foreground line-clamp-2">{ex.finalSummary}</div>
                  )}
                  {ex.error && <div className="text-rose-400 line-clamp-2">{ex.error}</div>}
                  <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                    <span>{new Date(ex.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    {ex.toolExecutions && ex.toolExecutions.length > 0 && (
                      <span className="font-mono">{ex.toolExecutions.length} tool(s) run</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
