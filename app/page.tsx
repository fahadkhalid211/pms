import Link from "next/link";
import {
  CalendarDays,
  ShieldCheck,
  Bot,
  CreditCard,
  Building2,
  Sparkles,
  BedDouble,
  CheckCircle2,
  Clock,
  ArrowRight,
  Lock,
  Layers,
  Users,
  Compass,
} from "lucide-react";

export const metadata = {
  title: "Lumina PMS — Next-Gen Hospitality Property Management System",
  description:
    "Lumina PMS unifies multi-property reservations, front desk, housekeeping, server-side billing, and autonomous AI guest operations with schema-level double-booking protection.",
};

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/25">
              <Compass className="h-5 w-5" />
            </span>
            <span>
              Lumina<span className="text-indigo-400">PMS</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm font-medium text-slate-400 transition hover:text-white">
              Features
            </a>
            <a href="#ai-hub" className="text-sm font-medium text-slate-400 transition hover:text-white">
              AI Operations
            </a>
            <a href="#security" className="text-sm font-medium text-slate-400 transition hover:text-white">
              Security
            </a>
            <a href="#pricing" className="text-sm font-medium text-slate-400 transition hover:text-white">
              Pricing
            </a>
            <a href="#faq" className="text-sm font-medium text-slate-400 transition hover:text-white">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-300 transition hover:text-white px-3 py-2"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm shadow-indigo-600/50 transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-20 pb-28 md:pt-32 md:pb-36">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.25),rgba(255,255,255,0))]" />
          <div className="container mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1 text-xs font-medium text-indigo-300 mb-8 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>Lumina 2.0 with Autonomous AI Hub & PostgreSQL Engine</span>
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl md:text-7xl bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent leading-[1.1]">
              Run your properties with calm precision.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400 sm:text-xl leading-relaxed">
              Lumina PMS unifies reservations, room availability, front desk operations, housekeeping, multi-currency
              billing, and guest communications — backed by schema-level double-booking protection and built-in AI.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-indigo-600 px-8 text-base font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500"
              >
                Start 14-Day Free Trial
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 w-full sm:w-auto items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 px-8 text-base font-semibold text-slate-200 backdrop-blur-sm transition hover:bg-slate-800 hover:text-white"
              >
                Sign In to Workspace
              </Link>
            </div>

            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-indigo-400" /> PostgreSQL ACID Guarantee
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-indigo-400" /> Zero Double-Booking Guarantee
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-indigo-400" /> Multi-Property Native
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-indigo-400" /> No Credit Card Required
              </span>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section id="features" className="border-t border-slate-800/80 bg-slate-900/40 py-24 sm:py-32">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-base font-semibold uppercase tracking-wider text-indigo-400">
                Core Operations Platform
              </h2>
              <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Everything you need to orchestrate modern hospitality
              </p>
              <p className="mt-4 text-base text-slate-400">
                Designed from the ground up for boutique hotels, resorts, and multi-unit hospitality operators.
              </p>
            </div>

            <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {/* Feature 1 */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-8 shadow-sm transition hover:border-slate-700">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-white">Interactive Visual Calendar</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  Real-time tape chart view with date navigation, occupancy indicators, and instant visual status
                  (clean, dirty, inspected, occupied) across all rooms.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-8 shadow-sm transition hover:border-slate-700">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600/10 text-violet-400">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-white">Double-Booking Shield</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  Engineered with PostgreSQL-enforced composite unique constraints (<code className="text-xs text-violet-300">RoomNight(roomId, date)</code>),
                  mathematically guaranteeing zero double bookings under heavy concurrent load.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-8 shadow-sm transition hover:border-slate-700">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-600/10 text-sky-400">
                  <BedDouble className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-white">Front Desk & Fast Check-In</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  One-click guest check-in and checkout, balance verification, key issuance notes, ID document
                  inspection, and instant walk-in booking creation.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-8 shadow-sm transition hover:border-slate-700">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-400">
                  <CreditCard className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-white">Billing & Payments Engine</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  Server-side calculated folios with exact Decimal(12, 2) arithmetic, line item additions, split
                  payments, Stripe gateway webhooks, and invoice generation.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-8 shadow-sm transition hover:border-slate-700">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-600/10 text-amber-400">
                  <Building2 className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-white">Multi-Property Management</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  Manage multiple boutique properties under one organization with distinct timezones, local
                  currencies, custom tax structures, and isolated staff permissions.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-8 shadow-sm transition hover:border-slate-700">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-600/10 text-rose-400">
                  <Clock className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-white">Housekeeping & Maintenance</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  Automated turnaround task creation upon guest checkout, priority queues, room defect tickets, and
                  mobile-friendly staff execution updates.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* AI Hub Section */}
        <section id="ai-hub" className="py-24 sm:py-32 relative overflow-hidden">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3.5 py-1 text-xs font-medium text-violet-300">
                  <Bot className="h-3.5 w-3.5 text-violet-400" />
                  <span>Next-Generation Hospitality Intelligence</span>
                </div>
                <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Autonomous AI Operations with Human-in-the-Loop Safeguards
                </h2>
                <p className="mt-4 text-base text-slate-400 leading-relaxed">
                  Lumina PMS is built from the core with an enterprise AI Hub. Run autonomous operations agents that
                  search reservations, assign rooms, and create tasks — while requiring manager approval for financial
                  actions like cancellations and refunds.
                </p>

                <dl className="mt-8 space-y-4">
                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600/20 text-violet-400">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <dt className="text-sm font-semibold text-white">Multi-Provider AI Flexibility</dt>
                      <dd className="mt-1 text-sm text-slate-400">
                        Connect OpenAI, Anthropic Claude, Google Gemini, or Groq using your own API keys with AES-256-GCM encryption.
                      </dd>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600/20 text-violet-400">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <dt className="text-sm font-semibold text-white">Full-Text Search (RAG) Guest Chatbot</dt>
                      <dd className="mt-1 text-sm text-slate-400">
                        24/7 guest concierge chatbot grounded in your property knowledge base documents via PostgreSQL tsvector GIN indexes.
                      </dd>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600/20 text-violet-400">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <dt className="text-sm font-semibold text-white">Granular Approval Policy Engine</dt>
                      <dd className="mt-1 text-sm text-slate-400">
                        Sensitive actions pause automatically into an Approval Queue for staff verification before executing.
                      </dd>
                    </div>
                  </div>
                </dl>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-sm">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-rose-500/80" />
                    <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                    <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 text-xs font-mono text-slate-500">lumina-ai-agent-v2</span>
                  </div>
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                    AWAITING APPROVAL
                  </span>
                </div>

                <div className="mt-4 space-y-3 font-mono text-xs">
                  <div className="rounded-lg bg-slate-950 p-3 text-slate-300">
                    <span className="text-indigo-400">Guest:</span> &quot;Can I get a late checkout on room 201 and schedule a deep cleaning turnaround?&quot;
                  </div>
                  <div className="rounded-lg bg-slate-950/80 p-3 text-slate-300 border border-slate-800">
                    <span className="text-violet-400">AI Agent:</span> Executing tool <span className="text-amber-400">create_housekeeping_task</span>
                    <div className="mt-1 text-slate-500">
                      Target: Room 201 (Deluxe King) • Priority: High • Tenant: Scoped
                    </div>
                  </div>
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200">
                    <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5" /> Sensitive Action Flagged: Refund / Rate Override
                    </div>
                    <div className="mt-1 text-[11px] text-amber-200/80">
                      Requires manager approval. Approval request #appr_891 created for staff review.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Security & Multi-Tenancy */}
        <section id="security" className="border-t border-slate-800/80 bg-slate-900/30 py-24 sm:py-32">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-base font-semibold uppercase tracking-wider text-indigo-400">
                Security & Data Integrity
              </h2>
              <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Enterprise tenant isolation by default
              </p>
              <p className="mt-4 text-base text-slate-400">
                Lumina PMS guarantees complete logical isolation between organizations and granular property-level
                access controls.
              </p>
            </div>

            <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">
                <Lock className="h-6 w-6 text-indigo-400" />
                <h3 className="mt-4 text-base font-semibold text-white">Tenant-Scoped DAL</h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  Every database mutation and query is forced through our tenant Data Access Layer with strict
                  organizationId scoping.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">
                <ShieldCheck className="h-6 w-6 text-indigo-400" />
                <h3 className="mt-4 text-base font-semibold text-white">Rate-Limited & Hardened</h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  Brute-force protection, sliding-window rate limiters, SHA-256 hashed password resets, and strict CSRF
                  origin validation.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">
                <Layers className="h-6 w-6 text-indigo-400" />
                <h3 className="mt-4 text-base font-semibold text-white">Role-Based Access (RBAC)</h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  Granular permission matrix (Admin, Manager, Front Desk, Housekeeping, Customer) enforcing both
                  organization and property access.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">
                <Users className="h-6 w-6 text-indigo-400" />
                <h3 className="mt-4 text-base font-semibold text-white">Audit Logging Trail</h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  Every state change, booking modification, invoice creation, and payment capture is recorded with user
                  attribution and timestamps.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-24 sm:py-32">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-base font-semibold uppercase tracking-wider text-indigo-400">Simple Pricing</h2>
              <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Transparent plans for every hospitality stage
              </p>
              <p className="mt-4 text-base text-slate-400">
                All plans include our core PostgreSQL double-booking shield and unlimited staff members.
              </p>
            </div>

            <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-3">
              {/* Tier 1 */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-8">
                <h3 className="text-lg font-semibold text-white">Boutique Starter</h3>
                <p className="mt-1 text-sm text-slate-400">For independent bed & breakfasts and boutique hotels.</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">$99</span>
                  <span className="text-sm text-slate-400">/month</span>
                </div>
                <ul className="mt-6 space-y-3 text-sm text-slate-300">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-indigo-400" /> Up to 25 rooms</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-indigo-400" /> 1 Property Location</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-indigo-400" /> Interactive Tape Chart Calendar</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-indigo-400" /> Front Desk & Housekeeping</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-indigo-400" /> Unlimited Staff Accounts</li>
                </ul>
                <Link
                  href="/register"
                  className="mt-8 block w-full rounded-lg border border-slate-800 bg-slate-900 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Start 14-Day Free Trial
                </Link>
              </div>

              {/* Tier 2 (Featured) */}
              <div className="relative rounded-2xl border-2 border-indigo-500 bg-slate-900/90 p-8 shadow-xl shadow-indigo-500/10">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-semibold text-white uppercase tracking-wider">
                  Most Popular
                </div>
                <h3 className="text-lg font-semibold text-white">Professional Operator</h3>
                <p className="mt-1 text-sm text-slate-400">For multi-unit properties and growing boutique groups.</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">$249</span>
                  <span className="text-sm text-slate-400">/month</span>
                </div>
                <ul className="mt-6 space-y-3 text-sm text-slate-300">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-indigo-400" /> Up to 100 rooms</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-indigo-400" /> Up to 5 Properties</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-indigo-400" /> Autonomous AI Operations Hub</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-indigo-400" /> 24/7 FTS Guest Chatbot</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-indigo-400" /> Automated Billing & Stripe Gateway</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-indigo-400" /> Manager Approval Queues</li>
                </ul>
                <Link
                  href="/register"
                  className="mt-8 block w-full rounded-lg bg-indigo-600 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-indigo-600/30 transition hover:bg-indigo-500"
                >
                  Start 14-Day Free Trial
                </Link>
              </div>

              {/* Tier 3 */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-8">
                <h3 className="text-lg font-semibold text-white">Resort Enterprise</h3>
                <p className="mt-1 text-sm text-slate-400">For hotel chains, luxury resorts, and high-volume operations.</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">Custom</span>
                </div>
                <ul className="mt-6 space-y-3 text-sm text-slate-300">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-indigo-400" /> Unlimited Rooms & Properties</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-indigo-400" /> Custom AI Provider Integrations</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-indigo-400" /> Dedicated Account Manager & 99.99% SLA</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-indigo-400" /> Custom Webhooks & Channel Manager</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-indigo-400" /> Full Audit Log Export & SIEM Feed</li>
                </ul>
                <Link
                  href="/register"
                  className="mt-8 block w-full rounded-lg border border-slate-800 bg-slate-900 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Contact Sales
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="border-t border-slate-800/80 bg-slate-900/30 py-24 sm:py-32">
          <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold tracking-tight text-white text-center sm:text-4xl">
              Frequently Asked Questions
            </h2>

            <div className="mt-12 space-y-6">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">
                <h3 className="text-base font-semibold text-white">How does Lumina prevent double-bookings?</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  Unlike legacy PMS systems that perform soft read-then-write checks in application memory, Lumina
                  implements a dedicated <code className="text-xs text-indigo-400">RoomNight</code> inventory model with a composite unique
                  constraint on <code className="text-xs text-indigo-400">(roomId, date)</code> in PostgreSQL. If two staff or guests attempt to book
                  the exact same room for the same night at the same millisecond, the database engine transactionally
                  enforces that exactly one succeeds and the other receives an immediate conflict notice.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">
                <h3 className="text-base font-semibold text-white">Can I manage multiple properties with different currencies?</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  Yes! Lumina PMS is built with first-class multi-property support. Each property within your
                  organization configures its own local timezone (e.g. Europe/Lisbon, America/New_York), base
                  currency (EUR, USD, GBP), check-in/checkout hours, and municipal tax rates.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">
                <h3 className="text-base font-semibold text-white">How does the AI Hub ensure safety?</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  Our AI Hub follows a strict Policy-Driven Execution Model. Routine, read-only tools (such as searching
                  availability or listing housekeeping status) execute in real-time. Sensitive operations (such as rate
                  discounts, reservation cancellations, or refunds) are automatically routed into an Approval Request
                  Queue where a human manager must approve or reject the request before any state changes occur.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">
                <h3 className="text-base font-semibold text-white">Can I bring my own AI provider keys?</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  Absolutely. Lumina PMS includes native adapters for OpenAI, Anthropic Claude, Google Gemini, and Groq.
                  Your API keys are encrypted at rest using AES-256-GCM and never exposed to the client or leaked in logs.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="py-20 bg-gradient-to-r from-indigo-950 via-slate-950 to-violet-950 border-t border-b border-indigo-900/40">
          <div className="container mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to elevate your property operations?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-slate-400">
              Join modern hoteliers who trust Lumina PMS for calm, error-free reservations and intelligent guest service.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-indigo-600 px-8 text-base font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500"
              >
                Create Your Account
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-12 text-sm text-slate-500">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-indigo-600 text-white text-xs font-bold">
              L
            </span>
            <span className="font-semibold text-slate-300">Lumina PMS</span>
            <span>&copy; {new Date().getFullYear()} Lumina Hospitality Technologies Inc. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-slate-400 transition">
              Staff Sign In
            </Link>
            <Link href="/register" className="hover:text-slate-400 transition">
              Start Free Trial
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
