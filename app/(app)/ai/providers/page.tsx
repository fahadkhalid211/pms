"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { Sliders, ShieldCheck, ArrowLeft, RefreshCw, KeyRound, Cpu, Check, Trash2 } from "lucide-react";

interface ProviderConfig {
  id: string;
  name: string;
  provider: string;
  model: string;
  baseUrl: string | null;
  isEnabled: boolean;
  isDefault: boolean;
  hasApiKey: boolean;
  keyHint: string | null;
  updatedAt: string;
}

export default function AiProvidersPage() {
  const { toast } = useToast();
  const [configs, setConfigs] = React.useState<ProviderConfig[]>([]);
  const [provider, setProvider] = React.useState("openai");
  const [model, setModel] = React.useState("gpt-4o-mini");
  const [apiKey, setApiKey] = React.useState("");
  const [baseUrl, setBaseUrl] = React.useState("");
  const [isDefault, setIsDefault] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/ai/providers");
      const json = await res.json();
      if (res.ok && json.success) setConfigs(json.data);
    } catch {
      // Ignore background errors
    }
  }

  React.useEffect(() => {
    void load();
  }, []);

  function handleProviderChange(val: string) {
    setProvider(val);
    switch (val) {
      case "openai":
        setModel("gpt-4o-mini");
        break;
      case "gemini":
        setModel("gemini-2.0-flash");
        break;
      case "groq":
        setModel("llama-3.3-70b-versatile");
        break;
      case "anthropic":
        setModel("claude-3-5-sonnet-20241022");
        break;
      case "mock":
        setModel("mock-operations-v1");
        break;
      default:
        setModel("default");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const res = await fetch("/api/ai/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          apiKey: provider === "mock" ? "mock-key" : apiKey,
          baseUrl: baseUrl.trim() || undefined,
          isDefault,
        }),
      });

      const json = await res.json();
      setPending(false);

      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Failed to save AI provider configuration.");
        return;
      }

      toast({ title: "Provider configured", description: `Added ${provider} (${model}) to your organization.` });
      setApiKey("");
      setBaseUrl("");
      await load();
    } catch (err: any) {
      setPending(false);
      setError(err.message);
    }
  }

  async function testConfig(id: string) {
    try {
      const res = await fetch(`/api/ai/providers/${id}/test`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({ title: "Connection failed", description: json.error?.message, variant: "destructive" });
      } else {
        toast({
          title: "Connection healthy",
          description: `Discovered ${json.data.models?.length ?? 0} active models.`,
        });
      }
    } catch (err: any) {
      toast({ title: "Network error", description: err.message, variant: "destructive" });
    }
  }

  async function deleteConfig(id: string) {
    try {
      const res = await fetch(`/api/ai/providers/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (res.ok && json.success) {
        toast({ title: "Provider removed" });
        await load();
      } else {
        toast({ title: "Delete failed", description: json.error?.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/ai">
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Provider Hub</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-8">
            Manage encrypted credentials and model mappings for your AI operations agent and chatbot.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active Providers List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Configured Providers</CardTitle>
                <CardDescription>Multi-provider registry with automatic fallback resilience</CardDescription>
              </div>
              <Badge variant="outline" className="border-violet-500/30 text-violet-400">
                AES-256-GCM Encrypted
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {configs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                No AI providers configured yet. Add your OpenAI, Google Gemini, Anthropic, or Mock provider on the right.
              </div>
            ) : (
              configs.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-violet-400" />
                      <span className="font-semibold text-foreground capitalize">{c.provider}</span>
                      <span className="text-xs text-muted-foreground font-mono">({c.model})</span>
                      {c.isDefault && (
                        <Badge className="bg-violet-600 text-white text-[10px] px-1.5 py-0">Default</Badge>
                      )}
                      {!c.isEnabled && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                          Disabled
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <KeyRound className="h-3 w-3" />
                        {c.keyHint ? `•••• ${c.keyHint}` : c.hasApiKey ? "Encrypted key" : "No key needed"}
                      </span>
                      {c.baseUrl && <span className="font-mono text-[11px] truncate max-w-[200px]">{c.baseUrl}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => void testConfig(c.id)}>
                      Test Connection
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                      onClick={() => void deleteConfig(c.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Add Provider Card */}
        <Card>
          <CardHeader>
            <CardTitle>Add Provider</CardTitle>
            <CardDescription>Secrets are encrypted with rotating AES-256 keys</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="provider">Provider Adapter</Label>
                <Select
                  id="provider"
                  value={provider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                >
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="groq">Groq</option>
                  <option value="anthropic">Anthropic Claude</option>
                  <option value="mock">Simulated Mock (Deterministic Testing)</option>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="model">Model Name</Label>
                <Input
                  id="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. gpt-4o, gemini-2.0-flash"
                  required
                />
              </div>

              {provider !== "mock" && (
                <div className="space-y-1.5">
                  <Label htmlFor="apiKey">API Key / Secret</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    required={provider !== "mock"}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Stored securely in Postgres with AES-256-GCM envelope encryption.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="baseUrl">Custom Base URL (Optional)</Label>
                <Input
                  id="baseUrl"
                  type="url"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://..."
                />
                <p className="text-[11px] text-muted-foreground">
                  Must be HTTPS. Private IPs and cloud metadata are strictly blocked.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isDefault"
                  className="h-4 w-4 rounded border-border"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                />
                <Label htmlFor="isDefault" className="text-xs cursor-pointer">
                  Set as primary organization default
                </Label>
              </div>

              {error && (
                <div className="rounded-md border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={pending || (provider !== "mock" && !apiKey)}
                className="w-full bg-violet-600 hover:bg-violet-700"
              >
                {pending ? "Saving..." : "Save Configuration"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
