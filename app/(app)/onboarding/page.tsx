"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export default function OnboardingWizardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = React.useState<number>(1);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Step 1: Property
  const [propertyName, setPropertyName] = React.useState("Lumina Grand Boutique");
  const [propertyCode, setPropertyCode] = React.useState("LGB");
  const [city, setCity] = React.useState("San Francisco");
  const [country, setCountry] = React.useState("United States");
  const [currency, setCurrency] = React.useState("USD");
  const [timezone, setTimezone] = React.useState("America/Los_Angeles");
  const [checkInTime, setCheckInTime] = React.useState(15);
  const [checkOutTime, setCheckOutTime] = React.useState(11);
  const [taxRate, setTaxRate] = React.useState("14.00");
  const [cleaningFee, setCleaningFee] = React.useState("45.00");

  // Step 2: Room Types
  const [roomTypes, setRoomTypes] = React.useState([
    { name: "Deluxe King Suite", capacity: 2, bedType: "King Bed", baseRate: "220.00" },
    { name: "Double Queen Room", capacity: 4, bedType: "2 Queen Beds", baseRate: "260.00" },
  ]);

  // Step 3: Rooms
  const [rooms, setRooms] = React.useState([
    { number: "101", floor: "1", roomTypeName: "Deluxe King Suite" },
    { number: "102", floor: "1", roomTypeName: "Deluxe King Suite" },
    { number: "201", floor: "2", roomTypeName: "Double Queen Room" },
    { number: "202", floor: "2", roomTypeName: "Double Queen Room" },
  ]);

  // Step 4: Rate Plans
  const [ratePlanName, setRatePlanName] = React.useState("Standard Flexible Rate");
  const [ratePlanAmount, setRatePlanAmount] = React.useState("220.00");

  function addRoomType() {
    setRoomTypes([
      ...roomTypes,
      { name: `Room Type ${roomTypes.length + 1}`, capacity: 2, bedType: "King Bed", baseRate: "180.00" },
    ]);
  }

  function addRoom() {
    const nextNum = 300 + rooms.length;
    setRooms([
      ...rooms,
      { number: String(nextNum), floor: "3", roomTypeName: roomTypes[0]?.name || "Standard" },
    ]);
  }

  async function onComplete() {
    setError(null);
    setSubmitting(true);

    try {
      const payload = {
        property: {
          name: propertyName,
          code: propertyCode,
          city,
          country,
          currency,
          timezone,
          checkInTime: Number(checkInTime),
          checkOutTime: Number(checkOutTime),
          taxRate: Number(taxRate),
          cleaningFee: Number(cleaningFee),
        },
        roomTypes: roomTypes.map((rt) => ({
          name: rt.name,
          capacity: Number(rt.capacity),
          bedType: rt.bedType,
          baseRate: rt.baseRate,
        })),
        rooms: rooms.map((r) => ({
          number: r.number,
          floor: r.floor,
          roomTypeName: r.roomTypeName,
        })),
        ratePlans: [
          {
            name: ratePlanName,
            amount: ratePlanAmount,
            type: "fixed" as const,
          },
        ],
      };

      const res = await fetch("/api/setup-wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? "Onboarding setup failed");
      }

      toast({
        title: "Setup Complete!",
        description: `${propertyName} has been provisioned with ${json.data.rooms.length} rooms and ready for reservations.`,
      });

      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message ?? "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-6">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Property Setup Wizard</h1>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
            Step {step} of 4
          </span>
        </div>
        <p className="mt-1 text-muted-foreground">
          Complete initial setup to start checking in guests, publishing real-time rates, and taking bookings.
        </p>
      </div>

      {error ? (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
      ) : null}

      {/* Step 1: Property Profile */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Property Identity & Localization</CardTitle>
            <CardDescription>Tell us about your property and local operational policies.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Property Name</Label>
                <Input value={propertyName} onChange={(e) => setPropertyName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Code (Prefix for Bookings)</Label>
                <Input value={propertyCode} onChange={(e) => setPropertyCode(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input value={country} onChange={(e) => setCountry(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Operating Timezone</Label>
                <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  <option value="America/Los_Angeles">America/Los_Angeles (Pacific)</option>
                  <option value="America/New_York">America/New_York (Eastern)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                  <option value="Europe/Paris">Europe/Paris (CET)</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tax Rate (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Cleaning Turnover Fee ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={cleaningFee}
                  onChange={(e) => setCleaningFee(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Check-In Hour (24h)</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={checkInTime}
                  onChange={(e) => setCheckInTime(parseInt(e.target.value, 10) || 15)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Check-Out Hour (24h)</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={checkOutTime}
                  onChange={(e) => setCheckOutTime(parseInt(e.target.value, 10) || 11)}
                  required
                />
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <Button onClick={() => setStep(2)}>Next: Configure Room Categories →</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Room Types */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Room Categories & Base Nightly Rates</CardTitle>
            <CardDescription>Define the types of rooms available in this property.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {roomTypes.map((rt, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 rounded-lg border p-3 items-end">
                  <div className="col-span-4 space-y-1">
                    <Label className="text-xs">Category Name</Label>
                    <Input
                      value={rt.name}
                      onChange={(e) => {
                        const copy = [...roomTypes];
                        copy[idx].name = e.target.value;
                        setRoomTypes(copy);
                      }}
                      required
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Capacity</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={rt.capacity}
                      onChange={(e) => {
                        const copy = [...roomTypes];
                        copy[idx].capacity = parseInt(e.target.value, 10) || 1;
                        setRoomTypes(copy);
                      }}
                      required
                    />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <Label className="text-xs">Bedding</Label>
                    <Input
                      value={rt.bedType}
                      onChange={(e) => {
                        const copy = [...roomTypes];
                        copy[idx].bedType = e.target.value;
                        setRoomTypes(copy);
                      }}
                    />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <Label className="text-xs">Base Rate ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={rt.baseRate}
                      onChange={(e) => {
                        const copy = [...roomTypes];
                        copy[idx].baseRate = e.target.value;
                        setRoomTypes(copy);
                      }}
                      required
                    />
                  </div>
                </div>
              ))}
            </div>

            <Button type="button" variant="outline" size="sm" onClick={addRoomType}>
              + Add Another Category
            </Button>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                ← Back
              </Button>
              <Button onClick={() => setStep(3)}>Next: Assign Room Numbers →</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Rooms Inventory */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Physical Room Inventory</CardTitle>
            <CardDescription>Assign specific door numbers to your configured room types.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {rooms.map((r, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 rounded-lg border p-3 items-end">
                  <div className="col-span-3 space-y-1">
                    <Label className="text-xs">Room Number</Label>
                    <Input
                      value={r.number}
                      onChange={(e) => {
                        const copy = [...rooms];
                        copy[idx].number = e.target.value;
                        setRooms(copy);
                      }}
                      required
                    />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <Label className="text-xs">Floor</Label>
                    <Input
                      value={r.floor}
                      onChange={(e) => {
                        const copy = [...rooms];
                        copy[idx].floor = e.target.value;
                        setRooms(copy);
                      }}
                    />
                  </div>
                  <div className="col-span-6 space-y-1">
                    <Label className="text-xs">Assigned Category</Label>
                    <Select
                      value={r.roomTypeName}
                      onChange={(e) => {
                        const copy = [...rooms];
                        copy[idx].roomTypeName = e.target.value;
                        setRooms(copy);
                      }}
                    >
                      {roomTypes.map((rt) => (
                        <option key={rt.name} value={rt.name}>
                          {rt.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            <Button type="button" variant="outline" size="sm" onClick={addRoom}>
              + Add Room Number
            </Button>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>
                ← Back
              </Button>
              <Button onClick={() => setStep(4)}>Next: Review & Launch →</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Rate Plan & Review */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 4: Launch Property</CardTitle>
            <CardDescription>Verify your configuration and create all property assets.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-sm">Property</span>
                <span className="text-sm">{propertyName} ({propertyCode})</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-sm">Location & Currency</span>
                <span className="text-sm">{city}, {country} · {currency}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-sm">Categories Configured</span>
                <span className="text-sm">{roomTypes.length} category types</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-sm">Total Physical Rooms</span>
                <span className="text-sm">{rooms.length} bookable rooms</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-sm">Tax & Turnover</span>
                <span className="text-sm">{taxRate}% tax · ${cleaningFee} cleaning</span>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Default Rate Plan</Label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  value={ratePlanName}
                  onChange={(e) => setRatePlanName(e.target.value)}
                  placeholder="Rate Plan Name"
                  required
                />
                <Input
                  type="number"
                  step="0.01"
                  value={ratePlanAmount}
                  onChange={(e) => setRatePlanAmount(e.target.value)}
                  placeholder="Rate Plan Daily Rate"
                  required
                />
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(3)}>
                ← Back
              </Button>
              <Button onClick={onComplete} disabled={submitting}>
                {submitting ? "Provisioning Property…" : "Confirm & Launch Property"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
