"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  Bot,
  BookOpen,
  Search,
  Code,
  ShieldCheck,
  Trash2,
  Plus,
  RefreshCw,
  Copy,
  Check,
  Send,
  User,
  Clock,
  Sparkles,
  AlertCircle,
  FileText,
  LifeBuoy,
} from "lucide-react";

interface KbDocument {
  id: string;
  title: string;
  type: string;
  source?: string | null;
  updatedAt: string;
  property?: { id: string; name: string } | null;
  chunks: Array<{ id: string; chunkIndex: number; tokenCount: number }>;
}

interface SearchResult {
  chunkId: string;
  documentId: string;
  title: string;
  type: string;
  content: string;
  rank: number;
}

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
  toolUsed?: string;
  handoff?: boolean;
}

export default function AiChatbotAdminPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState<"kb" | "embed" | "test">("kb");

  // Knowledge Base State
  const [documents, setDocuments] = React.useState<KbDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = React.useState(true);
  const [searchFilter, setSearchFilter] = React.useState("");
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [submittingDoc, setSubmittingDoc] = React.useState(false);

  // New Doc Form
  const [newTitle, setNewTitle] = React.useState("");
  const [newType, setNewType] = React.useState<"faq" | "policy" | "amenity_guide" | "local_guide" | "sop">("faq");
  const [newContent, setNewContent] = React.useState("");
  const [newSource, setNewSource] = React.useState("");

  // FTS Search Testing
  const [testQuery, setTestQuery] = React.useState("");
  const [searchingFts, setSearchingFts] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<SearchResult[] | null>(null);

  // Embed script
  const [copiedEmbed, setCopiedEmbed] = React.useState(false);

  // Live Test Bench State
  const [sessionKey, setSessionKey] = React.useState(() => `console-${Date.now().toString(36)}`);
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Welcome to Lumina concierge! I am here to help with hotel information, room rates, verified reservation lookups, and support tickets.",
    },
  ]);
  const [input, setInput] = React.useState("");
  const [chatPending, setChatPending] = React.useState(false);
  const [lastOutcome, setLastOutcome] = React.useState<{
    handoff?: boolean;
    toolUsed?: string;
    status?: string;
  } | null>(null);

  // Fetch KB documents
  const loadDocuments = React.useCallback(async () => {
    try {
      setLoadingDocs(true);
      const res = await fetch("/api/kb");
      const json = await res.json();
      if (res.ok && json.success) {
        setDocuments(json.data || []);
      } else {
        toast({ title: "Failed to load documents", description: json.error?.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Could not fetch KB documents", variant: "destructive" });
    } finally {
      setLoadingDocs(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  // Handle Add Doc
  async function handleCreateDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      toast({ title: "Validation error", description: "Title and content are required.", variant: "destructive" });
      return;
    }
    setSubmittingDoc(true);
    try {
      const res = await fetch("/api/kb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          type: newType,
          content: newContent.trim(),
          source: newSource.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast({ title: "Document created", description: `Indexed with ${json.data.chunksCount} chunks.` });
        setIsAddOpen(false);
        setNewTitle("");
        setNewContent("");
        setNewSource("");
        void loadDocuments();
      } else {
        toast({ title: "Failed to save", description: json.error?.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Failed to save document.", variant: "destructive" });
    } finally {
      setSubmittingDoc(false);
    }
  }

  // Handle Delete Doc
  async function handleDeleteDoc(id: string) {
    if (!window.confirm("Are you sure you want to delete this document and all indexed chunks?")) return;
    try {
      const res = await fetch(`/api/kb/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (res.ok && json.success) {
        toast({ title: "Document removed", description: "Document and chunks successfully deleted." });
        setDocuments((prev) => prev.filter((d) => d.id !== id));
      } else {
        toast({ title: "Delete failed", description: json.error?.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Failed to delete document.", variant: "destructive" });
    }
  }

  // Handle Test Search
  async function handleFtsSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!testQuery.trim()) return;
    setSearchingFts(true);
    try {
      const res = await fetch("/api/kb/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: testQuery.trim(), limit: 5 }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSearchResults(json.data || []);
      } else {
        toast({ title: "Search failed", description: json.error?.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Search query failed.", variant: "destructive" });
    } finally {
      setSearchingFts(false);
    }
  }

  // Live Chatbot Console Send
  async function handleSendChat(textToSend?: string) {
    const message = (textToSend ?? input).trim();
    if (!message || chatPending) return;

    setInput("");
    setChatPending(true);
    const updatedMessages = [...messages, { role: "user" as const, content: message }];
    setMessages(updatedMessages);

    try {
      const res = await fetch("/api/chatbot/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionKey }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        const data = json.data;
        setLastOutcome(data);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.reply,
            toolUsed: data.toolUsed,
            handoff: data.handoff,
          },
        ]);
      } else {
        toast({ title: "Chat error", description: json.error?.message, variant: "destructive" });
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, I encountered an issue processing your request. Please try again.",
          },
        ]);
      }
    } catch {
      toast({ title: "Network error", description: "Chatbot service unavailable", variant: "destructive" });
    } finally {
      setChatPending(false);
    }
  }

  const filteredDocs = documents.filter(
    (d) =>
      d.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      d.type.toLowerCase().includes(searchFilter.toLowerCase()),
  );

  const totalChunks = documents.reduce((acc, d) => acc + (d.chunks?.length || 0), 0);

  const embedScriptSnippet = `<!-- Lumina Autonomous Guest Concierge -->
<script
  src="${typeof window !== "undefined" ? window.location.origin : "https://app.lumina-pms.com"}/api/chatbot/widget.js"
  data-tenant="org_current"
  data-primary-color="#3b28cc"
  async>
</script>`;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Chatbot & Knowledge Base</h1>
          <p className="text-sm text-muted-foreground">
            Manage grounded documentation, embed the public concierge widget, and test anti-IDOR security.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === "kb" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("kb")}
            className="gap-2"
          >
            <BookOpen className="h-4 w-4" />
            Knowledge Base
          </Button>
          <Button
            variant={activeTab === "embed" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("embed")}
            className="gap-2"
          >
            <Code className="h-4 w-4" />
            Embed Widget
          </Button>
          <Button
            variant={activeTab === "test" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("test")}
            className="gap-2"
          >
            <Bot className="h-4 w-4" />
            Live Test Console
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border border-border/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Documents</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documents.length}</div>
            <p className="text-xs text-muted-foreground">Grounded hotel articles</p>
          </CardContent>
        </Card>
        <Card className="border border-border/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Indexed Chunks</CardTitle>
            <Sparkles className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalChunks}</div>
            <p className="text-xs text-muted-foreground">Postgres FTS vectors</p>
          </CardContent>
        </Card>
        <Card className="border border-border/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Security Protocol</CardTitle>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-base font-semibold text-emerald-700">Anti-IDOR Active</div>
            <p className="text-xs text-muted-foreground">Ref alone strictly blocked</p>
          </CardContent>
        </Card>
        <Card className="border border-border/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Human Escalation</CardTitle>
            <LifeBuoy className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-base font-semibold text-amber-700">Available 24/7</div>
            <p className="text-xs text-muted-foreground">Automated ticket & handoff</p>
          </CardContent>
        </Card>
      </div>

      {/* TAB 1: KNOWLEDGE BASE */}
      {activeTab === "kb" && (
        <div className="space-y-6">
          <Card className="border border-border/80">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">Hotel Knowledge Base</CardTitle>
                <CardDescription>
                  Grounded articles indexed with PostgreSQL full-text search (`tsvector` & `ts_rank`).
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => void loadDocuments()} disabled={loadingDocs}>
                  <RefreshCw className={`h-4 w-4 ${loadingDocs ? "animate-spin" : ""}`} />
                </Button>
                <Button size="sm" onClick={() => setIsAddOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Document
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filter documents by title or category..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {loadingDocs ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Loading knowledge base...</div>
              ) : filteredDocs.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No documents found. Click &quot;Add Document&quot; to index your hotel FAQs and policies.
                </div>
              ) : (
                <div className="rounded-lg border border-border/80 divide-y divide-border/60">
                  {filteredDocs.map((doc) => (
                    <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{doc.title}</span>
                          <Badge variant="outline" className="capitalize text-xs">
                            {doc.type}
                          </Badge>
                          {doc.property && (
                            <Badge variant="secondary" className="text-xs">
                              {doc.property.name}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-3">
                          <span>{doc.chunks?.length || 0} chunks</span>
                          <span>&bull;</span>
                          <span>Updated {new Date(doc.updatedAt).toLocaleDateString()}</span>
                          {doc.source && (
                            <>
                              <span>&bull;</span>
                              <span>Source: {doc.source}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => void handleDeleteDoc(doc.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Test Search Section */}
          <Card className="border border-border/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />
                Test Postgres Full-Text Search Retrieval
              </CardTitle>
              <CardDescription>
                Simulate how the chatbot retrieves chunks using `ts_rank` against natural language queries.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleFtsSearch} className="flex gap-2">
                <Input
                  placeholder="e.g. check-in times, breakfast hours, pool policies, pet fee..."
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" disabled={searchingFts || !testQuery.trim()} className="gap-2">
                  <Search className="h-4 w-4" />
                  {searchingFts ? "Searching..." : "Test FTS"}
                </Button>
              </form>

              {searchResults !== null && (
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Search Results ({searchResults.length} chunks matched)
                  </div>
                  {searchResults.length === 0 ? (
                    <div className="rounded-lg border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
                      No matching chunks found. Try another query or add relevant documents.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {searchResults.map((res, i) => (
                        <div key={res.chunkId || i} className="rounded-lg border border-border/70 p-3 bg-muted/20">
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span className="font-semibold text-foreground">{res.title}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">
                                {res.type}
                              </Badge>
                              <span className="font-mono text-primary font-medium">
                                Rank: {typeof res.rank === "number" ? res.rank.toFixed(4) : "—"}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-foreground/90 whitespace-pre-wrap">{res.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: EMBED WIDGET */}
      {activeTab === "embed" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border border-border/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-4 w-4 text-primary" />
                Embeddable Guest Widget Script
              </CardTitle>
              <CardDescription>
                Place this snippet on your marketing landing pages or external booking engines.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative rounded-lg bg-zinc-950 p-4 text-xs font-mono text-zinc-100">
                <pre className="overflow-x-auto whitespace-pre-wrap">{embedScriptSnippet}</pre>
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute right-3 top-3 h-7 gap-1 text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(embedScriptSnippet);
                    setCopiedEmbed(true);
                    setTimeout(() => setCopiedEmbed(false), 2000);
                  }}
                >
                  {copiedEmbed ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copiedEmbed ? "Copied" : "Copy"}
                </Button>
              </div>

              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="font-semibold text-foreground">Widget Features:</div>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Zero dependency vanilla JS loader (3.2 KB).</li>
                  <li>Floating branded bubble in bottom right corner.</li>
                  <li>Real-time room availability & rates inquiry.</li>
                  <li>Anti-IDOR identity verification for booking lookups.</li>
                  <li>Direct human handoff escalation with instant ticket dispatch.</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Security & Grounding Safeguards
              </CardTitle>
              <CardDescription>Autonomous guardrails enforced on every visitor prompt.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
                <div className="font-semibold text-emerald-800 dark:text-emerald-300">
                  Strict Identity Verification (Anti-IDOR)
                </div>
                <p className="mt-1 text-emerald-700 dark:text-emerald-400">
                  Guest booking references alone (e.g. `BK-894721`) are strictly rejected. The guest MUST provide the
                  matching email address. Without both valid keys, no personal reservation or folio data is disclosed.
                </p>
              </div>

              <div className="rounded-lg border border-border/80 p-4 space-y-2">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Operating Hours & Human Escalation
                </div>
                <p className="text-muted-foreground">
                  The bot is operational 24/7. When guests request complex modifications or report urgent issues, the bot
                  automatically triggers `request_human_handoff`, creates a high-priority front-desk ticket, and sets the
                  chat session to `needs_human`.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: LIVE TEST CONSOLE */}
      {activeTab === "test" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 border border-border/80">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  Live Chatbot Test Bench
                </CardTitle>
                <CardDescription>Test grounding, availability tools, and identity gates in real-time.</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSessionKey(`console-${Date.now().toString(36)}`);
                  setMessages([
                    {
                      role: "assistant",
                      content: "Session reset. How can I help you today?",
                    },
                  ]);
                  setLastOutcome(null);
                }}
                className="text-xs"
              >
                Reset Session
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Message scroll container */}
              <div className="h-96 overflow-y-auto space-y-3 rounded-lg border border-border/80 bg-muted/20 p-4">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 text-xs leading-relaxed ${
                      m.role === "user" ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    <div
                      className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                        m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"
                      }`}
                    >
                      {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5 text-primary" />}
                    </div>
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        m.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-card border border-border/80 text-foreground"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{m.content}</div>
                      {m.toolUsed && (
                        <div className="mt-2 pt-2 border-t border-border/40 text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                          <Sparkles className="h-3 w-3 text-primary" />
                          Tool: {m.toolUsed}
                        </div>
                      )}
                      {m.handoff && (
                        <div className="mt-2 pt-2 border-t border-amber-500/40 text-[10px] text-amber-600 flex items-center gap-1 font-semibold">
                          <AlertCircle className="h-3 w-3" />
                          Human handoff requested
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Sample quick pills */}
              <div className="flex flex-wrap gap-1.5 text-xs">
                <button
                  type="button"
                  className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-accent transition"
                  onClick={() => void handleSendChat("What is your check-out time and cancellation policy?")}
                >
                  Check-out & cancellation policy
                </button>
                <button
                  type="button"
                  className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-accent transition"
                  onClick={() => void handleSendChat("Are there any rooms available next weekend?")}
                >
                  Check room availability
                </button>
                <button
                  type="button"
                  className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-accent transition"
                  onClick={() => void handleSendChat("Can you check my booking reference BK-999999?")}
                >
                  Lookup ref alone (Anti-IDOR test)
                </button>
                <button
                  type="button"
                  className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-accent transition"
                  onClick={() => void handleSendChat("I need to speak to the manager immediately.")}
                >
                  Request human handoff
                </button>
              </div>

              {/* Input box */}
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSendChat();
                    }
                  }}
                  placeholder="Ask a question as a guest (Enter to send)..."
                  className="min-h-[50px] resize-none text-xs"
                />
                <Button
                  onClick={() => void handleSendChat()}
                  disabled={chatPending || !input.trim()}
                  className="h-auto px-4"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Diagnostics Panel */}
          <Card className="border border-border/80">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Execution Diagnostics</CardTitle>
              <CardDescription className="text-xs">Inspect session state and tools invoked.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="space-y-1">
                <span className="text-muted-foreground">Session Key</span>
                <div className="font-mono text-[11px] bg-muted/50 p-2 rounded border border-border/60 break-all">
                  {sessionKey}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground">Status</span>
                <div>
                  <Badge variant={lastOutcome?.handoff ? "destructive" : "secondary"}>
                    {lastOutcome?.status || "active"}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground">Last Tool Invoked</span>
                <div className="font-mono text-[11px] bg-muted/50 p-2 rounded border border-border/60">
                  {lastOutcome?.toolUsed || "none (direct knowledge grounding)"}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground">Human Handoff</span>
                <div>
                  {lastOutcome?.handoff ? (
                    <span className="font-medium text-amber-600 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" /> Required (Escalated)
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Not requested</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Document Dialog */}
      <Dialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        title="Add Knowledge Base Document"
        description="Add hotel FAQs, policies, or guides to ground chatbot answers."
      >
        <form onSubmit={handleCreateDoc} className="space-y-4 text-sm">
          <div className="space-y-1">
            <label className="font-medium text-xs">Title *</label>
            <Input
              placeholder="e.g. Check-in and Check-out Policy"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-medium text-xs">Category</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as any)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
              >
                <option value="faq">FAQ</option>
                <option value="policy">Policy</option>
                <option value="amenity_guide">Amenity Guide</option>
                <option value="local_guide">Local Guide</option>
                <option value="sop">Standard Operating Procedure</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-medium text-xs">Source / Reference (Optional)</label>
              <Input
                placeholder="e.g. Guest Handbook 2026"
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-medium text-xs">Content *</label>
            <Textarea
              placeholder="Detailed hotel information. It will be chunked and indexed automatically for semantic full-text search..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="min-h-[140px] text-xs"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submittingDoc}>
              {submittingDoc ? "Indexing..." : "Index Document"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
