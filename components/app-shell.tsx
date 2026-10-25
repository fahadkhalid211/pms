"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  CalendarRange,
  MonitorSmartphone,
  Building2,
  BedDouble,
  Users,
  Sparkles,
  Wrench,
  CreditCard,
  BarChart3,
  MessageSquare,
  Bot,
  MessagesSquare,
  KeyRound,
  Blocks,
  UserCog,
  Settings,
  Menu,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Reservations", href: "/reservations", icon: CalendarDays },
  { label: "Calendar", href: "/calendar", icon: CalendarRange },
  { label: "Front Desk", href: "/frontdesk", icon: MonitorSmartphone },
  { label: "Properties", href: "/properties", icon: Building2 },
  { label: "Rooms", href: "/rooms", icon: BedDouble },
  { label: "Guests", href: "/guests", icon: Users },
  { label: "Housekeeping", href: "/housekeeping", icon: Sparkles },
  { label: "Maintenance", href: "/maintenance", icon: Wrench },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Support", href: "/support", icon: MessageSquare },
  { label: "AI Operations", href: "/ai", icon: Bot },
  { label: "AI Chatbot", href: "/ai/chatbot", icon: MessagesSquare },
  { label: "AI Providers", href: "/ai/providers", icon: KeyRound },
  { label: "Integrations", href: "/integrations", icon: Blocks },
  { label: "Staff", href: "/staff", icon: UserCog },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function AppShell({ userName, children }: { userName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r bg-card transition-transform duration-200 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center border-b px-4">
          <span className="text-lg font-bold tracking-tight">Lumina<span className="text-primary">PMS</span></span>
        </div>
        <nav className="flex h-[calc(100vh-64px)] flex-col gap-1 overflow-y-auto p-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                pathname === item.href && "bg-accent text-accent-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:px-6">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background lg:hidden"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="text-sm font-medium text-muted-foreground">Operations workspace</div>
          <div className="flex items-center gap-2">
            <div className="text-right sm:block">
              <div className="text-sm font-medium">{userName}</div>
              <div className="text-xs text-muted-foreground">Property manager</div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
