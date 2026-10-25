"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

interface ProviderConfig {
  id: string;
  provider: string;
  model: string;
  isEnabled: boolean;
  isDefault: boolean;
  hasApiKey: boolean;
}

export default function AiProvidersPage() {
  const { toast } = useToast();
  const [configs, setConfigs] = React.useState<ProviderConfig[]>([]);
  const [provider, setProvider] = React.useState("openai");
  const [model, setModel] = React.useState("gpt-4o-mini");
  const [apiKey, setApiKey] = React.useState("");
  const [isDefault, setIsDefault] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/ai/providers");
    const json = await res.json();
    if (res.ok && json.success) setConfigs(json.data);
  }

  React.useEffect(() => { void load(); }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await fetch("/api/ai/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, model, apiKey, isDefault }),
    });
    const json = await res.json();
    setPending(false);
    if (!res.ok || !json.success) { setError(json.error?.message ?? "Failed to save provider"); return; }
    toast({ title: "AI provider configured" });
    setApiKey("");
    await load();
  }

  async function testConfig(id: string) {
    const res = await fetch(`/api/ai/providers/${id}/test`, { method: "POST" });
    const json = await res.json();
    if (!res.ok || !json.success) toast({ title: "Connection failed", description: json.error?.message, variant: "destructive" });
    else toast({ title: "Connection OK", description: `${json.data.models?.length ?? 0} models available.` });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI provider settings</h1>
        <p className="text-muted-foreground">Configure encrypted AI provider credentials and models.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Providers</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {configs.length === 0 ? <p className="text-sm text-muted-foreground">No providers configured yet.</p> : configs.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium capitalize">{c.provider} · {c.model}</div>
                  <div className="text-sm text-muted-foreground">{c.hasApiKey ? "API key configured" : "No API key"}</div>
                </div>
                <div className="flex items-center gap-2">
                  {c.isDefault ? <Badge>Default</Badge> : null}
                  <Button size="sm" variant="outline" onClick={() => void testConfig(c.id)}>Test</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Add provider</CardTitle><CardDescription>Keys are encrypted at rest.</CardDescription></CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Select id="provider" value={provider} onChange={(e) => { setProvider(e.target.value); setModel(e.target.value === "openai" ? "gpt-4o-mini" : e.target.value === "gemini" ? "gemini-2.0-flash" : e.target.value === "groq" ? "llama-3.3-70b-versatile" : "claude-3-5-sonnet-20241022"); }}>
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="groq">Groq</option>
                  <option value="anthropic">Anthropic Claude</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiKey">API key</Label>
                <Input id="apiKey" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                Set as default provider
              </label>
              {error ? <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
              <Button type="submit" disabled={pending || !apiKey}>{pending ? "Saving…" : "Save provider"}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
