"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  Bell,
  BarChart3,
  Activity,
  MessageSquare,
  Bot,
  MessagesSquare,
  KeyRound,
  Blocks,
  UserCog,
  Settings,
  Menu,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User as UserIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ToastProvider } from "@/components/ui/toast";
import { GlobalSearch } from "@/components/global-search";
import { QuickCreate } from "@/components/quick-create";

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
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Activity Logs", href: "/activity-logs", icon: Activity },
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
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);

  // Restore sidebar preference from localStorage
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("lumina_sidebar_collapsed");
      if (saved !== null) {
        setCollapsed(saved === "true");
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("lumina_sidebar_collapsed", String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Proceed to login anyway
    }
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop & Mobile Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r bg-card transition-all duration-200",
          collapsed ? "lg:w-16" : "lg:w-64",
          "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm shadow-sm">
                L
              </div>
              <span className="text-lg font-bold tracking-tight">
                Lumina<span className="text-primary font-medium">PMS</span>
              </span>
            </Link>
          )}
          {collapsed && (
            <Link href="/dashboard" className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm shadow-sm" title="Lumina PMS">
              L
            </Link>
          )}

          {/* Desktop Collapse Toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden lg:inline-flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {NAV.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-colors",
                  collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2",
                  isActive
                    ? "bg-accent text-accent-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
                )}
              >
                <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="border-t p-2">
          <button
            type="button"
            onClick={handleLogout}
            title={collapsed ? "Sign Out" : undefined}
            className={cn(
              "flex w-full items-center rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive",
              collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2",
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main App Workspace */}
      <div
        className={cn(
          "flex min-h-screen flex-1 flex-col transition-all duration-200",
          collapsed ? "lg:pl-16" : "lg:pl-64",
        )}
      >
        {/* Top Header Navbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background lg:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle navigation menu"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Omnibox Global Search */}
            <GlobalSearch />
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            {/* Quick Create Dropdown */}
            <QuickCreate />

            {/* User Profile Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg border border-transparent p-1.5 transition-colors hover:bg-accent"
                aria-expanded={userMenuOpen}
                aria-label="User Profile Menu"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs border">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden text-left md:block">
                  <div className="text-xs font-semibold leading-tight text-foreground">{userName}</div>
                  <div className="text-[11px] text-muted-foreground leading-tight">Property Manager</div>
                </div>
              </button>

              {userMenuOpen && (
                <div
                  className="absolute right-0 z-50 mt-1.5 w-52 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <div className="border-b px-3 py-2 text-xs">
                    <p className="font-semibold text-foreground">{userName}</p>
                    <p className="text-muted-foreground">Manager</p>
                  </div>
                  <div className="p-1 space-y-0.5">
                    <Link
                      href="/settings"
                      className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                    >
                      <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                      Settings & Policies
                    </Link>
                    <Link
                      href="/staff"
                      className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                    >
                      <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      Staff Accounts
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Workspace Content */}
        <main className="flex-1 p-4 lg:p-6">
          <ToastProvider>{children}</ToastProvider>
        </main>
      </div>
    </div>
  );
}
