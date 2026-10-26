"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  Activity,
  Search,
  RefreshCw,
  Laptop,
  Server,
  Filter,
  Eye,
  Calendar,
  User,
  Shield,
  Layers,
} from "lucide-react";

interface ActivityLogItem {
  id: string;
  timestamp: string;
  action: string;
  summary: string;
  source: "frontend" | "backend";
  category: string;
  user?: { id: string; name: string; email: string } | null;
  entityType?: string | null;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, any>;
}

export default function ActivityLogsPage() {
  const { toast } = useToast();
  const [logs, setLogs] = React.useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sourceFilter, setSourceFilter] = React.useState<string>("all");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Inspect modal
  const [selectedLog, setSelectedLog] = React.useState<ActivityLogItem | null>(null);

  const loadLogs = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/activity-logs?${params.toString()}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setLogs(json.data || []);
      } else {
        toast({
          title: "Failed to load logs",
          description: json.error?.message ?? "Could not query activity feed",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Network error",
        description: "Failed to communicate with activity logs API",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [sourceFilter, categoryFilter, searchQuery, toast]);

  React.useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Stats
  const frontendCount = logs.filter((l) => l.source === "frontend").length;
  const backendCount = logs.filter((l) => l.source === "backend").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit & Activity Logs</h1>
          <p className="text-sm text-muted-foreground">
            Complete real-time stream of all actions occurring across the frontend application and backend engine.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={loadLogs}
          disabled={loading}
          className="flex items-center gap-1.5"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Stream
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stream Events</CardTitle>
            <Activity className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs.length}</div>
            <p className="text-xs text-muted-foreground">Logged actions in current window</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Backend Operations</CardTitle>
            <Server className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{backendCount}</div>
            <p className="text-xs text-muted-foreground">API mutations, AI executions & database events</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Frontend Interactions</CardTitle>
            <Laptop className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{frontendCount}</div>
            <p className="text-xs text-muted-foreground">User navigation, clicks & modal actions</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search summaries, actions, or users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Source:</span>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                <option value="all">All Sources</option>
                <option value="frontend">Frontend (UI)</option>
                <option value="backend">Backend (Server)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                <option value="all">All Categories</option>
                <option value="navigation">Navigation</option>
                <option value="ui_action">UI Action</option>
                <option value="reservation">Reservations</option>
                <option value="billing">Billing & Payments</option>
                <option value="operations">Operations & Front Desk</option>
                <option value="housekeeping">Housekeeping</option>
                <option value="maintenance">Maintenance</option>
                <option value="ai">AI Hub</option>
                <option value="auth">Auth & Security</option>
                <option value="system">System</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Feed</CardTitle>
          <CardDescription>
            Chronological audit stream recording timestamp, user identity, and action summaries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading activity stream...</div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No activity logs found matching the filter criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Source & Category</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Summary</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => {
                    const isFrontend = log.source === "frontend";
                    return (
                      <tr key={log.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          <div>{new Date(log.timestamp).toLocaleTimeString()}</div>
                          <div>{new Date(log.timestamp).toLocaleDateString()}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="secondary"
                              className={`text-[10px] uppercase font-bold ${
                                isFrontend
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                              }`}
                            >
                              {log.source}
                            </Badge>
                            <span className="text-xs text-muted-foreground font-mono">
                              {log.category}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {log.user ? (
                            <div>
                              <div className="font-semibold text-foreground">{log.user.name}</div>
                              <div className="text-muted-foreground truncate max-w-[150px]">
                                {log.user.email}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground font-italic">System / Anon</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium max-w-md">
                          <div className="text-sm leading-snug">{log.summary}</div>
                          {log.entityType && log.entityId && (
                            <div className="text-xs text-muted-foreground font-mono mt-0.5">
                              {log.entityType}: {log.entityId}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                          {log.action}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                            className="h-8 text-xs flex items-center gap-1"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Button>
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

      {/* Inspect Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-lg border bg-background shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-bold">Activity Log Details</h2>
                <p className="text-xs text-muted-foreground font-mono">ID: {selectedLog.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="rounded border bg-muted/30 p-3 space-y-1">
                <div className="text-xs font-semibold text-muted-foreground uppercase">Summary</div>
                <div className="text-sm font-medium">{selectedLog.summary}</div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Timestamp:</span>
                  <div className="font-medium mt-0.5">{new Date(selectedLog.timestamp).toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Action:</span>
                  <div className="font-mono font-medium mt-0.5">{selectedLog.action}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Source & Category:</span>
                  <div className="font-medium mt-0.5">
                    {selectedLog.source.toUpperCase()} · {selectedLog.category}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">User:</span>
                  <div className="font-medium mt-0.5">
                    {selectedLog.user ? `${selectedLog.user.name} (${selectedLog.user.email})` : "System / Anonymous"}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Client IP Address:</span>
                  <div className="font-mono mt-0.5">{selectedLog.ipAddress || "Internal / Local"}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">User Agent:</span>
                  <div className="truncate mt-0.5" title={selectedLog.userAgent || ""}>
                    {selectedLog.userAgent || "Internal"}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground uppercase">Sanitized Metadata (JSON)</div>
                <pre className="rounded bg-slate-950 p-3 font-mono text-xs text-emerald-400 overflow-x-auto max-h-48 border">
                  {JSON.stringify(selectedLog.metadata ?? {}, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end border-t px-6 py-4">
              <Button variant="secondary" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
