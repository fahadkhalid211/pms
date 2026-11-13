"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
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
  Copy,
  Check,
  RefreshCw,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Activity,
  Layers,
  LogIn,
  ArrowLeftRight,
  Compass,
  Globe,
  Building2,
  AlertCircle,
  Terminal,
  Send,
} from "lucide-react";

interface SyncSummary {
  propertiesImported?: number;
  propertiesUpdated?: number;
  usersImported?: number;
  guestsImported?: number;
  bookingsImported?: number;
  bookingsUpdated?: number;
  datesPushed?: number;
  conflicts?: string[];
  syncedAt?: string;
}

interface IntegrationItem {
  id: string;
  organizationId?: string;
  provider: string;
  name: string;
  status: string;
  lastSyncAt: string | null;
  lastError: string | null;
  config?: {
    authMode?: string;
    lastSyncSummary?: SyncSummary;
    lastIcalResult?: { eventsFound: number; imported: number; updated: number };
  } | null;
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

  // Generic Configure Modal State
  const [configureOpen, setConfigureOpen] = React.useState(false);
  const [selectedProvider, setSelectedProvider] = React.useState<CatalogueItem | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = React.useState("");
  const [apiKeyInput, setApiKeyInput] = React.useState("");
  const [apiSecretInput, setApiSecretInput] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  // Hospitable Connect & Sync State
  const [hospitableModalOpen, setHospitableModalOpen] = React.useState(false);
  const [hospitableToken, setHospitableToken] = React.useState("");
  const [hospitableWebhookSecret, setHospitableWebhookSecret] = React.useState("");
  const [hospitableSyncing, setHospitableSyncing] = React.useState(false);
  const [copiedWebhook, setCopiedWebhook] = React.useState(false);
  const [copiedModalWebhook, setCopiedModalWebhook] = React.useState(false);

  // Webhook Public Tunnel & Connectivity Diagnostics State
  const [tunnelUrl, setTunnelUrl] = React.useState("");
  const [testingWebhook, setTestingWebhook] = React.useState(false);
  const [copiedNgrok, setCopiedNgrok] = React.useState(false);

  // Airbnb / Booking.com Sign-In & Guided Channel Sync Modal State
  const [channelModalOpen, setChannelModalOpen] = React.useState(false);
  const [channelProvider, setChannelProvider] = React.useState<"airbnb_ical" | "booking_com">("airbnb_ical");
  const [channelLoginUrl, setChannelLoginUrl] = React.useState("");
  const [channelNote, setChannelNote] = React.useState("");
  const [channelPropertyId, setChannelPropertyId] = React.useState("");
  const [channelIcalUrl, setChannelIcalUrl] = React.useState("");
  const [channelSyncing, setChannelSyncing] = React.useState(false);

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
        const props = json.data.properties || [];
        setProperties(props);
        if (props.length > 0 && !channelPropertyId) {
          setChannelPropertyId(props[0].id);
        }
      } else {
        toast({ title: "Failed to load integrations", description: json.error?.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Could not fetch integrations.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, channelPropertyId]);

  React.useEffect(() => {
    void loadData();
    if (typeof window !== "undefined") {
      const storedTunnel = localStorage.getItem("lumina_public_tunnel_url");
      if (storedTunnel) {
        setTunnelUrl(storedTunnel);
      }

      const params = new URLSearchParams(window.location.search);
      const connected = params.get("connected");
      const oauthError = params.get("oauth_error");
      if (connected) {
        toast({
          title: "Channel connected",
          description: `${connected} signed in and synced with your PMS.`,
        });
      }
      if (oauthError) {
        toast({
          title: "Sign-in could not complete",
          description: oauthError,
          variant: "destructive",
        });
      }
    }
  }, [loadData, toast]);

  const hospitableIntegration = integrations.find((i) => i.provider === "hospitable");
  const hospSummary = hospitableIntegration?.config?.lastSyncSummary;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.protocol === "http:");

  const effectiveOrigin = tunnelUrl.trim()
    ? tunnelUrl.trim().replace(/\/+$/, "")
    : origin;

  const orgIdForWebhook = hospitableIntegration?.organizationId || "";
  const hospWebhookUrl = `${effectiveOrigin}/api/integrations/webhooks/hospitable${orgIdForWebhook ? `?orgId=${orgIdForWebhook}` : ""}`;

  function handleSaveTunnel(val: string) {
    setTunnelUrl(val);
    if (typeof window !== "undefined") {
      if (val.trim()) {
        localStorage.setItem("lumina_public_tunnel_url", val.trim());
      } else {
        localStorage.removeItem("lumina_public_tunnel_url");
      }
    }
  }

  async function handleTestWebhook() {
    setTestingWebhook(true);
    const start = Date.now();
    try {
      const targetUrl = `/api/integrations/webhooks/hospitable${orgIdForWebhook ? `?orgId=${orgIdForWebhook}` : ""}`;
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ping", test: true }),
      });
      const json = await res.json();
      const elapsed = Date.now() - start;
      if (res.ok && (json.received || json.status === "ok")) {
        toast({
          title: "Webhook endpoint reachable (200 OK)",
          description: `Acknowledged test ping in ${elapsed}ms. Route is healthy and ready for Hospitable.`,
        });
        void loadData();
      } else {
        toast({
          title: "Webhook returned an error",
          description: json.error?.message || `Status ${res.status}`,
          variant: "destructive",
        });
      }
    } catch (err: unknown) {
      toast({
        title: "Test ping failed",
        description: (err as Error).message || "Could not reach webhook endpoint.",
        variant: "destructive",
      });
    } finally {
      setTestingWebhook(false);
    }
  }

  async function handleStartSignIn(provider: "hospitable" | "airbnb_ical" | "booking_com") {
    try {
      const res = await fetch(`/api/integrations/oauth/authorize?provider=${encodeURIComponent(provider)}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({ title: "Could not start sign-in", description: json.error?.message, variant: "destructive" });
        return;
      }

      const plan = json.data as {
        mode: string;
        authorizeUrl: string;
        note: string;
      };

      if (plan.mode === "oauth_redirect" || plan.mode === "hospitable_connect_redirect") {
        window.location.href = plan.authorizeUrl;
        return;
      }

      // Guided sign-in: open external host sign-in link in new tab and show completion modal
      window.open(plan.authorizeUrl, "_blank", "noopener,noreferrer");

      if (provider === "hospitable") {
        setHospitableModalOpen(true);
      } else {
        setChannelProvider(provider);
        setChannelLoginUrl(plan.authorizeUrl);
        setChannelNote(plan.note);
        setChannelModalOpen(true);
      }
    } catch {
      toast({ title: "Network error", description: "Failed to start channel sign-in.", variant: "destructive" });
    }
  }

  async function handleHospitableConnectAndSync(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setHospitableSyncing(true);
    try {
      const res = await fetch("/api/integrations/hospitable/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integrationId: hospitableIntegration?.id,
          ...(hospitableToken.trim() ? { accessToken: hospitableToken.trim() } : {}),
          ...(hospitableWebhookSecret.trim() ? { webhookSecret: hospitableWebhookSecret.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        const s = json.data.summary as SyncSummary;
        toast({
          title: "Hospitable two-way sync complete",
          description: `Imported ${s.propertiesImported ?? 0} properties, ${s.usersImported ?? 0} users, ${s.guestsImported ?? 0} guests, ${s.bookingsImported ?? 0} bookings; pushed ${s.datesPushed ?? 0} dates.`,
        });
        setHospitableModalOpen(false);
        setHospitableToken("");
        void loadData();
      } else {
        toast({ title: "Hospitable sync failed", description: json.error?.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Failed to sync with Hospitable.", variant: "destructive" });
    } finally {
      setHospitableSyncing(false);
    }
  }

  async function handleChannelIcalConnectAndSync(e: React.FormEvent) {
    e.preventDefault();
    if (!channelPropertyId) {
      toast({ title: "Select a property first", variant: "destructive" });
      return;
    }
    setChannelSyncing(true);
    try {
      const res = await fetch("/api/integrations/ical/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: channelPropertyId,
          provider: channelProvider,
          icalUrl: channelIcalUrl.trim(),
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast({
          title: "Channel connected & synced",
          description: `Found ${json.data.eventsFound} events: ${json.data.imported} imported, ${json.data.updated} updated.`,
        });
        setChannelModalOpen(false);
        setChannelIcalUrl("");
        void loadData();
      } else {
        toast({ title: "Channel sync failed", description: json.error?.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Could not sync external calendar.", variant: "destructive" });
    } finally {
      setChannelSyncing(false);
    }
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProvider) return;
    if (selectedProvider.provider === "hospitable") {
      setConfigureOpen(false);
      setHospitableModalOpen(true);
      return;
    }

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
        return <CreditCard className="h-4 w-4 text-emerald-600" strokeWidth={1.5} />;
      case "ota":
        return <Calendar className="h-4 w-4 text-primary" strokeWidth={1.5} />;
      case "messaging":
        return <MessageSquare className="h-4 w-4 text-sky-600" strokeWidth={1.5} />;
      case "accounting":
        return <FileSpreadsheet className="h-4 w-4 text-amber-600" strokeWidth={1.5} />;
      default:
        return <Zap className="h-4 w-4 text-violet-600" strokeWidth={1.5} />;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Integrations & External Channels</h1>
          <p className="text-sm text-muted-foreground">
            Connect Hospitable two-way sync, sign in to Airbnb and Booking.com, and monitor live webhooks.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} strokeWidth={1.5} />
          Refresh Status
        </Button>
      </div>

      {/* Hospitable Two-Way Sync Hub */}
      <Card className="border-primary/30 bg-gradient-to-br from-violet-50/50 via-background to-background">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
                <Compass className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-bold">Hospitable Two-Way Sync</CardTitle>
                  <Badge variant={hospitableIntegration?.status === "connected" ? "default" : "secondary"} className="text-[10px]">
                    {hospitableIntegration?.status === "connected" ? "Connected" : "Not Connected"}
                  </Badge>
                </div>
                <CardDescription className="text-xs mt-1">
                  Imports all Hospitable properties, owner/host users, guest profiles, and reservations, while pushing local bookings and cancellations back to Hospitable calendars in real time.
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {hospitableIntegration?.status === "connected" ? (
                <>
                  <Button
                    size="sm"
                    onClick={() => void handleHospitableConnectAndSync()}
                    disabled={hospitableSyncing}
                    className="gap-1.5"
                  >
                    <ArrowLeftRight className={`h-4 w-4 ${hospitableSyncing ? "animate-spin" : ""}`} strokeWidth={1.5} />
                    {hospitableSyncing ? "Syncing..." : "Two-Way Sync Now"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setHospitableModalOpen(true)}>
                    Update Token
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" onClick={() => void handleStartSignIn("hospitable")} className="gap-1.5">
                    <LogIn className="h-4 w-4" strokeWidth={1.5} />
                    Sign in with Hospitable
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setHospitableModalOpen(true)}>
                    Enter API Token
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {hospSummary && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 text-center">
              <div className="rounded-lg border bg-card p-2.5">
                <div className="text-lg font-bold">{(hospSummary.propertiesImported ?? 0) + (hospSummary.propertiesUpdated ?? 0)}</div>
                <div className="text-[11px] text-muted-foreground">Properties Synced</div>
              </div>
              <div className="rounded-lg border bg-card p-2.5">
                <div className="text-lg font-bold">{hospSummary.usersImported ?? 0}</div>
                <div className="text-[11px] text-muted-foreground">Host Users Added</div>
              </div>
              <div className="rounded-lg border bg-card p-2.5">
                <div className="text-lg font-bold">{hospSummary.guestsImported ?? 0}</div>
                <div className="text-[11px] text-muted-foreground">Guests Imported</div>
              </div>
              <div className="rounded-lg border bg-card p-2.5">
                <div className="text-lg font-bold">{(hospSummary.bookingsImported ?? 0) + (hospSummary.bookingsUpdated ?? 0)}</div>
                <div className="text-[11px] text-muted-foreground">Bookings Synced</div>
              </div>
              <div className="rounded-lg border bg-card p-2.5">
                <div className="text-lg font-bold">{hospSummary.datesPushed ?? 0}</div>
                <div className="text-[11px] text-muted-foreground">Dates Pushed Out</div>
              </div>
            </div>
          )}

          {hospitableIntegration?.lastError && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-300/70 bg-amber-50 p-2.5 text-xs text-amber-900">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" strokeWidth={1.5} />
              <span>{hospitableIntegration.lastError}</span>
            </div>
          )}

          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3.5 text-xs">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">Hospitable Real-Time Webhook URL</span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    POST &bull; GET &bull; HEAD
                  </Badge>
                </div>
                <div className="font-mono text-[11px] text-muted-foreground break-all">{hospWebhookUrl}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(hospWebhookUrl);
                    setCopiedWebhook(true);
                    setTimeout(() => setCopiedWebhook(false), 2000);
                  }}
                >
                  {copiedWebhook ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedWebhook ? "Copied" : "Copy Webhook URL"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs gap-1 shrink-0"
                  disabled={testingWebhook}
                  onClick={() => void handleTestWebhook()}
                >
                  <Send className={`h-3 w-3 ${testingWebhook ? "animate-pulse" : ""}`} />
                  {testingWebhook ? "Testing..." : "Test Ping"}
                </Button>
              </div>
            </div>

            {/* Localhost / HTTP Notice */}
            {isLocalhost && !tunnelUrl.trim() && (
              <div className="rounded-md border border-amber-300/80 bg-amber-500/10 p-2.5 text-[11px] space-y-1.5 text-amber-900 dark:text-amber-200">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Hospitable Requires a Public HTTPS URL</span>
                </div>
                <p className="text-muted-foreground">
                  Hospitable&apos;s cloud servers cannot reach <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">localhost:3000</code>.
                  Pasting a localhost or HTTP URL into Hospitable causes:
                  <em className="block mt-0.5 text-destructive font-medium">&quot;An error occured processing this action - please try again. If this keeps occuring, please contact support.&quot;</em>
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="font-medium text-foreground">For local testing:</span>
                  <div className="flex items-center gap-1 bg-background/80 border rounded px-2 py-0.5 font-mono text-[10px]">
                    <Terminal className="h-3 w-3 text-muted-foreground" />
                    <span>npx ngrok http 3000</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 text-[11px] px-2 gap-1"
                    onClick={() => {
                      navigator.clipboard.writeText("npx ngrok http 3000");
                      setCopiedNgrok(true);
                      setTimeout(() => setCopiedNgrok(false), 2000);
                    }}
                  >
                    {copiedNgrok ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    {copiedNgrok ? "Copied" : "Copy Command"}
                  </Button>
                </div>
              </div>
            )}

            {/* Public Tunnel / Base Domain Input */}
            <div className="pt-1 space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="tunnel-url" className="text-[11px] text-muted-foreground">
                  Public HTTPS Base / Tunnel URL (e.g. ngrok or production domain):
                </Label>
                {tunnelUrl.trim() && (
                  <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Tunnel Active
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  id="tunnel-url"
                  placeholder="https://your-domain.com or https://xxxx.ngrok-free.app"
                  value={tunnelUrl}
                  onChange={(e) => handleSaveTunnel(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
                {tunnelUrl.trim() && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => handleSaveTunnel("")}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>

            {/* Quick 3-Step Setup Instructions */}
            <div className="rounded-md border bg-background/50 p-2.5 text-[11px] space-y-1 text-muted-foreground">
              <span className="font-semibold text-foreground block">How to connect this webhook in Hospitable:</span>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Sign in to Hospitable and navigate to <strong>Apps &gt; Webhooks</strong>.</li>
                <li>Click <strong>+ Add new</strong> and paste the public HTTPS Webhook URL above into <strong>Endpoint URL</strong>.</li>
                <li>Select the events to receive (e.g. <em>reservation.created, reservation.updated, reservation.cancelled</em>) and click <strong>Save</strong>.</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Direct Channel Sign-In: Airbnb & Booking.com */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border border-border/80">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
                  <Globe className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <div>
                  <CardTitle className="text-base">Airbnb Integration</CardTitle>
                  <CardDescription className="text-xs">Connect & sync Airbnb listings and bookings</CardDescription>
                </div>
              </div>
              <Badge variant={integrations.some((i) => i.provider === "airbnb_ical" && i.status === "connected") ? "default" : "outline"} className="text-[10px]">
                {integrations.some((i) => i.provider === "airbnb_ical" && i.status === "connected") ? "Connected" : "Ready"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <p className="text-muted-foreground">
              Sign in with your Airbnb host account to link your listing calendar directly (or connect through Hospitable above for full API sync).
            </p>
            <Button
              size="sm"
              className="w-full gap-2"
              onClick={() => void handleStartSignIn("airbnb_ical")}
            >
              <LogIn className="h-4 w-4" strokeWidth={1.5} />
              Sign in with Airbnb
              <ExternalLink className="h-3.5 w-3.5 opacity-70" strokeWidth={1.5} />
            </Button>
          </CardContent>
        </Card>

        <Card className="border border-border/80">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/10 text-blue-700">
                  <Building2 className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <div>
                  <CardTitle className="text-base">Booking.com Integration</CardTitle>
                  <CardDescription className="text-xs">Connect Booking.com Extranet & calendar sync</CardDescription>
                </div>
              </div>
              <Badge variant={integrations.some((i) => i.provider === "booking_com" && i.status === "connected") ? "default" : "outline"} className="text-[10px]">
                {integrations.some((i) => i.provider === "booking_com" && i.status === "connected") ? "Connected" : "Ready"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <p className="text-muted-foreground">
              Sign in to Booking.com Extranet to link your property calendar directly or authorize Hospitable as your connected channel manager.
            </p>
            <Button
              size="sm"
              className="w-full gap-2"
              onClick={() => void handleStartSignIn("booking_com")}
            >
              <LogIn className="h-4 w-4" strokeWidth={1.5} />
              Sign in with Booking.com
              <ExternalLink className="h-3.5 w-3.5 opacity-70" strokeWidth={1.5} />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* iCal Feeds Card */}
      <Card className="border border-border/80">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" strokeWidth={1.5} />
            Live iCal Calendar Export Feeds (RFC 5545)
          </CardTitle>
          <CardDescription className="text-xs">
            Paste these live export URLs into Airbnb, Booking.com, or VRBO to push Lumina PMS bookings outward.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {properties.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No active properties available.</p>
          ) : (
            properties.map((prop) => {
              const feedUrl = `${origin}/api/integrations/ical/${prop.id}`;
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
          <Layers className="h-4 w-4 text-primary" strokeWidth={1.5} />
          Active Channels & Connected Integrations
        </div>

        {integrations.length === 0 ? (
          <Card className="border border-border/80 border-dashed bg-muted/10">
            <CardContent className="py-8 text-center text-xs text-muted-foreground">
              No active integrations connected yet. Sign in to Hospitable, Airbnb, or Booking.com above to connect.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {integrations.map((item) => (
              <Card key={item.id} className="border border-border/80">
                <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Blocks className="h-4 w-4 text-primary" strokeWidth={1.5} />
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
                      <span>{new Date(item.lastSyncAt).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="pt-2 flex justify-between gap-2">
                    {item.provider === "hospitable" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={hospitableSyncing}
                        onClick={() => void handleHospitableConnectAndSync()}
                        className="h-7 text-xs gap-1"
                      >
                        <RefreshCw className={`h-3 w-3 ${hospitableSyncing ? "animate-spin" : ""}`} />
                        Sync
                      </Button>
                    ) : <span />}
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
          <Blocks className="h-4 w-4 text-primary" strokeWidth={1.5} />
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
                      if (cat.provider === "hospitable") {
                        setHospitableModalOpen(true);
                      } else if (cat.provider === "airbnb_ical" || cat.provider === "booking_com") {
                        void handleStartSignIn(cat.provider);
                      } else {
                        setSelectedProvider(cat);
                        setConfigureOpen(true);
                      }
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
              <Activity className="h-4 w-4 text-primary" strokeWidth={1.5} />
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

      {/* Hospitable Connect & Token Modal */}
      <Dialog
        open={hospitableModalOpen}
        onOpenChange={setHospitableModalOpen}
        title="Connect Hospitable Two-Way Sync"
        description="Paste a Hospitable Personal Access Token to import all properties, host/user details, guests, and bookings immediately."
      >
        <form onSubmit={handleHospitableConnectAndSync} className="space-y-4 text-xs">
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="font-semibold text-foreground">How to get your Hospitable token:</div>
            <p className="text-muted-foreground">
              Sign in to Hospitable under <strong>Apps &gt; API access</strong>, generate a Personal Access Token with read/write scopes, and paste it below.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-7"
              onClick={() => window.open("https://my.hospitable.com/apps/api-access", "_blank", "noopener,noreferrer")}
            >
              Open Hospitable API Access
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hospitable-token">Hospitable Personal Access Token</Label>
            <Input
              id="hospitable-token"
              type="password"
              required={!hospitableIntegration}
              placeholder={hospitableIntegration ? "Leave blank to keep existing token" : "Paste Hospitable Bearer token..."}
              value={hospitableToken}
              onChange={(e) => setHospitableToken(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hospitable-webhook-secret">Webhook Signing Secret (Optional)</Label>
            <Input
              id="hospitable-webhook-secret"
              type="password"
              placeholder="Optional HMAC SHA-256 secret"
              value={hospitableWebhookSecret}
              onChange={(e) => setHospitableWebhookSecret(e.target.value)}
            />
          </div>

          <div className="space-y-1.5 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground">Hospitable Webhook Endpoint</Label>
              <Badge variant="outline" className="text-[10px] font-mono">Real-Time Two-Way Sync</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Add this public HTTPS URL under <strong>Apps &gt; Webhooks &gt; + Add new</strong> in Hospitable so reservation changes notify your PMS immediately.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span className="font-mono text-[10px] text-muted-foreground break-all bg-background border rounded px-2 py-1.5 flex-1">
                {hospWebhookUrl}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(hospWebhookUrl);
                  setCopiedModalWebhook(true);
                  setTimeout(() => setCopiedModalWebhook(false), 2000);
                }}
              >
                {copiedModalWebhook ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                {copiedModalWebhook ? "Copied" : "Copy"}
              </Button>
            </div>
            {isLocalhost && !tunnelUrl.trim() && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium pt-0.5">
                Note: Hospitable requires a public HTTPS URL (e.g. ngrok). Localhost URLs cannot be reached by Hospitable&apos;s cloud servers.
              </p>
            )}
          </div>

          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-emerald-800 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>Token encrypted with AES-256-GCM before storage.</span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setHospitableModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={hospitableSyncing}>
              {hospitableSyncing ? "Importing & Syncing..." : "Save & Run Two-Way Sync"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Airbnb / Booking.com Sign-In Completion Modal */}
      <Dialog
        open={channelModalOpen}
        onOpenChange={setChannelModalOpen}
        title={`Complete ${channelProvider === "booking_com" ? "Booking.com" : "Airbnb"} Sync`}
        description="Sign in inside the tab we opened, then link your listing calendar below for two-way sync."
      >
        <form onSubmit={handleChannelIcalConnectAndSync} className="space-y-4 text-xs">
          {channelNote && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 space-y-2">
              <p>{channelNote}</p>
              <div className="flex flex-wrap gap-2">
                {channelLoginUrl && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 bg-white"
                    onClick={() => window.open(channelLoginUrl, "_blank", "noopener,noreferrer")}
                  >
                    Reopen {channelProvider === "booking_com" ? "Booking.com" : "Airbnb"} Login
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    setChannelModalOpen(false);
                    setHospitableModalOpen(true);
                  }}
                >
                  Use Hospitable Full API Instead
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="channel-property">Target PMS Property</Label>
            <select
              id="channel-property"
              value={channelPropertyId}
              onChange={(e) => setChannelPropertyId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {channelPropertyId && (
            <div className="space-y-1">
              <Label>1. Copy this export URL into {channelProvider === "booking_com" ? "Booking.com" : "Airbnb"} (Export PMS -&gt; Channel)</Label>
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
                <span className="font-mono text-[11px] break-all flex-1">
                  {`${origin}/api/integrations/ical/${channelPropertyId}`}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(`${origin}/api/integrations/ical/${channelPropertyId}`);
                    toast({ title: "Copied PMS export URL" });
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="channel-ics-url">
              2. Paste your {channelProvider === "booking_com" ? "Booking.com" : "Airbnb"} Export Calendar (.ics) URL (Import Channel -&gt; PMS)
            </Label>
            <Input
              id="channel-ics-url"
              type="url"
              required
              placeholder="https://www.airbnb.com/calendar/ical/..."
              value={channelIcalUrl}
              onChange={(e) => setChannelIcalUrl(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setChannelModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={channelSyncing || !channelPropertyId}>
              {channelSyncing ? "Importing Calendar..." : "Connect & Sync Bookings"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Generic Connect / Configure Modal */}
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

          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-emerald-800 flex items-center gap-2">
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
