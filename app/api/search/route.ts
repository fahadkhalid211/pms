import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  url: string;
  category: "page" | "reservation" | "guest" | "room" | "invoice";
  badge?: string;
}

const APP_PAGES: Array<{ title: string; subtitle: string; url: string; keywords: string[] }> = [
  { title: "Dashboard", subtitle: "Executive KPIs, ADR/RevPAR analytics & live operations", url: "/dashboard", keywords: ["home", "kpi", "adr", "revpar", "occupancy"] },
  { title: "Reservations", subtitle: "View, create, manage bookings & state transitions", url: "/reservations", keywords: ["booking", "stay", "guest"] },
  { title: "New Reservation", subtitle: "Create a new confirmed or pending booking", url: "/reservations/new", keywords: ["book", "add", "create"] },
  { title: "Tape Chart / Calendar", subtitle: "Visual room inventory grid and drag-and-drop stays", url: "/calendar", keywords: ["grid", "chart", "schedule", "availability"] },
  { title: "Front Desk Workspace", subtitle: "Arrivals, departures, check-in, check-out, room moves", url: "/frontdesk", keywords: ["checkin", "checkout", "arrivals", "departures", "reassign"] },
  { title: "Properties", subtitle: "Manage hotel and resort properties", url: "/properties", keywords: ["hotel", "location", "buildings"] },
  { title: "Rooms & Inventory", subtitle: "Room numbers, room types, maintenance and cleaning status", url: "/rooms", keywords: ["inventory", "units", "types"] },
  { title: "Guest Profiles", subtitle: "Guest CRM, ID verification, history and preferences", url: "/guests", keywords: ["crm", "customer", "contact", "history"] },
  { title: "Housekeeping", subtitle: "Cleaning tasks, room condition, assignments and turnover", url: "/housekeeping", keywords: ["clean", "dirty", "maid", "turnover"] },
  { title: "Maintenance", subtitle: "Work orders, maintenance blocks, equipment repairs", url: "/maintenance", keywords: ["repair", "block", "fix", "ticket"] },
  { title: "Billing & Folios", subtitle: "Server-side invoices, line items, deposits, balance reconciliation", url: "/billing", keywords: ["invoice", "payment", "money", "stripe", "folio", "refund"] },
  { title: "Notifications Queue", subtitle: "Transactional email dispatch, branded templates, delivery logs", url: "/notifications", keywords: ["email", "queue", "reminder", "template", "sms"] },
  { title: "Reports & Financials", subtitle: "Executive metrics, daily performance, RFC 4180 CSV export", url: "/reports", keywords: ["analytics", "csv", "export", "revenue", "adr"] },
  { title: "Universal Activity Logs", subtitle: "Unified audit trail with frontend and backend event logs", url: "/activity-logs", keywords: ["audit", "logs", "security", "events", "history"] },
  { title: "AI Operations Hub", subtitle: "Autonomous hospitality assistant, tool execution, human approvals", url: "/ai", keywords: ["agent", "llm", "tools", "approval"] },
  { title: "AI Guest Chatbot", subtitle: "Autonomous customer concierge, knowledge base & embed script", url: "/ai/chatbot", keywords: ["concierge", "kb", "rag", "embed", "widget"] },
  { title: "AI Provider Hub", subtitle: "Configure OpenAI, Google Gemini, Anthropic, Groq credentials", url: "/ai/providers", keywords: ["keys", "gemini", "openai", "claude", "api"] },
  { title: "Integrations & Channels", subtitle: "OTAs, RFC 5545 iCal subscription feeds, webhooks", url: "/integrations", keywords: ["airbnb", "booking", "ical", "calendar", "sync", "ota"] },
  { title: "Staff & RBAC", subtitle: "User accounts, role permissions, audit attribution", url: "/staff", keywords: ["users", "roles", "team", "permissions"] },
  { title: "Settings", subtitle: "Organization preferences, timezones, security policies", url: "/settings", keywords: ["config", "organization", "timezone", "security"] },
];

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    const results: SearchResultItem[] = [];

    // Filter Navigation Pages
    const queryLower = q.toLowerCase();
    const matchedPages = APP_PAGES.filter((p) => {
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(queryLower) ||
        p.subtitle.toLowerCase().includes(queryLower) ||
        p.keywords.some((k) => k.includes(queryLower))
      );
    }).slice(0, q ? 6 : 8);

    for (const page of matchedPages) {
      results.push({
        id: `page_${page.url}`,
        title: page.title,
        subtitle: page.subtitle,
        url: page.url,
        category: "page",
      });
    }

    if (!q) {
      return NextResponse.json({ query: q, results });
    }

    // Parallel DB lookups scoped strictly by user.organizationId
    const [reservations, guests, rooms, invoices] = await Promise.all([
      // Reservations
      prisma.reservation.findMany({
        where: {
          organizationId: user.organizationId,
          OR: [
            { code: { contains: q } },
            { guest: { firstName: { contains: q } } },
            { guest: { lastName: { contains: q } } },
            { guest: { email: { contains: q } } },
          ],
        },
        select: {
          id: true,
          code: true,
          status: true,
          checkIn: true,
          checkOut: true,
          guest: { select: { firstName: true, lastName: true, email: true } },
        },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),

      // Guests
      prisma.guest.findMany({
        where: {
          organizationId: user.organizationId,
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
        take: 5,
      }),

      // Rooms
      prisma.room.findMany({
        where: {
          organizationId: user.organizationId,
          OR: [
            { number: { contains: q } },
            { property: { name: { contains: q } } },
          ],
        },
        select: {
          id: true,
          number: true,
          status: true,
          property: { select: { name: true } },
          roomType: { select: { name: true } },
        },
        take: 5,
      }),

      // Invoices
      prisma.invoice.findMany({
        where: {
          organizationId: user.organizationId,
          OR: [
            { number: { contains: q } },
            { reservation: { code: { contains: q } } },
          ],
        },
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          payments: {
            select: { amount: true, status: true },
          },
        },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Format Reservations
    for (const r of reservations) {
      const guestName = [r.guest?.firstName, r.guest?.lastName].filter(Boolean).join(" ") || "Unknown Guest";
      results.push({
        id: `res_${r.id}`,
        title: `${r.code} — ${guestName}`,
        subtitle: `${new Date(r.checkIn).toISOString().slice(0, 10)} to ${new Date(r.checkOut).toISOString().slice(0, 10)}`,
        url: `/reservations/${r.id}`,
        category: "reservation",
        badge: r.status,
      });
    }

    // Format Guests
    for (const g of guests) {
      const fullName = [g.firstName, g.lastName].filter(Boolean).join(" ") || "Unnamed Guest";
      results.push({
        id: `guest_${g.id}`,
        title: fullName,
        subtitle: [g.email, g.phone].filter(Boolean).join(" • ") || "No contact info",
        url: `/guests/${g.id}`,
        category: "guest",
      });
    }

    // Format Rooms
    for (const rm of rooms) {
      results.push({
        id: `room_${rm.id}`,
        title: `Room ${rm.number} — ${rm.property?.name ?? ""}`,
        subtitle: `${rm.roomType?.name ?? "Standard"} • Status: ${rm.status}`,
        url: `/rooms/${rm.id}`,
        category: "room",
        badge: rm.status,
      });
    }

    // Format Invoices
    for (const inv of invoices) {
      const totalAmount = Number(inv.total);
      const paidAmount = (inv.payments || [])
        .filter((p) => p.status === "captured")
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const remainingBalance = Math.max(0, totalAmount - paidAmount);

      results.push({
        id: `inv_${inv.id}`,
        title: `${inv.number} ($${totalAmount.toFixed(2)})`,
        subtitle: `Balance: $${remainingBalance.toFixed(2)} • Status: ${inv.status}`,
        url: `/billing/${inv.id}`,
        category: "invoice",
        badge: inv.status,
      });
    }

    return NextResponse.json({ query: q, count: results.length, results });
  } catch (error: unknown) {
    const message = (error as Error).message ?? "Internal search error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
