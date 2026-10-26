"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Calendar,
  User,
  BedDouble,
  CreditCard,
  FileText,
  ArrowRight,
  X,
  Command,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  url: string;
  category: "page" | "reservation" | "guest" | "room" | "invoice";
  badge?: string;
}

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener: Cmd+K / Ctrl+K
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Focus input when dialog opens
  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      fetchResults("");
    } else {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  // Debounced search query
  const fetchResults = React.useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setSelectedIndex(0);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      fetchResults(query);
    }, 150);
    return () => clearTimeout(timer);
  }, [query, open, fetchResults]);

  // Navigate to result
  const handleSelect = (url: string) => {
    setOpen(false);
    router.push(url);
  };

  // Keyboard navigation within list (ArrowDown, ArrowUp, Enter)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex].url);
    }
  };

  const getCategoryIcon = (category: SearchResultItem["category"]) => {
    switch (category) {
      case "page":
        return <FileText className="h-4 w-4 text-primary" />;
      case "reservation":
        return <Calendar className="h-4 w-4 text-blue-500" />;
      case "guest":
        return <User className="h-4 w-4 text-emerald-500" />;
      case "room":
        return <BedDouble className="h-4 w-4 text-amber-500" />;
      case "invoice":
        return <CreditCard className="h-4 w-4 text-purple-500" />;
      default:
        return <Search className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <>
      {/* Header Search Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-xs items-center justify-between rounded-lg border border-input bg-background/50 px-3 text-sm text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground sm:w-64"
        aria-label="Search Lumina PMS (Ctrl+K)"
      >
        <span className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="hidden sm:inline">Search everything...</span>
          <span className="sm:hidden">Search...</span>
        </span>
        <kbd className="pointer-events-none hidden items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
          <Command className="h-3 w-3" />K
        </kbd>
      </button>

      {/* Modal Backdrop & Dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-16 backdrop-blur-sm sm:pt-24">
          <div
            className="fixed inset-0"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Omnibox Global Search"
            className="relative z-50 flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border bg-background shadow-2xl transition-all"
          >
            {/* Search Input Bar */}
            <div className="flex items-center border-b px-4 py-3">
              <Search className="mr-3 h-5 w-5 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search reservations, guests, rooms, invoices, or quick pages..."
                className="h-9 w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="rounded p-1 text-muted-foreground hover:bg-accent"
                  aria-label="Clear query"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Results List */}
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {loading && results.length === 0 ? (
                <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
                  Searching Lumina database...
                </div>
              ) : results.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No matching records or pages found for &ldquo;{query}&rdquo;.
                </div>
              ) : (
                <div className="space-y-1">
                  {results.map((item, idx) => {
                    const isSelected = idx === selectedIndex;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelect(item.url)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 transition-colors ${
                          isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                        }`}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-card">
                            {getCategoryIcon(item.category)}
                          </div>
                          <div className="overflow-hidden">
                            <div className="truncate text-sm font-medium">{item.title}</div>
                            <div className="truncate text-xs text-muted-foreground">{item.subtitle}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 pl-2">
                          {item.badge && (
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {item.badge}
                            </Badge>
                          )}
                          <ArrowRight className={`h-3.5 w-3.5 text-muted-foreground ${isSelected ? "opacity-100" : "opacity-0"}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Navigation Hints */}
            <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>Navigate: <kbd className="rounded border bg-background px-1">↑</kbd> <kbd className="rounded border bg-background px-1">↓</kbd></span>
                <span>Select: <kbd className="rounded border bg-background px-1">Enter</kbd></span>
                <span>Close: <kbd className="rounded border bg-background px-1">Esc</kbd></span>
              </div>
              <div className="font-medium">Lumina Global Search</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
