/**
 * Client-Side Activity Logger
 * Sends UI events, navigation transitions, button clicks, and error reports to /api/activity-logs.
 */

export interface ClientLogOptions {
  category?:
    | "auth"
    | "reservation"
    | "billing"
    | "operations"
    | "housekeeping"
    | "maintenance"
    | "ai"
    | "notifications"
    | "navigation"
    | "ui_action"
    | "system";
  entityType?: string;
  entityId?: string;
  propertyId?: string;
  metadata?: Record<string, unknown>;
}

export function logClientActivity(
  action: string,
  summary: string,
  options?: ClientLogOptions,
) {
  if (typeof window === "undefined") return;

  const payload = {
    action,
    summary,
    category: options?.category ?? "ui_action",
    entityType: options?.entityType,
    entityId: options?.entityId,
    propertyId: options?.propertyId,
    metadata: {
      ...(options?.metadata ?? {}),
      url: window.location.href,
      path: window.location.pathname,
      referrer: document.referrer || null,
    },
    clientTimestamp: new Date().toISOString(),
  };

  try {
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/activity-logs", blob);
    } else {
      fetch("/api/activity-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Non-blocking
  }
}
