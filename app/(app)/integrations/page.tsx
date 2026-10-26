"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  Blocks,
  Calendar,
  CreditCard,
  MessageSquare,
  FileSpreadsheet,
  Zap,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Plus,
  RefreshCw,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Activity,
  Layers,
} from "lucide-react";

interface IntegrationItem {
  id: string;
  provider: string;
  name: string;
  status: string;
  lastSyncAt: string | null;
  lastError: string | null;
  property?: { id: string; name: string } | null;
}

interface WebhookItem {
  id: string;
  eventType: string;
  status: string;
  externalId: string | null;
  error: string | null;
  createdAt: string;
}

interface CatalogueItem {
  provider: string;
  name: string;
  category: string;
  description: string;
  supportsWebhooks: boolean;
  supportsIcal: boolean;
  isStubbed: boolean;
}

export default function IntegrationsPage() {
  const { toast } = useToast();
  const [integrations, setIntegrations] = React.useState<IntegrationItem[]>([]);
  const [recentWebhooks, setRecentWebhooks] = React.useState<WebhookItem[]>([]);
  const [catalogue, setCatalogue] = React.useState<CatalogueItem[]>([]);
  const [properties, setProperties] = React.useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = React.useState(true);

  // Configure Dialog State
  const [configureOpen, setConfigureOpen] = React.useState(false);
  const [selectedProvider, setSelectedProvider] = React.useState<CatalogueItem | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = React.useState("");
  const [apiKeyInput, setApiKeyInput] = React.useState("");
  const [apiSecretInput, setApiSecretInput] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  // iCal Copy state
  const [copiedPropId, setCopiedPropId] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations");
      const json = await res.json();
      if (res.ok && json.success) {
        setIntegrations(json.data.integrations || []);
        setRecentWebhooks(json.data.recentWebhooks || []);
        setCatalogue(json.data.supportedCatalogue || []);
        setProperties(json.data.properties || []);
      } else {
        toast({ title: "Failed to load integrations", description: json.error?.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Could not fetch integrations.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProvider) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider.provider,
          name: selectedProvider.name,
          propertyId: selectedPropertyId || undefined,
          credentials: {
            apiKey: apiKeyInput,
            apiSecret: apiSecretInput,
          },
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast({ title: "Integration saved", description: `${selectedProvider.name} is now securely configured.` });
        setConfigureOpen(false);
        setApiKeyInput("");
        setApiSecretInput("");
        void loadData();
      } else {
        toast({ title: "Configuration failed", description: json.error?.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Could not save integration.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisconnect(id: string, name: string) {
    if (!window.confirm(`Disconnect and remove ${name}?`)) return;
    try {
      const res = await fetch(`/api/integrations?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (res.ok && json.success) {
        toast({ title: "Integration removed", description: `${name} has been disconnected.` });
        setIntegrations((prev) => prev.filter((i) => i.id !== id));
      } else {
        toast({ title: "Failed to disconnect", description: json.error?.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Could not disconnect integration.", variant: "destructive" });
    }
  }

  function getCategoryIcon(cat: string) {
    switch (cat) {
      case "payments":
        return <CreditCard className="h-4 w-4 text-emerald-600" />;
      case "ota":
        return <Calendar className="h-4 w-4 text-primary" />;
      case "messaging":
        return <MessageSquare className="h-4 w-4 text-sky-600" />;
      case "accounting":
        return <FileSpreadsheet className="h-4 w-4 text-amber-600" />;
      default:
        return <Zap className="h-4 w-4 text-violet-600" />;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Integrations & External Channels</h1>
          <p className="text-sm text-muted-foreground">
            Manage OTA calendar syncs, payment gateways, and incoming webhooks.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Status
        </Button>
      </div>

      {/* iCal Feeds Card */}
      <Card className="border border-border/80">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Live iCal Calendar Export Feeds (RFC 5545)
          </CardTitle>
          <CardDescription className="text-xs">
            Subscribe your Airbnb, VRBO, or Apple Calendar to these live feeds to automatically block booked dates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {properties.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No active properties available.</p>
          ) : (
            properties.map((prop) => {
              const feedUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/api/integrations/ical/${prop.id}`;
              const isCopied = copiedPropId === prop.id;
              return (
                <div
                  key={prop.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3 gap-3"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-xs text-foreground">{prop.name}</span>
                    <div className="font-mono text-[11px] text-muted-foreground break-all">{feedUrl}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(feedUrl);
                      setCopiedPropId(prop.id);
                      setTimeout(() => setCopiedPropId(null), 2000);
                    }}
                  >
                    {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    {isCopied ? "Copied" : "Copy URL"}
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Active Integrations Grid */}
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          Active Channels & Connected Integrations
        </div>

        {integrations.length === 0 ? (
          <Card className="border border-border/80 border-dashed bg-muted/10">
            <CardContent className="py-8 text-center text-xs text-muted-foreground">
              No active integrations connected yet. Select a provider below to connect.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {integrations.map((item) => (
              <Card key={item.id} className="border border-border/80">
                <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Blocks className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">{item.name}</CardTitle>
                      <span className="font-mono text-[10px] text-muted-foreground">{item.provider}</span>
                    </div>
                  </div>
                  <Badge variant={item.status === "connected" ? "default" : "secondary"} className="capitalize text-[10px]">
                    {item.status}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="text-muted-foreground flex items-center justify-between">
                    <span>Property:</span>
                    <span className="font-medium text-foreground">{item.property?.name || "All Properties"}</span>
                  </div>
                  {item.lastSyncAt && (
                    <div className="text-muted-foreground flex items-center justify-between">
                      <span>Last Sync:</span>
                      <span>{new Date(item.lastSyncAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="pt-2 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDisconnect(item.id, item.name)}
                      className="text-destructive text-xs hover:bg-destructive/10 h-7 gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Disconnect
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Integration Catalogue */}
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Blocks className="h-4 w-4 text-primary" />
          Channel & Services Directory
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {catalogue.map((cat) => {
            const isConnected = integrations.some((i) => i.provider === cat.provider && i.status === "connected");
            return (
              <Card key={cat.provider} className="border border-border/80 flex flex-col justify-between">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(cat.category)}
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {cat.category}
                      </Badge>
                    </div>
                    {isConnected ? (
                      <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Connected
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Not connected</span>
                    )}
                  </div>
                  <CardTitle className="text-sm font-semibold mt-2">{cat.name}</CardTitle>
                  <CardDescription className="text-xs line-clamp-2 mt-1">{cat.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  <Button
                    size="sm"
                    variant={isConnected ? "outline" : "default"}
                    className="w-full text-xs h-8"
                    onClick={() => {
                      setSelectedProvider(cat);
                      setConfigureOpen(true);
                    }}
                  >
                    {isConnected ? "Reconfigure" : "Connect Channel"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Webhook Activity Stream */}
      <Card className="border border-border/80">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Incoming Webhook Deliveries & Deduplication Logs
            </CardTitle>
            <CardDescription className="text-xs">
              Audit log of verified incoming webhook events with idempotency tracking.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {recentWebhooks.length} Events Logged
          </Badge>
        </CardHeader>
        <CardContent>
          {recentWebhooks.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No webhook deliveries recorded yet.</p>
          ) : (
            <div className="rounded-lg border border-border/60 divide-y divide-border/40 text-xs">
              {recentWebhooks.map((hook) => (
                <div key={hook.id} className="flex items-center justify-between p-3">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      <span className="font-mono">{hook.eventType}</span>
                      <Badge
                        variant={
                          hook.status === "processed"
                            ? "default"
                            : hook.status === "ignored"
                            ? "secondary"
                            : "destructive"
                        }
                        className="text-[10px]"
                      >
                        {hook.status}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      External ID: {hook.externalId || "—"} &bull; {new Date(hook.createdAt).toLocaleTimeString()}
                    </div>
                    {hook.error && <p className="text-rose-600 text-[11px] mt-1">{hook.error}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connect / Configure Modal */}
      <Dialog
        open={configureOpen}
        onOpenChange={setConfigureOpen}
        title={selectedProvider ? `Configure ${selectedProvider.name}` : "Configure Integration"}
        description="Credentials are encrypted at rest using AES-256-GCM."
      >
        <form onSubmit={handleConnect} className="space-y-4 text-xs">
          {properties.length > 0 && (
            <div className="space-y-1">
              <label className="font-medium text-foreground">Scoping Property (Optional)</label>
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
              >
                <option value="">All Organization Properties</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <label className="font-medium text-foreground">API Key / Token</label>
            <Input
              type="password"
              placeholder="e.g. pk_live_..."
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="font-medium text-foreground">API Secret / Webhook Signing Key</label>
            <Input
              type="password"
              placeholder="e.g. whsec_..."
              value={apiSecretInput}
              onChange={(e) => setApiSecretInput(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>Encrypted with hardware AES-256-GCM before database commit.</span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setConfigureOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Saving..." : "Save & Connect"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
