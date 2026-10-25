"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Reservation {
  id: string;
  code: string;
  status: string;
  checkIn: string;
  checkOut: string;
  guest: { firstName: string; lastName: string } | null;
}

export default function CalendarPage() {
  const [month, setMonth] = React.useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [reservations, setReservations] = React.useState<Reservation[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    void (async () => {
      const res = await fetch("/api/reservations?pageSize=200");
      const json = await res.json();
      if (res.ok && json.success) setReservations(json.data.items ?? []);
      setLoading(false);
    })();
  }, []);

  const year = month.year;
  const monthIndex = month.month;
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const startWeekday = firstDay.getDay();

  const days: { date: Date; reservations: Reservation[] }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, monthIndex, d);
    const key = date.toDateString();
    days.push({
      date,
      reservations: reservations.filter((r) => new Date(r.checkIn).toDateString() === key || new Date(r.checkOut).toDateString() === key),
    });
  }

  const monthName = new Date(year, monthIndex, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reservation calendar</h1>
          <p className="text-muted-foreground">Occupancy and bookings across the selected period.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="h-9 rounded-md border border-input bg-background px-3 text-sm" onClick={() => setMonth({ year: monthIndex === 0 ? year - 1 : year, month: (monthIndex + 11) % 12 })}>Previous</button>
          <button type="button" className="h-9 rounded-md border border-input bg-background px-3 text-sm" onClick={() => setMonth({ year: monthIndex === 11 ? year + 1 : year, month: (monthIndex + 1) % 12 })}>Next</button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{monthName}</CardTitle>
          <CardDescription>{loading ? "Loading…" : `${reservations.length} reservations loaded for planning.`}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="rounded-md bg-muted p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
            ))}
            {Array.from({ length: startWeekday }).map((_, i) => <div key={`empty-${i}`} />)}
            {days.map(({ date, reservations: dayReservations }) => (
              <div key={date.toISOString()} className="min-h-[90px] rounded-lg border p-2 text-xs">
                <div className="font-medium">{date.getDate()}</div>
                <div className="mt-1 space-y-1">
                  {dayReservations.slice(0, 3).map((r) => (
                    <div key={r.id} className="rounded bg-accent px-1.5 py-0.5 text-[11px] font-medium">{r.code} · {r.status}</div>
                  ))}
                  {dayReservations.length > 3 && <div className="text-[11px] text-muted-foreground">+{dayReservations.length - 3} more</div>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
