"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { logClientActivity } from "@/lib/client-logger";

export function ActivityTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPath = React.useRef<string>("");

  React.useEffect(() => {
    const fullPath = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
    if (fullPath === lastPath.current) return;
    lastPath.current = fullPath;

    // Friendly human-readable summary based on destination
    let summary = `Navigated to ${pathname}`;
    if (pathname === "/dashboard") summary = "Viewed operations dashboard";
    else if (pathname === "/reservations") summary = "Accessed reservations ledger";
    else if (pathname === "/frontdesk") summary = "Opened front desk workspace";
    else if (pathname === "/billing") summary = "Accessed billing & invoices";
    else if (pathname === "/housekeeping") summary = "Viewed housekeeping task board";
    else if (pathname === "/maintenance") summary = "Viewed maintenance tickets";
    else if (pathname === "/calendar") summary = "Opened tape chart calendar";
    else if (pathname === "/notifications") summary = "Viewed notifications & messaging dispatch";
    else if (pathname === "/ai") summary = "Accessed AI Operations Hub";
    else if (pathname.startsWith("/billing/")) summary = "Viewed invoice folio & receipt";

    logClientActivity("navigation.page_view", summary, {
      category: "navigation",
      metadata: { pathname, search: searchParams?.toString() || null },
    });
  }, [pathname, searchParams]);

  // Uncaught client error tracking
  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      logClientActivity("ui.client_error", `Frontend error: ${event.message}`, {
        category: "system",
        metadata: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    };

    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  return null;
}
