"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  MessageSquare,
  Bot,
  Calendar,
  Globe,
  Lock,
  KeyRound,
  Star,
  Zap,
  Clock,
  ChevronDown,
  Building2,
  Eye,
  Check,
  RefreshCw,
  Compass,
  Home,
  CreditCard,
} from "lucide-react";

export default function LandingPage() {
  // Interactive Inbox Simulation State
  const [activeScenario, setActiveScenario] = React.useState<"early_checkin" | "wifi" | "late_checkout" | "pet_policy">("early_checkin");
  const [autopilotMode, setAutopilotMode] = React.useState(true);

  // Interactive ROI Calculator State
  const [propertyCount, setPropertyCount] = React.useState(5);

  // Pricing Interval Toggle
  const [annualBilling, setAnnualBilling] = React.useState(true);

  // FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = React.useState<number | null>(0);

  // Tabbed Feature Showcase State
  const [activeFeatureTab, setActiveFeatureTab] = React.useState<"inbox" | "channel" | "operations" | "direct" | "smartlocks">("inbox");

  // Calculations for ROI Calculator
  const hoursSavedPerWeek = Math.round(propertyCount * 3.8);
  const hoursSavedPerYear = hoursSavedPerWeek * 52;
  const directBookingSavings = Math.round(propertyCount * 420);

  const scenarios = {
    early_checkin: {
      guestName: "Sarah Jenkins",
      channel: "Airbnb",
      time: "10:14 AM",
      property: "Azure Royal Penthouse · Miami, FL",
      guestMessage: "Hi there! Our flight lands early around 11:30 AM. Is there any chance we can check in a couple of hours early?",
      aiResponse: "Hi Sarah! Welcome to Miami. I checked with our housekeeping team, and the Azure Penthouse is already fully sanitized and inspected. You're all set for early check-in at 11:30 AM! Your smart lock code (last 4 digits of your phone: 4821) has been activated. Enjoy your stay!",
      context: "Housekeeping: Clean & Inspected at 9:45 AM. Smart Lock: Active. Gap: None.",
      confidence: "99.4% Match",
    },
    wifi: {
      guestName: "Marcus Vance",
      channel: "Vrbo",
      time: "3:42 PM",
      property: "Whispering Pines Chalet · Aspen, CO",
      guestMessage: "Hey, we just arrived! What's the network name and password for the high-speed Wi-Fi in the main cabin?",
      aiResponse: "Welcome Marcus! The Wi-Fi network is 'Pines-Guest-5G' and the password is 'StayCozy2026!'. The router is located next to the living room media console. Let me know if you need any recommendations for dinner tonight!",
      context: "House Rule Verified: High-speed fiber active. Credentials verified.",
      confidence: "99.8% Match",
    },
    late_checkout: {
      guestName: "Elena Rostova",
      channel: "Booking.com",
      time: "8:05 PM",
      property: "Oceanview Sanctuary · San Diego, CA",
      guestMessage: "Good evening! We have an afternoon conference tomorrow. Would it be possible to extend our checkout from 11 AM to 1:30 PM?",
      aiResponse: "Good evening Elena! We don't have another guest checking in until Wednesday, so we're happy to grant you a complimentary late checkout until 1:30 PM. Take your time packing and safe travels on your conference!",
      context: "Calendar Check: Next check-in is 48h away. Turnover auto-rescheduled to 2:00 PM.",
      confidence: "98.9% Match",
    },
    pet_policy: {
      guestName: "David Miller",
      channel: "Direct Booking",
      time: "1:22 PM",
      property: "Cedar Ridge Lodge · Lake Tahoe, NV",
      guestMessage: "Hello! We're looking at booking for 4 nights next month. Do you allow well-behaved Golden Retrievers?",
      aiResponse: "Hi David! Yes, Cedar Ridge Lodge is 100% dog-friendly for up to 2 trained dogs. There is a standard $50 pet sanitation fee per stay, and we even provide water bowls and dog treats upon arrival. Let me know if you'd like me to hold your dates!",
      context: "Pet Policy Rule: Allowed (max 2). Fee: $50 one-time.",
      confidence: "99.6% Match",
    },
  };

  const faqs = [
    {
      q: "Does Hospitable's AI sound robotic or like a real human host?",
      a: "Our conversational AI is specifically trained on short-term rental hospitality data and your custom property rules. It speaks with the natural, warm, and professional tone of an experienced host, references your exact amenities and house rules, and knows when to escalate complex edge cases to you.",
    },
    {
      q: "How does Hospitable prevent double-bookings across Airbnb, Vrbo, and Booking.com?",
      a: "Hospitable uses sub-second, direct-API synchronization combined with hardware-grade PostgreSQL database constraints. The instant a reservation or hold is placed on any channel, those dates are atomically blocked across all other connected calendars in milliseconds.",
    },
    {
      q: "Do my cleaners or maintenance staff need to download an app or pay for an account?",
      a: "No! Cleaners receive instant notifications via SMS and email with a secure web link that requires zero logins or app downloads. They can view turnover schedules, check off cleaning checklists, upload verification photos, and flag maintenance issues directly on any smartphone.",
    },
    {
      q: "How do Direct Booking Websites handle payments, damage protection, and guest screening?",
      a: "Hospitable provides a turnkey direct booking engine integrated with Stripe. You can accept credit cards with zero commission fees, automatically pre-authorize security deposits, enforce signed digital rental agreements, and verify guest identities before confirming.",
    },
    {
      q: "Which smart lock hardware is compatible with Hospitable?",
      a: "We natively integrate with over 100 smart lock models including Schlage, Yale, August, RemoteLock, and Kwikset. Hospitable automatically generates a unique time-sensitive PIN (usually matching the last 4 digits of the guest's phone) that activates at check-in and deactivates at check-out.",
    },
    {
      q: "Can I try Hospitable without entering a credit card?",
      a: "Yes! You can start a full-featured 14-day free trial in less than 7 minutes with zero credit card required. Connect your listings, test automated messaging, and see how much time you save before deciding on a plan.",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#090D16] text-slate-100 selection:bg-violet-600 selection:text-white font-sans antialiased">
      {/* Top Announcement Bar */}
      <div className="relative z-50 border-b border-violet-500/20 bg-gradient-to-r from-violet-950/70 via-purple-900/40 to-slate-950 px-4 py-2 text-center text-xs font-medium text-violet-200">
        <div className="container mx-auto flex items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-[11px] font-semibold text-violet-300 border border-violet-500/30">
            <Sparkles className="h-3 w-3" strokeWidth={1.5} />
            Hospitable AI 2.0
          </span>
          <span>Trusted by 500,000+ short-term rental hosts worldwide.</span>
          <Link
            href="/register"
            className="hidden sm:inline-flex items-center gap-1 font-semibold text-white underline underline-offset-4 hover:text-violet-300 transition"
          >
            Start your 14-day free trial
            <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
          </Link>
        </div>
      </div>

      {/* Main Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#090D16]/90 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo with Hospitable Grape Branding */}
          <Link href="/" className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-700 via-purple-600 to-indigo-500 text-white shadow-lg shadow-violet-700/30 border border-violet-400/20">
              <Compass className="h-5 w-5" strokeWidth={1.5} />
            </span>
            <span className="text-white font-semibold tracking-tight text-lg">
              Hospitable<span className="text-violet-400">.</span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-7 lg:flex">
            <a href="#features" className="text-sm font-medium text-slate-300 transition hover:text-white">
              Features
            </a>
            <a href="#unified-inbox" className="text-sm font-medium text-slate-300 transition hover:text-white">
              Unified Inbox
            </a>
            <a href="#calculator" className="text-sm font-medium text-slate-300 transition hover:text-white">
              ROI Calculator
            </a>
            <a href="#pricing" className="text-sm font-medium text-slate-300 transition hover:text-white">
              Pricing
            </a>
            <a href="#faq" className="text-sm font-medium text-slate-300 transition hover:text-white">
              FAQ
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-300 transition hover:text-white px-3 py-2"
            >
              Log In
            </Link>
            <Link
              href="/register"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 px-4 text-sm font-semibold text-white shadow-md shadow-violet-600/30 transition hover:from-violet-500 hover:to-purple-500 border border-violet-400/20"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32">
          {/* Subtle Ambient Background Gradients */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -z-10 h-[500px] w-full max-w-7xl bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(124,58,237,0.22),rgba(9,13,22,0))]" />
          <div className="absolute top-48 left-1/4 -z-10 h-72 w-72 rounded-full bg-violet-600/10 blur-[100px]" />
          <div className="absolute top-64 right-1/4 -z-10 h-72 w-72 rounded-full bg-purple-600/10 blur-[100px]" />

          <div className="container mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
            {/* Tagline Pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-xs font-semibold text-violet-300 mb-8 backdrop-blur-md shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" strokeWidth={1.5} />
              <span>The Operating System for Short-Term Rental Professionals</span>
            </div>

            {/* Master Headline */}
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl md:text-7xl bg-gradient-to-b from-white via-slate-100 to-slate-300 bg-clip-text text-transparent leading-[1.08] max-w-4xl mx-auto">
              Put your short-term rentals on autopilot.
            </h1>

            {/* Subtitle */}
            <p className="mx-auto mt-6 max-w-3xl text-lg text-slate-300 sm:text-xl leading-relaxed">
              Automate 90% of guest messaging with AI that sounds human, sync calendars across Airbnb, Vrbo, Booking.com,
              and direct bookings with zero double-bookings, and coordinate turnovers automatically.
            </p>

            {/* Dual CTAs */}
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 px-8 text-base font-semibold text-white shadow-xl shadow-violet-600/30 transition hover:from-violet-500 hover:to-indigo-500 border border-violet-400/25"
              >
                Start 14-Day Free Trial
                <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
              </Link>
              <a
                href="#unified-inbox"
                className="inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 text-base font-medium text-slate-200 backdrop-blur-sm transition hover:bg-white/10 hover:text-white"
              >
                <Eye className="h-4 w-4 text-violet-400" strokeWidth={1.5} />
                Explore Interactive Demo
              </a>
            </div>

            {/* Trust Micro-Copy */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-medium">
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-violet-400" strokeWidth={1.5} />
                No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-violet-400" strokeWidth={1.5} />
                Connect listings in 7 minutes
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-violet-400" strokeWidth={1.5} />
                Cancel anytime
              </span>
            </div>
          </div>

          {/* Master Hero Visual: Interactive Unified Command Center */}
          <div className="container mx-auto mt-16 max-w-6xl px-4 sm:px-6 lg:px-8" id="unified-inbox">
            <div className="rounded-2xl border border-violet-500/20 bg-[#0F1424]/90 p-4 sm:p-6 shadow-2xl shadow-violet-950/50 backdrop-blur-xl">
              {/* Top Window Bar */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-4 mb-6">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-rose-500/80 inline-block" />
                    <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
                    <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
                  </div>
                  <span className="ml-2 font-mono text-xs text-slate-400">
                    hospitable-hub // unified-inbox // live-sync
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1 text-xs border border-white/5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-slate-300 font-medium">Sub-Second Calendar Sync Active</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutopilotMode((v) => !v)}
                    className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300 transition hover:bg-violet-500/20"
                  >
                    <Zap className={`h-3.5 w-3.5 ${autopilotMode ? "text-violet-400 fill-violet-400/20" : "text-slate-400"}`} strokeWidth={1.5} />
                    <span>Autopilot: {autopilotMode ? "ON" : "REVIEW"}</span>
                  </button>
                </div>
              </div>

              {/* Interactive Scenario Selector */}
              <div className="mb-6 flex flex-wrap gap-2">
                <span className="text-xs text-slate-400 self-center mr-1">Select Guest Scenario:</span>
                <button
                  type="button"
                  onClick={() => setActiveScenario("early_checkin")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    activeScenario === "early_checkin"
                      ? "bg-violet-600 text-white shadow-sm shadow-violet-600/30"
                      : "bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  Early Check-In Request
                </button>
                <button
                  type="button"
                  onClick={() => setActiveScenario("wifi")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    activeScenario === "wifi"
                      ? "bg-violet-600 text-white shadow-sm shadow-violet-600/30"
                      : "bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  Wi-Fi & Amenities
                </button>
                <button
                  type="button"
                  onClick={() => setActiveScenario("late_checkout")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    activeScenario === "late_checkout"
                      ? "bg-violet-600 text-white shadow-sm shadow-violet-600/30"
                      : "bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  Late Checkout Inquiry
                </button>
                <button
                  type="button"
                  onClick={() => setActiveScenario("pet_policy")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    activeScenario === "pet_policy"
                      ? "bg-violet-600 text-white shadow-sm shadow-violet-600/30"
                      : "bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  Pet Policy & Fee
                </button>
              </div>

              {/* Dual-Pane Interface */}
              <div className="grid gap-6 lg:grid-cols-12">
                {/* Left: Chat & AI Reply Simulator (8 cols) */}
                <div className="lg:col-span-8 flex flex-col rounded-xl border border-white/5 bg-[#0A0E1A] p-4 sm:p-5">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-900/40 text-violet-300 font-semibold text-sm border border-violet-500/20">
                        {scenarios[activeScenario].guestName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-sm">
                            {scenarios[activeScenario].guestName}
                          </span>
                          <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-300 border border-violet-500/20">
                            {scenarios[activeScenario].channel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {scenarios[activeScenario].property}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500">
                      {scenarios[activeScenario].time}
                    </span>
                  </div>

                  {/* Messages Flow */}
                  <div className="space-y-4 flex-1">
                    {/* Guest Message */}
                    <div className="flex gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs text-slate-300 font-medium">
                        G
                      </div>
                      <div className="max-w-xl rounded-2xl rounded-tl-sm bg-slate-800/80 px-4 py-3 text-sm text-slate-100 border border-white/5">
                        {scenarios[activeScenario].guestMessage}
                      </div>
                    </div>

                    {/* AI Autonomous Answer */}
                    <div className="flex gap-3 justify-end">
                      <div className="max-w-xl rounded-2xl rounded-tr-sm bg-gradient-to-r from-violet-950/80 to-purple-950/80 px-4 py-3 text-sm text-slate-100 border border-violet-500/30 shadow-md">
                        <div className="flex items-center gap-1.5 text-xs text-violet-300 font-semibold mb-1">
                          <Sparkles className="h-3 w-3" strokeWidth={1.5} />
                          Hospitable Autonomous AI Response
                        </div>
                        <p className="leading-relaxed">{scenarios[activeScenario].aiResponse}</p>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-white/5 pt-1.5">
                          <span>Verified against property house rules</span>
                          <span className="text-emerald-400 font-medium">
                            {scenarios[activeScenario].confidence}
                          </span>
                        </div>
                      </div>
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs text-white font-medium shadow-md shadow-violet-600/50">
                        <Bot className="h-4 w-4" strokeWidth={1.5} />
                      </div>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-3">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      <span>{scenarios[activeScenario].context}</span>
                    </div>
                    <span className="text-xs font-medium text-violet-400">
                      Auto-dispatched via {scenarios[activeScenario].channel} API in 4s
                    </span>
                  </div>
                </div>

                {/* Right: Real-time Property & Sync HUD (4 cols) */}
                <div className="lg:col-span-4 flex flex-col gap-4">
                  {/* Channel Sync Card */}
                  <div className="rounded-xl border border-white/5 bg-[#0A0E1A] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Channel Sync Status
                      </h4>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.5} />
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between py-1 border-b border-white/5">
                        <span className="text-slate-300 font-medium">Airbnb Calendar</span>
                        <span className="text-emerald-400">Synced · 0.2s ago</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-white/5">
                        <span className="text-slate-300 font-medium">Vrbo Calendar</span>
                        <span className="text-emerald-400">Synced · 0.3s ago</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-white/5">
                        <span className="text-slate-300 font-medium">Booking.com</span>
                        <span className="text-emerald-400">Synced · 0.4s ago</span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-300 font-medium">Direct Booking Engine</span>
                        <span className="text-emerald-400">Instant</span>
                      </div>
                    </div>
                  </div>

                  {/* Smart Lock Automation Card */}
                  <div className="rounded-xl border border-white/5 bg-[#0A0E1A] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Smart Lock Automation
                      </h4>
                      <Lock className="h-3.5 w-3.5 text-violet-400" strokeWidth={1.5} />
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Hardware:</span>
                        <span className="text-white font-medium">Yale Assure 2 (Z-Wave)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Assigned PIN:</span>
                        <span className="font-mono text-emerald-400 font-semibold">•••• 4821</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Access Window:</span>
                        <span className="text-slate-300">11:30 AM – 11:00 AM</span>
                      </div>
                      <div className="mt-2 text-[11px] text-slate-500">
                        Code auto-generated & sent upon confirmed booking. Deactivates strictly at checkout.
                      </div>
                    </div>
                  </div>

                  {/* Operations Card */}
                  <div className="rounded-xl border border-white/5 bg-[#0A0E1A] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Turnover & Housekeeping
                      </h4>
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" strokeWidth={1.5} />
                    </div>
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Cleaner Assigned:</span>
                        <span className="text-white">Maria Sanchez (SMS notified)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Inspection Status:</span>
                        <span className="text-emerald-400 font-medium">100% Passed</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Partner Ecosystem & Connectivity Badges */}
        <section className="border-y border-white/5 bg-[#0A0D18] py-12">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="text-center text-xs font-semibold tracking-wider text-slate-400 uppercase mb-8">
              Official Preferred Software Partner with the World&apos;s Leading Booking Channels
            </p>

            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6 items-center text-center">
              <div className="flex flex-col items-center justify-center p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                <Globe className="h-6 w-6 text-rose-400 mb-1" strokeWidth={1.5} />
                <span className="text-xs font-semibold text-slate-200">Airbnb</span>
                <span className="text-[10px] text-slate-400">Preferred Partner</span>
              </div>
              <div className="flex flex-col items-center justify-center p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                <Home className="h-6 w-6 text-blue-400 mb-1" strokeWidth={1.5} />
                <span className="text-xs font-semibold text-slate-200">Vrbo</span>
                <span className="text-[10px] text-slate-400">Elite Connectivity</span>
              </div>
              <div className="flex flex-col items-center justify-center p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                <Building2 className="h-6 w-6 text-indigo-400 mb-1" strokeWidth={1.5} />
                <span className="text-xs font-semibold text-slate-200">Booking.com</span>
                <span className="text-[10px] text-slate-400">Premier Partner</span>
              </div>
              <div className="flex flex-col items-center justify-center p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                <Globe className="h-6 w-6 text-emerald-400 mb-1" strokeWidth={1.5} />
                <span className="text-xs font-semibold text-slate-200">Google</span>
                <span className="text-[10px] text-slate-400">Vacation Rentals</span>
              </div>
              <div className="flex flex-col items-center justify-center p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                <CreditCard className="h-6 w-6 text-violet-400 mb-1" strokeWidth={1.5} />
                <span className="text-xs font-semibold text-slate-200">Stripe</span>
                <span className="text-[10px] text-slate-400">Direct Payments</span>
              </div>
              <div className="flex flex-col items-center justify-center p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                <Lock className="h-6 w-6 text-amber-400 mb-1" strokeWidth={1.5} />
                <span className="text-xs font-semibold text-slate-200">Smart Locks</span>
                <span className="text-[10px] text-slate-400">100+ Models</span>
              </div>
            </div>

            {/* Platform Metrics */}
            <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4 border-t border-white/5 pt-8 text-center">
              <div>
                <div className="text-3xl font-extrabold text-white">500,000+</div>
                <div className="text-xs text-slate-400 mt-1">Short-term listings managed</div>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-violet-400">92%</div>
                <div className="text-xs text-slate-400 mt-1">Guest questions automated</div>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-white">0</div>
                <div className="text-xs text-slate-400 mt-1">Double-bookings guarantee</div>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-emerald-400">4.9 / 5</div>
                <div className="text-xs text-slate-400 mt-1">Rating across Capterra & Trustpilot</div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Product Pillars / Interactive Showcase */}
        <section className="py-24" id="features">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-xs font-semibold tracking-wider text-violet-400 uppercase">
                Complete Operating System
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-white mt-3">
                Everything you need to scale your short-term rentals.
              </h2>
              <p className="mt-4 text-base text-slate-400">
                Replace 5 fragmented tools with one cohesive operating system designed specifically for hosts and property managers.
              </p>
            </div>

            {/* Feature Tabs */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
              <button
                type="button"
                onClick={() => setActiveFeatureTab("inbox")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  activeFeatureTab === "inbox"
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
                    : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                <MessageSquare className="h-4 w-4" strokeWidth={1.5} />
                Unified Inbox & AI
              </button>
              <button
                type="button"
                onClick={() => setActiveFeatureTab("channel")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  activeFeatureTab === "channel"
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
                    : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
                Channel Manager
              </button>
              <button
                type="button"
                onClick={() => setActiveFeatureTab("operations")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  activeFeatureTab === "operations"
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
                    : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                <Sparkles className="h-4 w-4" strokeWidth={1.5} />
                Turnover & Cleaners
              </button>
              <button
                type="button"
                onClick={() => setActiveFeatureTab("direct")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  activeFeatureTab === "direct"
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
                    : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                <Globe className="h-4 w-4" strokeWidth={1.5} />
                Direct Bookings
              </button>
              <button
                type="button"
                onClick={() => setActiveFeatureTab("smartlocks")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  activeFeatureTab === "smartlocks"
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
                    : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                <KeyRound className="h-4 w-4" strokeWidth={1.5} />
                Smart Locks
              </button>
            </div>

            {/* Tab Content Cards */}
            <div className="rounded-2xl border border-white/10 bg-[#0F1424] p-8 lg:p-12">
              {activeFeatureTab === "inbox" && (
                <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
                  <div>
                    <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300 border border-violet-500/20">
                      Unified Communications
                    </span>
                    <h3 className="text-2xl font-bold text-white sm:text-3xl mt-3">
                      One inbox for all your guests, backed by AI that never sleeps.
                    </h3>
                    <p className="mt-4 text-slate-300 leading-relaxed text-sm sm:text-base">
                      No more switching between Airbnb, Vrbo, Booking.com, and email apps. Hospitable unifies every message into a clean, searchable feed.
                    </p>
                    <ul className="mt-6 space-y-3 text-sm text-slate-300">
                      <li className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-violet-400 mt-1 shrink-0" strokeWidth={1.5} />
                        <span><strong>Trained on your listing:</strong> Answers questions about parking, Wi-Fi, heating, and check-in rules automatically.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-violet-400 mt-1 shrink-0" strokeWidth={1.5} />
                        <span><strong>Scheduled messaging triggers:</strong> Auto-send booking confirmations, check-in codes, mid-stay checkups, and review requests.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-violet-400 mt-1 shrink-0" strokeWidth={1.5} />
                        <span><strong>Host review mode:</strong> Autopilot can either draft responses for 1-click review or reply autonomously.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-[#0A0D18] p-5 font-sans">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                      Automated Message Lifecycle
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-lg bg-white/5 p-3 text-xs border border-white/5">
                        <div className="flex justify-between font-semibold text-slate-200">
                          <span>1. Immediate Confirmation</span>
                          <span className="text-violet-400">Trigger: Booking</span>
                        </div>
                        <p className="text-slate-400 mt-1">Confirms stay, sends house rules, and prompts for ID verification.</p>
                      </div>
                      <div className="rounded-lg bg-white/5 p-3 text-xs border border-white/5">
                        <div className="flex justify-between font-semibold text-slate-200">
                          <span>2. Pre-Arrival Guide</span>
                          <span className="text-violet-400">Trigger: Check-in - 48h</span>
                        </div>
                        <p className="text-slate-400 mt-1">Provides directions, parking instructions, and early check-in options.</p>
                      </div>
                      <div className="rounded-lg bg-white/5 p-3 text-xs border border-white/5">
                        <div className="flex justify-between font-semibold text-slate-200">
                          <span>3. Smart Door Access</span>
                          <span className="text-violet-400">Trigger: Check-in Day</span>
                        </div>
                        <p className="text-slate-400 mt-1">Dispatches unique time-sensitive smart lock PIN and Wi-Fi password.</p>
                      </div>
                      <div className="rounded-lg bg-white/5 p-3 text-xs border border-white/5">
                        <div className="flex justify-between font-semibold text-slate-200">
                          <span>4. Checkout & Review Followup</span>
                          <span className="text-violet-400">Trigger: Checkout + 2h</span>
                        </div>
                        <p className="text-slate-400 mt-1">Thanks guest, finalizes folio, and invites them to leave a 5-star review.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeFeatureTab === "channel" && (
                <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
                  <div>
                    <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300 border border-violet-500/20">
                      Zero Double-Bookings
                    </span>
                    <h3 className="text-2xl font-bold text-white sm:text-3xl mt-3">
                      Direct 2-way sync across all channels in sub-seconds.
                    </h3>
                    <p className="mt-4 text-slate-300 leading-relaxed text-sm sm:text-base">
                      Never worry about double-bookings or mismatched rates again. When a date books on Airbnb, Hospitable blocks it on Vrbo, Booking.com, and your direct site instantly.
                    </p>
                    <ul className="mt-6 space-y-3 text-sm text-slate-300">
                      <li className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-violet-400 mt-1 shrink-0" strokeWidth={1.5} />
                        <span><strong>Sub-second API sync:</strong> Uses official platform APIs, not sluggish iCal calendars.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-violet-400 mt-1 shrink-0" strokeWidth={1.5} />
                        <span><strong>Database-level concurrency:</strong> PostgreSQL unique constraints physically prevent two guests from reserving the same night.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-violet-400 mt-1 shrink-0" strokeWidth={1.5} />
                        <span><strong>Gap night rule engine:</strong> Automatically adjusts minimum-night requirements to sell orphan calendar gaps.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-[#0A0D18] p-5 font-mono text-xs text-slate-300 space-y-3">
                    <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-white/5 font-sans">
                      <span>Live Channel Inventory Status</span>
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Check className="h-3 w-3" strokeWidth={1.5} />
                        Protected
                      </span>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                      <div className="text-violet-300 font-bold mb-1 font-sans">Booking Event Received:</div>
                      <div className="text-slate-400">Channel: Airbnb · Guest: Alexander Wright</div>
                      <div className="text-slate-400">Dates: Nov 12 - Nov 16 (4 nights)</div>
                    </div>
                    <div className="space-y-1.5 pl-2 border-l-2 border-violet-500/50">
                      <div className="text-emerald-400">✓ Atomic RoomNight rows inserted (4 nights locked)</div>
                      <div className="text-emerald-400">✓ Vrbo API calendar block pushed (latency: 180ms)</div>
                      <div className="text-emerald-400">✓ Booking.com OTA availability updated (latency: 220ms)</div>
                      <div className="text-emerald-400">✓ Direct Booking engine date disabled</div>
                    </div>
                  </div>
                </div>
              )}

              {activeFeatureTab === "operations" && (
                <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
                  <div>
                    <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300 border border-violet-500/20">
                      Team & Turnover Coordination
                    </span>
                    <h3 className="text-2xl font-bold text-white sm:text-3xl mt-3">
                      Cleaners and maintenance on complete autopilot.
                    </h3>
                    <p className="mt-4 text-slate-300 leading-relaxed text-sm sm:text-base">
                      Turnovers happen automatically as soon as a guest checks out. Assign tasks, track progress in real-time, and get photo proof of clean rooms.
                    </p>
                    <ul className="mt-6 space-y-3 text-sm text-slate-300">
                      <li className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-violet-400 mt-1 shrink-0" strokeWidth={1.5} />
                        <span><strong>No app needed for cleaners:</strong> Cleaners receive tasks via SMS and web link on any phone.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-violet-400 mt-1 shrink-0" strokeWidth={1.5} />
                        <span><strong>Photo verification & damage checklists:</strong> Require photo proof of cleaned areas and supply restocks.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-violet-400 mt-1 shrink-0" strokeWidth={1.5} />
                        <span><strong>Maintenance tickets & blocks:</strong> Take damaged rooms out of inventory immediately to prevent bookings during repairs.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-[#0A0D18] p-5">
                    <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                      <span className="text-xs font-semibold text-slate-300">Today&apos;s Turnover Schedule</span>
                      <span className="text-xs font-medium text-emerald-400">3 of 3 Completed</span>
                    </div>
                    <div className="space-y-2.5 text-xs">
                      <div className="rounded-lg bg-white/5 p-3 border border-white/5 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-white">Unit 102 · Aspen Pine Chalet</div>
                          <div className="text-slate-400">Assigned: Elena Rostova · Checkout 11:00 AM</div>
                        </div>
                        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-300 font-medium">
                          Inspected
                        </span>
                      </div>
                      <div className="rounded-lg bg-white/5 p-3 border border-white/5 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-white">Unit 304 · Azure Penthouse</div>
                          <div className="text-slate-400">Assigned: Carlos Mendez · Checkout 11:00 AM</div>
                        </div>
                        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-300 font-medium">
                          Inspected
                        </span>
                      </div>
                      <div className="rounded-lg bg-white/5 p-3 border border-white/5 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-white">Unit 208 · Coastal Haven</div>
                          <div className="text-slate-400">Assigned: Sarah Jenkins · Checkout 10:00 AM</div>
                        </div>
                        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-300 font-medium">
                          Inspected
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeFeatureTab === "direct" && (
                <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
                  <div>
                    <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300 border border-violet-500/20">
                      0% Commission Direct Bookings
                    </span>
                    <h3 className="text-2xl font-bold text-white sm:text-3xl mt-3">
                      Build your brand and keep 100% of your earnings.
                    </h3>
                    <p className="mt-4 text-slate-300 leading-relaxed text-sm sm:text-base">
                      Stop paying 15% to 20% in platform commissions. Launch a stunning, mobile-optimized direct booking website in minutes with integrated payments.
                    </p>
                    <ul className="mt-6 space-y-3 text-sm text-slate-300">
                      <li className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-violet-400 mt-1 shrink-0" strokeWidth={1.5} />
                        <span><strong>Built-in Stripe checkout:</strong> Process payments, deposits, and security authorizations seamlessly.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-violet-400 mt-1 shrink-0" strokeWidth={1.5} />
                        <span><strong>Google Vacation Rentals:</strong> Automatically showcase your properties on Google with zero fees.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-violet-400 mt-1 shrink-0" strokeWidth={1.5} />
                        <span><strong>Guest screening & contracts:</strong> Enforce ID verification and signed digital terms before confirming.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-[#0A0D18] p-5">
                    <div className="rounded-lg border border-white/10 bg-slate-900 p-4">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                        <span className="text-xs font-bold text-white">Direct Booking Savings Example</span>
                        <span className="text-xs text-emerald-400 font-semibold">+18.5% Revenue</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between text-slate-400">
                          <span>Average 4-night stay:</span>
                          <span className="text-white">$1,600.00</span>
                        </div>
                        <div className="flex justify-between text-rose-400">
                          <span>OTA Platform Commissions (18%):</span>
                          <span>-$288.00</span>
                        </div>
                        <div className="flex justify-between text-slate-400 border-t border-white/5 pt-2">
                          <span>Hospitable Direct Booking Fee:</span>
                          <span className="text-white font-mono">$0.00 (0%)</span>
                        </div>
                        <div className="flex justify-between text-emerald-400 font-bold border-t border-white/5 pt-2">
                          <span>You Keep:</span>
                          <span>$1,600.00</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeFeatureTab === "smartlocks" && (
                <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
                  <div>
                    <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300 border border-violet-500/20">
                      Hardware & Smart Devices
                    </span>
                    <h3 className="text-2xl font-bold text-white sm:text-3xl mt-3">
                      Automated keyless entry that works like magic.
                    </h3>
                    <p className="mt-4 text-slate-300 leading-relaxed text-sm sm:text-base">
                      No more meeting guests with physical keys or changing lockbox codes manually. Hospitable connects directly to your smart locks.
                    </p>
                    <ul className="mt-6 space-y-3 text-sm text-slate-300">
                      <li className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-violet-400 mt-1 shrink-0" strokeWidth={1.5} />
                        <span><strong>Unique guest door codes:</strong> Generated automatically using the last 4 digits of the guest&apos;s phone number.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-violet-400 mt-1 shrink-0" strokeWidth={1.5} />
                        <span><strong>Time-restricted security:</strong> Code only functions between official check-in and checkout times.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-violet-400 mt-1 shrink-0" strokeWidth={1.5} />
                        <span><strong>100+ lock integrations:</strong> Supports Schlage, Yale, August, RemoteLock, Kwikset, Nuki, and Igloohome.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-[#0A0D18] p-5">
                    <div className="text-xs font-semibold text-slate-300 mb-3">Compatible Smart Hardware</div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-white/5 rounded-lg border border-white/5 flex items-center gap-2">
                        <Lock className="h-4 w-4 text-violet-400 shrink-0" strokeWidth={1.5} />
                        <span>Schlage Encode</span>
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg border border-white/5 flex items-center gap-2">
                        <Lock className="h-4 w-4 text-violet-400 shrink-0" strokeWidth={1.5} />
                        <span>Yale Assure 2</span>
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg border border-white/5 flex items-center gap-2">
                        <Lock className="h-4 w-4 text-violet-400 shrink-0" strokeWidth={1.5} />
                        <span>August Wi-Fi Smart Lock</span>
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg border border-white/5 flex items-center gap-2">
                        <Lock className="h-4 w-4 text-violet-400 shrink-0" strokeWidth={1.5} />
                        <span>RemoteLock Enterprise</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Interactive ROI & Time Saved Calculator */}
        <section className="border-t border-white/5 bg-[#0A0D18] py-20" id="calculator">
          <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-semibold tracking-wider text-violet-400 uppercase">
                Interactive Value Calculator
              </span>
              <h2 className="text-3xl font-extrabold text-white sm:text-4xl mt-2">
                Calculate your time saved with Hospitable.
              </h2>
              <p className="mt-3 text-sm text-slate-400">
                See exactly how many hours of manual messaging and cleaner coordination you will eliminate every single week.
              </p>
            </div>

            <div className="rounded-2xl border border-violet-500/20 bg-[#0F1424] p-6 sm:p-10 shadow-xl">
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <label htmlFor="property-slider" className="text-sm font-semibold text-white">
                    How many properties do you manage?
                  </label>
                  <span className="text-2xl font-extrabold text-violet-400">
                    {propertyCount} {propertyCount === 1 ? "Listing" : "Listings"}
                  </span>
                </div>
                <input
                  id="property-slider"
                  type="range"
                  min="1"
                  max="50"
                  value={propertyCount}
                  onChange={(e) => setPropertyCount(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-2">
                  <span>1 property</span>
                  <span>15 properties</span>
                  <span>30 properties</span>
                  <span>50+ properties</span>
                </div>
              </div>

              {/* Dynamic Metrics Output */}
              <div className="grid gap-6 sm:grid-cols-3 border-t border-white/5 pt-8 text-center">
                <div className="rounded-xl bg-white/[0.02] p-4 border border-white/5">
                  <Clock className="h-6 w-6 text-violet-400 mx-auto mb-2" strokeWidth={1.5} />
                  <div className="text-3xl font-black text-white">{hoursSavedPerWeek} hrs</div>
                  <div className="text-xs text-slate-400 mt-1">Saved per week on messaging</div>
                </div>

                <div className="rounded-xl bg-white/[0.02] p-4 border border-white/5">
                  <Calendar className="h-6 w-6 text-purple-400 mx-auto mb-2" strokeWidth={1.5} />
                  <div className="text-3xl font-black text-white">{hoursSavedPerYear.toLocaleString()} hrs</div>
                  <div className="text-xs text-slate-400 mt-1">Saved every single year</div>
                </div>

                <div className="rounded-xl bg-white/[0.02] p-4 border border-white/5">
                  <CreditCard className="h-6 w-6 text-emerald-400 mx-auto mb-2" strokeWidth={1.5} />
                  <div className="text-3xl font-black text-emerald-400">${directBookingSavings.toLocaleString()}</div>
                  <div className="text-xs text-slate-400 mt-1">Est. commission savings / mo</div>
                </div>
              </div>

              <div className="mt-8 text-center">
                <Link
                  href="/register"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-8 text-sm font-semibold text-white shadow-md shadow-violet-600/30 transition hover:from-violet-500 hover:to-purple-500"
                >
                  Get Your Time Back — Try Free
                  <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Verified Host Testimonials */}
        <section className="py-24">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="text-xs font-semibold tracking-wider text-violet-400 uppercase">
                Host Stories
              </span>
              <h2 className="text-3xl font-extrabold text-white sm:text-4xl mt-2">
                Loved by hosts managing 1 to 100+ properties.
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-white/5 bg-[#0F1424] p-6 flex flex-col justify-between">
                <div>
                  <div className="flex gap-1 text-violet-400 mb-4">
                    <Star className="h-4 w-4 fill-violet-400 text-violet-400" strokeWidth={1.5} />
                    <Star className="h-4 w-4 fill-violet-400 text-violet-400" strokeWidth={1.5} />
                    <Star className="h-4 w-4 fill-violet-400 text-violet-400" strokeWidth={1.5} />
                    <Star className="h-4 w-4 fill-violet-400 text-violet-400" strokeWidth={1.5} />
                    <Star className="h-4 w-4 fill-violet-400 text-violet-400" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed italic">
                    &ldquo;Hospitable&apos;s AI literally answered a guest&apos;s late-night Wi-Fi question while I was asleep on a camping trip. My response rate is 100% and Superhost status is locked.&rdquo;
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-white">David K.</div>
                    <div className="text-slate-400">Superhost · 4 Listings</div>
                  </div>
                  <span className="rounded bg-violet-500/10 px-2 py-0.5 text-violet-300 font-medium border border-violet-500/20">
                    Verified Host
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/5 bg-[#0F1424] p-6 flex flex-col justify-between">
                <div>
                  <div className="flex gap-1 text-violet-400 mb-4">
                    <Star className="h-4 w-4 fill-violet-400 text-violet-400" strokeWidth={1.5} />
                    <Star className="h-4 w-4 fill-violet-400 text-violet-400" strokeWidth={1.5} />
                    <Star className="h-4 w-4 fill-violet-400 text-violet-400" strokeWidth={1.5} />
                    <Star className="h-4 w-4 fill-violet-400 text-violet-400" strokeWidth={1.5} />
                    <Star className="h-4 w-4 fill-violet-400 text-violet-400" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed italic">
                    &ldquo;We run 18 luxury beach villas in San Diego. The cleaner scheduling and smart lock code generation alone saved us from hiring two full-time operations coordinators.&rdquo;
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-white">Claire &amp; Marc V.</div>
                    <div className="text-slate-400">Property Managers · 18 Listings</div>
                  </div>
                  <span className="rounded bg-violet-500/10 px-2 py-0.5 text-violet-300 font-medium border border-violet-500/20">
                    Verified Host
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/5 bg-[#0F1424] p-6 flex flex-col justify-between">
                <div>
                  <div className="flex gap-1 text-violet-400 mb-4">
                    <Star className="h-4 w-4 fill-violet-400 text-violet-400" strokeWidth={1.5} />
                    <Star className="h-4 w-4 fill-violet-400 text-violet-400" strokeWidth={1.5} />
                    <Star className="h-4 w-4 fill-violet-400 text-violet-400" strokeWidth={1.5} />
                    <Star className="h-4 w-4 fill-violet-400 text-violet-400" strokeWidth={1.5} />
                    <Star className="h-4 w-4 fill-violet-400 text-violet-400" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed italic">
                    &ldquo;The direct booking engine is pure gold. We transferred 35% of our repeat guests to our direct site and kept over $14,000 in OTA fees in our pocket this year.&rdquo;
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-white">Jason R.</div>
                    <div className="text-slate-400">Boutique Stays · 12 Listings</div>
                  </div>
                  <span className="rounded bg-violet-500/10 px-2 py-0.5 text-violet-300 font-medium border border-violet-500/20">
                    Verified Host
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Transparent Hospitable Pricing Matrix */}
        <section className="border-t border-white/5 bg-[#0A0D18] py-24" id="pricing">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-semibold tracking-wider text-violet-400 uppercase">
                Transparent Pricing
              </span>
              <h2 className="text-3xl font-extrabold text-white sm:text-4xl mt-2">
                Simple, predictable plans with no hidden fees.
              </h2>
              <p className="mt-3 text-sm text-slate-400">
                14-day free trial on all plans. No credit card required to start.
              </p>

              {/* Annual / Monthly Toggle */}
              <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 p-1.5 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setAnnualBilling(false)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                    !annualBilling ? "bg-violet-600 text-white shadow-sm" : "text-slate-300 hover:text-white"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setAnnualBilling(true)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 ${
                    annualBilling ? "bg-violet-600 text-white shadow-sm" : "text-slate-300 hover:text-white"
                  }`}
                >
                  <span>Annual Billing</span>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300 font-bold border border-emerald-500/30">
                    Save 20%
                  </span>
                </button>
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-3 max-w-6xl mx-auto items-stretch">
              {/* Plan 1: Host */}
              <div className="rounded-2xl border border-white/5 bg-[#0F1424] p-8 flex flex-col justify-between">
                <div>
                  <div className="text-lg font-bold text-white">Host</div>
                  <p className="text-xs text-slate-400 mt-1">For hosts with 1 to 2 properties starting automation.</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-white">
                      ${annualBilling ? "32" : "40"}
                    </span>
                    <span className="text-xs text-slate-400">/ month</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {annualBilling ? "Billed annually ($384/yr)" : "Billed monthly"}
                  </div>

                  <ul className="mt-8 space-y-3 text-xs text-slate-300 border-t border-white/5 pt-6">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-violet-400 shrink-0" strokeWidth={1.5} />
                      <span>Up to 2 properties included</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-violet-400 shrink-0" strokeWidth={1.5} />
                      <span>Unified Inbox (Airbnb, Vrbo, Booking)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-violet-400 shrink-0" strokeWidth={1.5} />
                      <span>Standard AI automated messaging</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-violet-400 shrink-0" strokeWidth={1.5} />
                      <span>Sub-second channel calendar sync</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-violet-400 shrink-0" strokeWidth={1.5} />
                      <span>Smart lock code generation</span>
                    </li>
                  </ul>
                </div>

                <Link
                  href="/register"
                  className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Start 14-Day Free Trial
                </Link>
              </div>

              {/* Plan 2: Professional (Featured) */}
              <div className="relative rounded-2xl border-2 border-violet-500 bg-gradient-to-b from-[#161B2E] to-[#0F1424] p-8 flex flex-col justify-between shadow-2xl shadow-violet-950/80">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-3 py-1 text-[11px] font-bold text-white uppercase tracking-wider shadow-sm">
                  Most Popular
                </div>

                <div>
                  <div className="text-lg font-bold text-white">Professional</div>
                  <p className="text-xs text-slate-400 mt-1">For growing hosts & co-hosts with 3 to 19 properties.</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-white">
                      ${annualBilling ? "64" : "80"}
                    </span>
                    <span className="text-xs text-slate-400">/ month</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Base includes 2 listings + $15/mo per extra listing
                  </div>

                  <ul className="mt-8 space-y-3 text-xs text-slate-200 border-t border-white/10 pt-6">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-violet-400 shrink-0" strokeWidth={1.5} />
                      <span><strong>Everything in Host, plus:</strong></span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-violet-400 shrink-0" strokeWidth={1.5} />
                      <span>Hospitable AI 2.0 Autonomous Autopilot</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-violet-400 shrink-0" strokeWidth={1.5} />
                      <span>Commission-Free Direct Booking Site</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-violet-400 shrink-0" strokeWidth={1.5} />
                      <span>Cleaner portals & photo verification</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-violet-400 shrink-0" strokeWidth={1.5} />
                      <span>Stripe payments & deposit authorizations</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-violet-400 shrink-0" strokeWidth={1.5} />
                      <span>Google Vacation Rentals distribution</span>
                    </li>
                  </ul>
                </div>

                <Link
                  href="/register"
                  className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-semibold text-white shadow-lg shadow-violet-600/40 transition hover:from-violet-500 hover:to-purple-500"
                >
                  Start 14-Day Free Trial
                </Link>
              </div>

              {/* Plan 3: Mogul / Enterprise */}
              <div className="rounded-2xl border border-white/5 bg-[#0F1424] p-8 flex flex-col justify-between">
                <div>
                  <div className="text-lg font-bold text-white">Mogul & Enterprise</div>
                  <p className="text-xs text-slate-400 mt-1">For property management companies with 20+ properties.</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-white">
                      ${annualBilling ? "120" : "150"}
                    </span>
                    <span className="text-xs text-slate-400">/ month</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Includes dedicated account manager & onboarding
                  </div>

                  <ul className="mt-8 space-y-3 text-xs text-slate-300 border-t border-white/5 pt-6">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-violet-400 shrink-0" strokeWidth={1.5} />
                      <span><strong>Everything in Professional, plus:</strong></span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-violet-400 shrink-0" strokeWidth={1.5} />
                      <span>Custom Owner Portals & automated statements</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-violet-400 shrink-0" strokeWidth={1.5} />
                      <span>Multi-brand custom colors & domain white-labeling</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-violet-400 shrink-0" strokeWidth={1.5} />
                      <span>Custom API access & webhooks</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-violet-400 shrink-0" strokeWidth={1.5} />
                      <span>99.9% Uptime SLA & Priority 24/7 phone support</span>
                    </li>
                  </ul>
                </div>

                <Link
                  href="/register"
                  className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Contact Sales & Demo
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Frequently Asked Questions */}
        <section className="py-24" id="faq">
          <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <span className="text-xs font-semibold tracking-wider text-violet-400 uppercase">
                Got Questions?
              </span>
              <h2 className="text-3xl font-extrabold text-white sm:text-4xl mt-2">
                Frequently Asked Questions
              </h2>
              <p className="mt-3 text-sm text-slate-400">
                Everything you need to know about setting up Hospitable for your properties.
              </p>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div
                    key={faq.q}
                    className="rounded-xl border border-white/5 bg-[#0F1424] overflow-hidden transition"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="flex w-full items-center justify-between p-5 text-left text-sm font-semibold text-white transition hover:bg-white/[0.02]"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown
                        className={`h-4 w-4 text-violet-400 transition-transform duration-200 shrink-0 ml-4 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                        strokeWidth={1.5}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 text-sm text-slate-300 leading-relaxed border-t border-white/5 pt-3">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* High-Impact Bottom Call to Action */}
        <section className="relative overflow-hidden border-t border-white/10 bg-gradient-to-b from-[#10162B] to-[#090D16] py-24 text-center">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.25),rgba(9,13,22,0))] pointer-events-none" />

          <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-3.5 py-1 text-xs font-semibold text-violet-300 border border-violet-500/20 mb-6">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" strokeWidth={1.5} />
              Setup Takes Less Than 7 Minutes
            </span>

            <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-white">
              Ready to run your properties on autopilot?
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300">
              Join 50,000+ short-term rental professionals who save 15+ hours every week with Hospitable.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 px-8 text-base font-semibold text-white shadow-xl shadow-violet-600/40 transition hover:from-violet-500 hover:to-indigo-500 border border-violet-400/20"
              >
                Start 14-Day Free Trial
                <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 w-full sm:w-auto items-center justify-center rounded-xl border border-white/10 bg-white/5 px-6 text-base font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
              >
                Log In to Workspace
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-violet-400" strokeWidth={1.5} />
                No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-violet-400" strokeWidth={1.5} />
                Official Airbnb & Vrbo Partner
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-violet-400" strokeWidth={1.5} />
                Cancel anytime
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Hospitable Brand Footer */}
      <footer className="border-t border-white/5 bg-[#070A12] py-16 text-xs text-slate-400">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 grid-cols-2 md:grid-cols-5 mb-12">
            {/* Brand Column */}
            <div className="col-span-2">
              <Link href="/" className="flex items-center gap-2 text-lg font-bold text-white mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-white">
                  <Compass className="h-4 w-4" strokeWidth={1.5} />
                </span>
                <span>Hospitable<span className="text-violet-400">.</span></span>
              </Link>
              <p className="text-slate-400 max-w-sm leading-relaxed">
                The operating system for short-term rental professionals. Automate guest messaging, team turnovers, channel sync, and direct bookings with confidence.
              </p>
              <div className="mt-4 flex items-center gap-2 text-[11px] text-emerald-400 font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>All systems operational (99.98% uptime)</span>
              </div>
            </div>

            {/* Products Column */}
            <div>
              <h5 className="font-semibold text-white uppercase tracking-wider mb-3 text-[11px]">Product</h5>
              <ul className="space-y-2">
                <li><a href="#unified-inbox" className="hover:text-white transition">Unified Inbox</a></li>
                <li><a href="#features" className="hover:text-white transition">Channel Manager</a></li>
                <li><a href="#features" className="hover:text-white transition">Hospitable AI</a></li>
                <li><a href="#features" className="hover:text-white transition">Direct Booking Sites</a></li>
                <li><a href="#features" className="hover:text-white transition">Turnovers & Cleaning</a></li>
                <li><a href="#features" className="hover:text-white transition">Smart Lock Sync</a></li>
              </ul>
            </div>

            {/* Channels Column */}
            <div>
              <h5 className="font-semibold text-white uppercase tracking-wider mb-3 text-[11px]">Integrations</h5>
              <ul className="space-y-2">
                <li><span className="hover:text-white transition cursor-default">Airbnb</span></li>
                <li><span className="hover:text-white transition cursor-default">Vrbo</span></li>
                <li><span className="hover:text-white transition cursor-default">Booking.com</span></li>
                <li><span className="hover:text-white transition cursor-default">Google Vacation Rentals</span></li>
                <li><span className="hover:text-white transition cursor-default">Schlage, Yale, August</span></li>
                <li><span className="hover:text-white transition cursor-default">Stripe</span></li>
              </ul>
            </div>

            {/* Company Column */}
            <div>
              <h5 className="font-semibold text-white uppercase tracking-wider mb-3 text-[11px]">Company</h5>
              <ul className="space-y-2">
                <li><Link href="/login" className="hover:text-white transition">Host Login</Link></li>
                <li><Link href="/register" className="hover:text-white transition">Start Free Trial</Link></li>
                <li><a href="#pricing" className="hover:text-white transition">Pricing Plans</a></li>
                <li><a href="#faq" className="hover:text-white transition">Help & FAQs</a></li>
                <li><span className="hover:text-white transition cursor-default">Security & SOC2</span></li>
                <li><span className="hover:text-white transition cursor-default">Privacy Policy</span></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
            <div>
              © 2026 Hospitable. All rights reserved. Built for professional vacation rental hosts.
            </div>
            <div className="flex gap-6">
              <span>Zero-Emoji Clean Line Design</span>
              <span>Enterprise Grade Security</span>
              <span>Sub-Second Sync</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
