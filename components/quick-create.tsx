"use client";

import * as React from "react";
import Link from "next/link";
import {
  Plus,
  CalendarPlus,
  UserPlus,
  CreditCard,
  Sparkles,
  Wrench,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const QUICK_ACTIONS = [
  {
    label: "New Reservation",
    description: "Book an available room for a guest",
    href: "/reservations/new",
    icon: CalendarPlus,
  },
  {
    label: "Register Guest",
    description: "Add new guest profile and verification docs",
    href: "/guests",
    icon: UserPlus,
  },
  {
    label: "Create Invoice / Folio",
    description: "Issue new billing folio with line items",
    href: "/billing",
    icon: CreditCard,
  },
  {
    label: "Housekeeping Task",
    description: "Schedule room cleaning or inspection",
    href: "/housekeeping",
    icon: Sparkles,
  },
  {
    label: "Maintenance Work Order",
    description: "Report room repair or equipment issue",
    href: "/maintenance",
    icon: Wrench,
  },
];

export function QuickCreate() {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or Escape
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <Button
        variant="default"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 font-medium shadow-sm"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Quick Create Menu"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">Create</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </Button>

      {open && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 z-50 mt-2 w-64 origin-top-right rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl transition-all"
        >
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Quick Actions
          </div>
          <div className="space-y-0.5">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.href + action.label}
                href={action.href}
                onClick={() => setOpen(false)}
                role="menuitem"
                className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-card">
                  <action.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">{action.label}</span>
                  <span className="text-xs text-muted-foreground">{action.description}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
