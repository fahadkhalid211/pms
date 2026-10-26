"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ToastProvider, useToast } from "@/components/ui/toast";
import {
  Calendar,
  Search,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Send,
  KeyRound,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

function GuestPortalContent() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState<"book" | "lookup" | "checkin" | "messages" | "cancel">("book");

  // Search & Booking State
  const [orgId, setOrgId] = React.useState("");
  const [checkIn, setCheckIn] = React.useState("2026-11-01");
  const [checkOut, setCheckOut] = React.useState("2026-11-04");
  const [adults, setAdults] = React.useState(2);
  const [searching, setSearching] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<any[]>([]);

  // Selected Booking Form
  const [selectedRoom, setSelectedRoom] = React.useState<any | null>(null);
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [bookingNotes, setBookingNotes] = React.useState("");
  const [bookingPending, setBookingPending] = React.useState(false);
  const [confirmedBooking, setConfirmedBooking] = React.useState<any | null>(null);

  // Verification & Lookup State
  const [lookupCode, setLookupCode] = React.useState("");
  const [lookupEmail, setLookupEmail] = React.useState("");
  const [lookupPending, setLookupPending] = React.useState(false);
  const [verifiedReservation, setVerifiedReservation] = React.useState<any | null>(null);

  // Online Check-in State
  const [checkInEta, setCheckInEta] = React.useState("15:00");
  const [checkInAck, setCheckInAck] = React.useState(true);
  const [emergencyContact, setEmergencyContact] = React.useState("");
  const [checkInRequests, setCheckInRequests] = React.useState("");
  const [checkInPending, setCheckInPending] = React.useState(false);

  // Messages State
  const [guestMessage, setGuestMessage] = React.useState("");
  const [messagePending, setMessagePending] = React.useState(false);

  // Cancellation State
  const [cancelReason, setCancelReason] = React.useState("");
  const [cancelPending, setCancelPending] = React.useState(false);

  // Load demo organization if needed
  React.useEffect(() => {
    async function loadDefaults() {
      try {
        const res = await fetch("/api/properties");
        const json = await res.json();
        if (json.success && json.data?.length > 0) {
          setOrgId(json.data[0].organizationId);
        }
      } catch {
        // Ignore in public unauthenticated mode
      }
    }
    void loadDefaults();
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) {
      toast({ title: "Hotel selection required", description: "Please enter or select a hotel organization ID." });
      return;
    }
    setSearching(true);
    try {
      const res = await fetch("/api/portal/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, checkIn, checkOut, adults }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSearchResults(json.data);
        if (json.data.length === 0) {
          toast({ title: "No availability", description: "No rooms available for the selected dates." });
        }
      } else {
        toast({ title: "Search failed", description: json.error?.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Network error", description: err.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRoom) return;
    setBookingPending(true);

    try {
      const res = await fetch("/api/portal/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          propertyId: selectedRoom.propertyId,
          roomTypeId: selectedRoom.roomTypeId,
          checkIn,
          checkOut,
          adults,
          guest: { firstName, lastName, email, phone },
          notes: bookingNotes,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setConfirmedBooking(json.data);
        setLookupCode(json.data.bookingCode);
        setLookupEmail(email);
        toast({ title: "Booking confirmed!", description: `Confirmation code: ${json.data.bookingCode}` });
      } else {
        toast({ title: "Booking failed", description: json.error?.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Network error", description: err.message, variant: "destructive" });
    } finally {
      setBookingPending(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!lookupCode.trim() || !lookupEmail.trim()) {
      toast({
        title: "Identity verification required",
        description: "Both Booking Reference and Guest Email are strictly required.",
        variant: "destructive",
      });
      return;
    }

    setLookupPending(true);
    try {
      const res = await fetch("/api/portal/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          bookingCode: lookupCode.trim(),
          email: lookupEmail.trim(),
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setVerifiedReservation(json.data);
        toast({ title: "Identity verified", description: `Loaded booking #${json.data.code}` });
      } else {
        setVerifiedReservation(null);
        toast({ title: "Verification failed", description: json.error?.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Network error", description: err.message, variant: "destructive" });
    } finally {
      setLookupPending(false);
    }
  }

  async function handleOnlineCheckIn(e: React.FormEvent) {
    e.preventDefault();
    setCheckInPending(true);
    try {
      const res = await fetch("/api/portal/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          bookingCode: lookupCode,
          email: lookupEmail,
          estimatedArrival: checkInEta,
          idVerifiedAck: checkInAck,
          emergencyContact,
          specialRequests: checkInRequests,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast({ title: "Check-in completed", description: json.data.message });
      } else {
        toast({ title: "Check-in failed", description: json.error?.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Network error", description: err.message, variant: "destructive" });
    } finally {
      setCheckInPending(false);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!guestMessage.trim()) return;
    setMessagePending(true);
    try {
      const res = await fetch("/api/portal/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          bookingCode: lookupCode,
          email: lookupEmail,
          message: guestMessage.trim(),
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast({ title: "Message delivered", description: "Front desk has received your message." });
        setGuestMessage("");
      } else {
        toast({ title: "Send failed", description: json.error?.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Network error", description: err.message, variant: "destructive" });
    } finally {
      setMessagePending(false);
    }
  }

  async function handleCancelRequest(e: React.FormEvent) {
    e.preventDefault();
    setCancelPending(true);
    try {
      const res = await fetch("/api/portal/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          bookingCode: lookupCode,
          email: lookupEmail,
          reason: cancelReason,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast({ title: "Cancellation requested", description: json.data.message });
      } else {
        toast({ title: "Request failed", description: json.error?.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Network error", description: err.message, variant: "destructive" });
    } finally {
      setCancelPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100">
      {/* Top Navigation */}
      <header className="border-b border-violet-950/60 bg-[#0C101D]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-violet-600 flex items-center justify-center font-bold text-white shadow-lg shadow-violet-600/30">
              L
            </div>
            <span className="font-bold text-lg tracking-tight text-white">Lumina Guest Portal</span>
          </Link>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-violet-500/30 bg-violet-500/10 text-violet-400 text-xs">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Verified Secure
            </Badge>
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                Staff Login
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <div className="border-b border-violet-950/40 bg-gradient-to-b from-[#120B28]/60 to-[#090D16] py-10 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-3">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
            Guest Reservations & Direct Portal
          </h1>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            Book your stay with zero booking fees, manage your upcoming itinerary, complete seamless online check-in, or message the front desk directly.
          </p>

          {/* Tab Navigation */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
            <button
              onClick={() => setActiveTab("book")}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === "book"
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                  : "bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-white"
              }`}
            >
              Book a Stay
            </button>
            <button
              onClick={() => setActiveTab("lookup")}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === "lookup"
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                  : "bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-white"
              }`}
            >
              Find My Booking
            </button>
            <button
              onClick={() => setActiveTab("checkin")}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === "checkin"
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                  : "bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-white"
              }`}
            >
              Online Check-in
            </button>
            <button
              onClick={() => setActiveTab("messages")}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === "messages"
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                  : "bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-white"
              }`}
            >
              Front Desk Messages
            </button>
            <button
              onClick={() => setActiveTab("cancel")}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === "cancel"
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                  : "bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-white"
              }`}
            >
              Cancellation Request
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* TAB 1: BOOK A STAY */}
        {activeTab === "book" && (
          <div className="space-y-6">
            <Card className="border-violet-950/60 bg-[#0D1220]">
              <CardHeader>
                <CardTitle className="text-lg text-white">Search Available Rooms & Best Direct Rates</CardTitle>
                <CardDescription className="text-slate-400">Guaranteed direct rate with no hidden platform fees.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSearch} className="grid gap-4 sm:grid-cols-5">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="orgId" className="text-xs text-slate-300">Hotel / Organization ID</Label>
                    <Input
                      id="orgId"
                      value={orgId}
                      onChange={(e) => setOrgId(e.target.value)}
                      placeholder="e.g. org-..."
                      required
                      className="bg-slate-950/80 border-slate-800 text-white text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="checkIn" className="text-xs text-slate-300">Check-In Date</Label>
                    <Input
                      id="checkIn"
                      type="date"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      required
                      className="bg-slate-950/80 border-slate-800 text-white text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="checkOut" className="text-xs text-slate-300">Check-Out Date</Label>
                    <Input
                      id="checkOut"
                      type="date"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      required
                      className="bg-slate-950/80 border-slate-800 text-white text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="adults" className="text-xs text-slate-300">Guests</Label>
                    <Input
                      id="adults"
                      type="number"
                      min={1}
                      max={10}
                      value={adults}
                      onChange={(e) => setAdults(parseInt(e.target.value, 10) || 1)}
                      required
                      className="bg-slate-950/80 border-slate-800 text-white text-xs"
                    />
                  </div>
                  <div className="sm:col-span-5 flex justify-end">
                    <Button type="submit" disabled={searching} className="bg-violet-600 hover:bg-violet-700 text-white text-xs">
                      {searching ? "Checking Availability..." : "Search Available Rooms"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Results Grid */}
            {searchResults.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-white">Available Room Categories</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {searchResults.map((r, idx) => (
                    <Card
                      key={idx}
                      className={`border-violet-950/50 bg-[#0D1220] transition cursor-pointer hover:border-violet-600 ${
                        selectedRoom?.roomTypeId === r.roomTypeId ? "border-violet-500 ring-1 ring-violet-500" : ""
                      }`}
                      onClick={() => setSelectedRoom(r)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base text-white">{r.roomTypeName}</CardTitle>
                          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px]">
                            {r.availableRoomCount} Available
                          </Badge>
                        </div>
                        <CardDescription className="text-xs text-slate-400">
                          {r.propertyName} · Capacity: {r.capacity} Guests
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3 pt-2">
                        <div className="rounded-lg bg-slate-950/60 p-3 text-xs space-y-1 border border-slate-900">
                          <div className="flex justify-between text-slate-400">
                            <span>Base ({r.priceQuote.nights} nights):</span>
                            <span>{r.currency} {r.priceQuote.basePrice}</span>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span>Taxes & Cleaning:</span>
                            <span>{r.currency} {(Number(r.priceQuote.taxes) + Number(r.priceQuote.fees)).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-white font-semibold pt-1 border-t border-slate-800">
                            <span>Total Due:</span>
                            <span className="text-violet-400 font-bold">{r.currency} {r.priceQuote.total}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="w-full bg-violet-600/80 hover:bg-violet-600 text-white text-xs"
                          onClick={() => setSelectedRoom(r)}
                        >
                          {selectedRoom?.roomTypeId === r.roomTypeId ? "Selected" : "Select Room"}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Booking Form */}
            {selectedRoom && !confirmedBooking && (
              <Card className="border-violet-600/50 bg-[#0D1220]">
                <CardHeader>
                  <CardTitle className="text-base text-white">Complete Your Booking: {selectedRoom.roomTypeName}</CardTitle>
                  <CardDescription className="text-slate-400">
                    Instant confirmation directly through the hotel PMS.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleBook} className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="fn" className="text-xs text-slate-300">First Name</Label>
                        <Input
                          id="fn"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          required
                          className="bg-slate-950/80 border-slate-800 text-white text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="ln" className="text-xs text-slate-300">Last Name</Label>
                        <Input
                          id="ln"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          required
                          className="bg-slate-950/80 border-slate-800 text-white text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="em" className="text-xs text-slate-300">Email Address (For Confirmation)</Label>
                        <Input
                          id="em"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="bg-slate-950/80 border-slate-800 text-white text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="ph" className="text-xs text-slate-300">Phone Number</Label>
                        <Input
                          id="ph"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="bg-slate-950/80 border-slate-800 text-white text-xs"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="notes" className="text-xs text-slate-300">Special Requests / Notes</Label>
                      <Textarea
                        id="notes"
                        value={bookingNotes}
                        onChange={(e) => setBookingNotes(e.target.value)}
                        placeholder="e.g. Quiet room preferred, high floor, early arrival notification"
                        className="bg-slate-950/80 border-slate-800 text-white text-xs min-h-[50px]"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button type="submit" disabled={bookingPending} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                        {bookingPending ? "Confirming..." : `Confirm Booking (${selectedRoom.currency} ${selectedRoom.priceQuote.total})`}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Confirmed Booking Badge */}
            {confirmedBooking && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-6 text-center space-y-3">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
                <h3 className="text-xl font-bold text-white">Your Stay is Confirmed!</h3>
                <p className="text-sm text-slate-300">
                  Confirmation Code: <span className="font-mono font-bold text-emerald-400 text-base">{confirmedBooking.bookingCode}</span>
                </p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  A receipt and pre-arrival details have been delivered to your email. You can manage your booking or complete online check-in anytime using the tabs above.
                </p>
                <Button size="sm" onClick={() => setActiveTab("checkin")} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                  Proceed to Online Check-in <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: FIND MY BOOKING (STRICT IDOR GATE) */}
        {activeTab === "lookup" && (
          <div className="space-y-6">
            <Card className="border-violet-950/60 bg-[#0D1220]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base text-white">Verified Itinerary & Folio Lookup</CardTitle>
                    <CardDescription className="text-slate-400">
                      Identity Verification Gate: Reference Code + Email Address are strictly required.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="border-violet-500/30 text-violet-400 text-xs">
                    <KeyRound className="mr-1 h-3 w-3" /> Anti-IDOR Gate
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVerify} className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor="code" className="text-xs text-slate-300">Booking Reference</Label>
                    <Input
                      id="code"
                      value={lookupCode}
                      onChange={(e) => setLookupCode(e.target.value)}
                      placeholder="e.g. BK-XXXXXX"
                      required
                      className="bg-slate-950/80 border-slate-800 text-white text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="lemail" className="text-xs text-slate-300">Matching Guest Email</Label>
                    <Input
                      id="lemail"
                      type="email"
                      value={lookupEmail}
                      onChange={(e) => setLookupEmail(e.target.value)}
                      placeholder="email@example.com"
                      required
                      className="bg-slate-950/80 border-slate-800 text-white text-xs"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" disabled={lookupPending} className="w-full bg-violet-600 hover:bg-violet-700 text-white text-xs">
                      {lookupPending ? "Verifying..." : "Verify & Load"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {verifiedReservation && (
              <Card className="border-emerald-500/30 bg-[#0D1220]">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg text-white">Booking #{verifiedReservation.code}</CardTitle>
                        <Badge className="bg-emerald-600 text-white text-[10px] capitalize">{verifiedReservation.status}</Badge>
                      </div>
                      <CardDescription className="text-xs text-slate-400 pt-1">
                        {verifiedReservation.propertyName} · {verifiedReservation.propertyAddress}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Total Charged</div>
                      <div className="text-base font-bold text-violet-400">
                        {verifiedReservation.currency} {verifiedReservation.totalAmount}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-950/80 p-2.5 border border-slate-900">
                      <span className="text-slate-400 block">Check-in</span>
                      <span className="font-semibold text-white">{verifiedReservation.checkIn} ({verifiedReservation.checkInTime}:00)</span>
                    </div>
                    <div className="rounded-lg bg-slate-950/80 p-2.5 border border-slate-900">
                      <span className="text-slate-400 block">Check-out</span>
                      <span className="font-semibold text-white">{verifiedReservation.checkOut} ({verifiedReservation.checkOutTime}:00)</span>
                    </div>
                    <div className="rounded-lg bg-slate-950/80 p-2.5 border border-slate-900">
                      <span className="text-slate-400 block">Guests</span>
                      <span className="font-semibold text-white">{verifiedReservation.adults} Adults, {verifiedReservation.children} Kids</span>
                    </div>
                    <div className="rounded-lg bg-slate-950/80 p-2.5 border border-slate-900">
                      <span className="text-slate-400 block">Assigned Rooms</span>
                      <span className="font-semibold text-emerald-400">
                        {verifiedReservation.rooms.map((r: any) => `Room ${r.number}`).join(", ") || "Auto-assigned"}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={() => setActiveTab("checkin")} className="bg-violet-600 hover:bg-violet-700 text-white text-xs">
                      Online Check-In
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setActiveTab("messages")} className="border-slate-800 text-slate-300 text-xs">
                      Message Hotel
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setActiveTab("cancel")} className="border-rose-900/40 text-rose-400 hover:bg-rose-950/30 text-xs">
                      Request Cancellation
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* TAB 3: ONLINE CHECK-IN */}
        {activeTab === "checkin" && (
          <Card className="border-violet-950/60 bg-[#0D1220]">
            <CardHeader>
              <CardTitle className="text-lg text-white">Express Online Check-In</CardTitle>
              <CardDescription className="text-slate-400">
                Skip the front desk queue. Complete your arrival verification in advance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleOnlineCheckIn} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="ciCode" className="text-xs text-slate-300">Booking Reference</Label>
                    <Input
                      id="ciCode"
                      value={lookupCode}
                      onChange={(e) => setLookupCode(e.target.value)}
                      placeholder="BK-XXXXXX"
                      required
                      className="bg-slate-950/80 border-slate-800 text-white text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ciEmail" className="text-xs text-slate-300">Guest Email</Label>
                    <Input
                      id="ciEmail"
                      type="email"
                      value={lookupEmail}
                      onChange={(e) => setLookupEmail(e.target.value)}
                      placeholder="email@example.com"
                      required
                      className="bg-slate-950/80 border-slate-800 text-white text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="eta" className="text-xs text-slate-300">Estimated Arrival Time (ETA)</Label>
                    <Input
                      id="eta"
                      type="time"
                      value={checkInEta}
                      onChange={(e) => setCheckInEta(e.target.value)}
                      required
                      className="bg-slate-950/80 border-slate-800 text-white text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="emContact" className="text-xs text-slate-300">Emergency Contact (Name & Phone)</Label>
                    <Input
                      id="emContact"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                      placeholder="e.g. Jane Doe (+1 555-0199)"
                      className="bg-slate-950/80 border-slate-800 text-white text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="reqs" className="text-xs text-slate-300">Accessibility or Dietary Preferences</Label>
                  <Textarea
                    id="reqs"
                    value={checkInRequests}
                    onChange={(e) => setCheckInRequests(e.target.value)}
                    placeholder="e.g. Feather-free pillows, wheelchair accessible access, early arrival"
                    className="bg-slate-950/80 border-slate-800 text-white text-xs min-h-[50px]"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="ack"
                    checked={checkInAck}
                    onChange={(e) => setCheckInAck(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-800"
                    required
                  />
                  <Label htmlFor="ack" className="text-xs text-slate-300 cursor-pointer">
                    I confirm that the primary guest will present valid government-issued photo ID upon room key pickup.
                  </Label>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={checkInPending} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                    {checkInPending ? "Submitting..." : "Submit Online Check-in"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* TAB 4: GUEST MESSAGES */}
        {activeTab === "messages" && (
          <Card className="border-violet-950/60 bg-[#0D1220]">
            <CardHeader>
              <CardTitle className="text-lg text-white">Direct Message Front Desk</CardTitle>
              <CardDescription className="text-slate-400">
                Communicate directly with hotel staff regarding your reservation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendMessage} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="mCode" className="text-xs text-slate-300">Booking Reference</Label>
                    <Input
                      id="mCode"
                      value={lookupCode}
                      onChange={(e) => setLookupCode(e.target.value)}
                      placeholder="BK-XXXXXX"
                      required
                      className="bg-slate-950/80 border-slate-800 text-white text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="mEmail" className="text-xs text-slate-300">Guest Email</Label>
                    <Input
                      id="mEmail"
                      type="email"
                      value={lookupEmail}
                      onChange={(e) => setLookupEmail(e.target.value)}
                      placeholder="email@example.com"
                      required
                      className="bg-slate-950/80 border-slate-800 text-white text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="msg" className="text-xs text-slate-300">Message Content</Label>
                  <Textarea
                    id="msg"
                    value={guestMessage}
                    onChange={(e) => setGuestMessage(e.target.value)}
                    placeholder="Type your message, query, or housekeeping request..."
                    required
                    className="bg-slate-950/80 border-slate-800 text-white text-xs min-h-[80px]"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={messagePending} className="bg-violet-600 hover:bg-violet-700 text-white text-xs">
                    {messagePending ? "Sending..." : "Send to Front Desk"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* TAB 5: CANCELLATION REQUEST */}
        {activeTab === "cancel" && (
          <Card className="border-rose-950/40 bg-[#0D1220]">
            <CardHeader>
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="h-5 w-5" />
                <CardTitle className="text-lg text-white">Cancellation Request</CardTitle>
              </div>
              <CardDescription className="text-slate-400">
                Subject to hotel cancellation policy. Stays cancelled within 24 hours of check-in may incur a 1-night cancellation charge.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCancelRequest} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="cCode" className="text-xs text-slate-300">Booking Reference</Label>
                    <Input
                      id="cCode"
                      value={lookupCode}
                      onChange={(e) => setLookupCode(e.target.value)}
                      placeholder="BK-XXXXXX"
                      required
                      className="bg-slate-950/80 border-slate-800 text-white text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cEmail" className="text-xs text-slate-300">Guest Email</Label>
                    <Input
                      id="cEmail"
                      type="email"
                      value={lookupEmail}
                      onChange={(e) => setLookupEmail(e.target.value)}
                      placeholder="email@example.com"
                      required
                      className="bg-slate-950/80 border-slate-800 text-white text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cReason" className="text-xs text-slate-300">Reason for Cancellation</Label>
                  <Textarea
                    id="cReason"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Please specify why you need to cancel your booking..."
                    required
                    className="bg-slate-950/80 border-slate-800 text-white text-xs min-h-[60px]"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={cancelPending} className="bg-rose-600 hover:bg-rose-700 text-white text-xs">
                    {cancelPending ? "Submitting..." : "Submit Cancellation Request"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

export default function GuestPortalPage() {
  return (
    <ToastProvider>
      <GuestPortalContent />
    </ToastProvider>
  );
}
