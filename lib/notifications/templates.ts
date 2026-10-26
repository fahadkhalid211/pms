import { PropertyBrand } from "./types";

export interface CompiledTemplate {
  subject: string;
  html: string;
  text: string;
}

export type TemplateCode =
  | "pre_arrival"
  | "check_in_welcome"
  | "check_out_thanks"
  | "payment_receipt"
  | "payment_reminder";

function interpolate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
    const val = vars[key];
    return val !== undefined && val !== null ? String(val) : "";
  });
}

function wrapBrandedHtml(content: string, brand: PropertyBrand): string {
  const brandColor = brand.brandColor || "#0ea5e9";
  const propertyName = brand.name || "Lumina Hospitality";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${propertyName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .header { background: ${brandColor}; padding: 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
    .content { padding: 32px 24px; line-height: 1.6; font-size: 15px; }
    .btn { display: inline-block; background-color: ${brandColor}; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px; margin-top: 16px; }
    .card { background-color: #f1f5f9; border-radius: 6px; padding: 16px; margin: 20px 0; font-size: 14px; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${propertyName}</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <div><strong>${propertyName}</strong></div>
      ${brand.address ? `<div>${brand.address}</div>` : ""}
      ${brand.phone || brand.email ? `<div>${[brand.phone, brand.email].filter(Boolean).join(" · ")}</div>` : ""}
      <div style="margin-top: 8px; color: #94a3b8;">Sent securely via Lumina Property Management System</div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function renderTemplate(
  code: string,
  variables: Record<string, unknown>,
  brand?: PropertyBrand,
): CompiledTemplate {
  const b: PropertyBrand = brand || {
    name: (variables.propertyName as string) || "Lumina Resort",
    address: (variables.propertyAddress as string) || "100 Luxury Avenue",
    email: (variables.propertyEmail as string) || "frontdesk@lumina.local",
    brandColor: "#0ea5e9",
  };

  const v: Record<string, any> = {
    ...variables,
    propertyName: b.name,
    propertyAddress: b.address,
    propertyPhone: b.phone,
    propertyEmail: b.email,
  };

  switch (code) {
    case "pre_arrival": {
      const subject = interpolate(
        "Your Upcoming Stay at {{propertyName}} - Reservation {{bookingCode}}",
        v,
      );
      const innerHtml = `
        <p>Dear <strong>{{guestName}}</strong>,</p>
        <p>We are delighted to welcome you to <strong>{{propertyName}}</strong>. Your reservation is confirmed and our team is preparing for your arrival.</p>
        <div class="card">
          <div><strong>Booking Reference:</strong> {{bookingCode}}</div>
          <div><strong>Check-in Date:</strong> {{checkInDate}}</div>
          <div><strong>Check-out Date:</strong> {{checkOutDate}}</div>
          <div><strong>Room Type:</strong> {{roomType}}</div>
          <div><strong>Check-in Time:</strong> From 3:00 PM</div>
        </div>
        <p>Please have a valid government-issued photo ID available upon arrival for our expedited digital check-in.</p>
        <p>If you have any special requests or anticipate a late arrival, reply directly to this email or contact front desk.</p>
      `;
      const text = interpolate(
        `Dear {{guestName}},\n\nYour upcoming stay at {{propertyName}} is confirmed!\n\nBooking: {{bookingCode}}\nCheck-in: {{checkInDate}}\nCheck-out: {{checkOutDate}}\nRoom: {{roomType}}\n\nWe look forward to welcoming you.\n\n{{propertyName}}\n{{propertyAddress}}`,
        v,
      );
      return {
        subject,
        html: wrapBrandedHtml(interpolate(innerHtml, v), b),
        text,
      };
    }

    case "check_in_welcome": {
      const subject = interpolate("Welcome to {{propertyName}}! (Room {{roomNumber}})", v);
      const innerHtml = `
        <p>Dear <strong>{{guestName}}</strong>,</p>
        <p>Welcome! You are now checked in to <strong>Room {{roomNumber}}</strong> at {{propertyName}}.</p>
        <div class="card">
          <div><strong>Room:</strong> {{roomNumber}}</div>
          <div><strong>Wi-Fi Network:</strong> {{wifiSsid}}</div>
          <div><strong>Wi-Fi Password:</strong> {{wifiPassword}}</div>
          <div><strong>Check-out Time:</strong> 11:00 AM on {{checkOutDate}}</div>
        </div>
        <p>Dial '0' from your in-room phone or visit the front desk if you require housekeeping, room service, or local recommendations.</p>
        <p>Enjoy your stay with us!</p>
      `;
      const text = interpolate(
        `Welcome to {{propertyName}}, {{guestName}}!\n\nYou are checked into Room {{roomNumber}}.\nWi-Fi: {{wifiSsid}} / {{wifiPassword}}\nCheckout: 11:00 AM on {{checkOutDate}}.\n\nEnjoy your stay!`,
        v,
      );
      return {
        subject,
        html: wrapBrandedHtml(interpolate(innerHtml, v), b),
        text,
      };
    }

    case "check_out_thanks": {
      const subject = interpolate("Thank You for Staying with Us - {{propertyName}}", v);
      const innerHtml = `
        <p>Dear <strong>{{guestName}}</strong>,</p>
        <p>Thank you for choosing <strong>{{propertyName}}</strong>. We hope you had a restful and memorable stay with us.</p>
        <div class="card">
          <div><strong>Booking Reference:</strong> {{bookingCode}}</div>
          <div><strong>Total Charges:</strong> $ {{totalAmount}}</div>
          <div><strong>Remaining Balance:</strong> $ {{balanceDue}}</div>
        </div>
        <p>Your digital folio and receipt have been finalized. You can view or print your complete folio online at any time.</p>
        ${v.reviewUrl ? `<p><a href="${v.reviewUrl}" class="btn">Share Your Experience</a></p>` : ""}
        <p>We hope to welcome you back again soon!</p>
      `;
      const text = interpolate(
        `Dear {{guestName}},\n\nThank you for staying at {{propertyName}}!\nBooking: {{bookingCode}}\nTotal: $ {{totalAmount}}\nBalance: $ {{balanceDue}}\n\nWe look forward to your next visit!`,
        v,
      );
      return {
        subject,
        html: wrapBrandedHtml(interpolate(innerHtml, v), b),
        text,
      };
    }

    case "payment_receipt": {
      const subject = interpolate(
        "Payment Receipt: {{invoiceNumber}} - {{propertyName}}",
        v,
      );
      const innerHtml = `
        <p>Dear <strong>{{guestName}}</strong>,</p>
        <p>Thank you for your payment. This email serves as your official receipt.</p>
        <div class="card">
          <div><strong>Invoice Number:</strong> {{invoiceNumber}}</div>
          <div><strong>Amount Paid:</strong> $ {{amountPaid}}</div>
          <div><strong>Payment Method:</strong> {{paymentMethod}}</div>
          <div><strong>Remaining Balance:</strong> $ {{balanceDue}}</div>
        </div>
        <p>Your guest folio has been credited and reconciled.</p>
      `;
      const text = interpolate(
        `Payment Receipt - {{propertyName}}\n\nInvoice: {{invoiceNumber}}\nAmount Paid: $ {{amountPaid}}\nPayment Method: {{paymentMethod}}\nRemaining Balance: $ {{balanceDue}}\n\nThank you for your payment.`,
        v,
      );
      return {
        subject,
        html: wrapBrandedHtml(interpolate(innerHtml, v), b),
        text,
      };
    }

    case "payment_reminder": {
      const balance = v.balanceDue || v.amountDue || "";
      const subject = interpolate(
        "Payment Reminder: Invoice {{invoiceNumber}} - {{propertyName}}",
        { ...v, balanceDue: balance },
      );
      const innerHtml = `
        <p>Dear <strong>{{guestName}}</strong>,</p>
        <p>This is a friendly reminder that an outstanding balance remains for your stay at <strong>{{propertyName}}</strong>.</p>
        <div class="card">
          <div><strong>Invoice Number:</strong> {{invoiceNumber}}</div>
          <div><strong>Outstanding Balance:</strong> ${String(balance).startsWith("$") ? balance : `$${balance}`}</div>
          <div><strong>Due Date:</strong> {{dueDate}}</div>
        </div>
        <p>Please settle this folio at your earliest convenience to prevent overdue charges.</p>
        ${v.paymentUrl ? `<p><a href="${v.paymentUrl}" class="btn">Pay Securely Online</a></p>` : ""}
      `;
      const text = interpolate(
        `Payment Reminder - {{propertyName}}\n\nInvoice: {{invoiceNumber}}\nOutstanding Balance: ${balance}\nDue Date: {{dueDate}}\n\nPlease contact us or visit the front desk to settle your balance.`,
        { ...v, balanceDue: balance },
      );
      return {
        subject,
        html: wrapBrandedHtml(interpolate(innerHtml, { ...v, balanceDue: balance }), b),
        text,
      };
    }

    default: {
      const subject = (variables.subject as string) || `${b.name} Notification`;
      const content = (variables.message as string) || (variables.bodyText as string) || "";
      return {
        subject,
        html: wrapBrandedHtml(`<p>${content}</p>`, b),
        text: content,
      };
    }
  }
}
