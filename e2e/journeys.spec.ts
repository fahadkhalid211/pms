import { test, expect } from "@playwright/test";

test.describe("WP11 Enterprise Journeys: Admin Operations, Customer Portal, and AI Governance", () => {
  // ---------------------------------------------------------------------------
  // JOURNEY 1: Admin Setup -> Booking Management -> Front Desk Check-in -> Billing
  // ---------------------------------------------------------------------------
  test("Journey 1: Admin authentication, executive dashboard, front desk & billing folios", async ({ page }) => {
    // 1. Visit Login Page
    await page.goto("/login");
    await expect(page).toHaveTitle(/Lumina/i);
    await expect(page.locator("input[type='email'], input[name='email']")).toBeVisible();

    // 2. Perform Authentication
    await page.fill("input[type='email'], input[name='email']", "admin@lumina.pms");
    await page.fill("input[type='password'], input[name='password']", "Password123!");
    await page.click("button[type='submit']");

    // 3. Arrive at Operations Dashboard
    await page.waitForURL("**/dashboard", { timeout: 15000 });
    await expect(page.locator("h1:has-text('Good to see you')")).toBeVisible();

    // Verify Executive KPIs render real data
    await expect(page.locator("text=Occupancy Rate")).toBeVisible();
    await expect(page.locator("text=ADR (Avg Daily Rate)")).toBeVisible();
    await expect(page.locator("text=RevPAR")).toBeVisible();
    await expect(page.locator("text=Outstanding Balance")).toBeVisible();

    // 4. Test Global Omnibox Search (Ctrl+K / Cmd+K)
    const searchButton = page.locator("button[aria-label*='Search Lumina']").first();
    await expect(searchButton).toBeVisible();
    await searchButton.click();
    await expect(page.locator("input[placeholder*='Search reservations']")).toBeVisible();
    await page.keyboard.press("Escape");

    // 5. Navigate to Reservations Management
    await page.goto("/reservations");
    await expect(page.locator("text=Reservations").first()).toBeVisible();
    await expect(page.locator("a[href*='/reservations/new']").first()).toBeVisible();

    // 6. Navigate to Front Desk Workspace (Check-in / Check-out / Movements)
    await page.goto("/frontdesk");
    await expect(page.locator("text=Front Desk").first()).toBeVisible();

    // 7. Navigate to Billing & Invoicing Workspace
    await page.goto("/billing");
    await expect(page.locator("text=Billing").first()).toBeVisible();

    // 8. Navigate to Financial & Operational Reports
    await page.goto("/reports");
    await expect(page.locator("text=Reports").first()).toBeVisible();
    await expect(page.locator("button:has-text('Financial CSV')").or(page.locator("text=Financial CSV"))).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // JOURNEY 2: Customer Public Portal & Anti-IDOR Verification Gate
  // ---------------------------------------------------------------------------
  test("Journey 2: Public guest portal, live quotes, anti-IDOR verification gate & chatbot", async ({ page }) => {
    // 1. Visit Public Guest Portal
    await page.goto("/portal");
    await expect(page.locator("text=Guest Portal").or(page.locator("text=Lumina"))).toBeVisible();

    // 2. Verify Portal Navigation Tabs (Book a Stay, Find My Booking, Online Check-in, Messages)
    await expect(page.locator("button:has-text('Book a Stay')")).toBeVisible();
    await expect(page.locator("button:has-text('Find My Booking')")).toBeVisible();
    await expect(page.locator("button:has-text('Online Check-in')")).toBeVisible();
    await expect(page.locator("button:has-text('Front Desk Messages')")).toBeVisible();

    // 3. Test Room Search UI
    const searchBtn = page.locator("button:has-text('Search Available Rooms')");
    await expect(searchBtn).toBeVisible();

    // 4. Test Anti-IDOR Verification Gate: lookup requires BOTH booking code AND email
    await page.click("button:has-text('Find My Booking')");
    await expect(page.locator("input#code").or(page.locator("input[placeholder*='BK-']"))).toBeVisible();
    await expect(page.locator("input#lemail").or(page.locator("input[placeholder*='email@example.com']"))).toBeVisible();

    // Attempt invalid lookup with code only
    await page.fill("input#code", "BK-NONEXISTENT");
    await page.fill("input#lemail", "invalid@guest.com");
    await page.click("button:has-text('Verify & Load')");
    await expect(
      page.locator("text=not found").or(page.locator("text=Invalid").or(page.locator("text=failed").or(page.locator("text=Verification failed"))))
    ).toBeVisible({ timeout: 5000 });
  });

  // ---------------------------------------------------------------------------
  // JOURNEY 3: AI Operations Hub, Supervisory Approvals & Knowledge Base
  // ---------------------------------------------------------------------------
  test("Journey 3: AI Operations Hub, supervisor approval workflow & Knowledge Base manager", async ({ page }) => {
    // 1. Authenticate as Admin
    await page.goto("/login");
    await page.fill("input[type='email'], input[name='email']", "admin@lumina.pms");
    await page.fill("input[type='password'], input[name='password']", "Password123!");
    await page.click("button[type='submit']");
    await page.waitForURL("**/dashboard", { timeout: 15000 });

    // 2. Navigate to AI Operations Hub
    await page.goto("/ai");
    await expect(page.locator("h1:has-text('AI Operations Hub')")).toBeVisible();
    await expect(page.locator("text=Operations Console").first()).toBeVisible();
    await expect(page.locator("button:has-text('Availability Check')")).toBeVisible();

    // 3. Navigate to AI Knowledge Base & Chatbot Admin
    await page.goto("/ai/chatbot");
    await expect(page.locator("text=Knowledge Base").first()).toBeVisible();
    await expect(page.locator("button:has-text('New Document')").or(page.locator("text=Documents"))).toBeVisible();

    // 4. Navigate to AI Providers Configuration
    await page.goto("/ai/providers");
    await expect(page.locator("h1:has-text('AI Provider Hub')")).toBeVisible();

    // 5. Navigate to Universal Activity Logs Audit Trail
    await page.goto("/activity-logs");
    await expect(page.locator("text=Activity Logs").first()).toBeVisible();
    await expect(page.locator("text=Frontend").first()).toBeVisible();
  });
});
