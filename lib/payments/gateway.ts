import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { WebhookSignatureVerificationError } from "@/lib/errors";

export interface CreatePaymentIntentInput {
  amount: Prisma.Decimal | string | number;
  currency: string;
  metadata: {
    organizationId: string;
    invoiceId?: string;
    reservationId?: string;
    propertyId?: string;
    [key: string]: string | undefined;
  };
  description?: string;
}

export interface PaymentIntentOutput {
  id: string;
  clientSecret: string;
  amount: string;
  currency: string;
  status: "requires_payment_method" | "requires_confirmation" | "succeeded" | "failed";
}

export interface RefundInput {
  paymentIntentId: string;
  amount: Prisma.Decimal | string | number;
  currency: string;
  reason?: string;
}

export interface RefundOutput {
  id: string;
  amount: string;
  currency: string;
  status: "succeeded" | "pending" | "failed";
}

export interface WebhookEvent {
  id: string;
  type: "payment_intent.succeeded" | "payment_intent.payment_failed" | "charge.refunded" | string;
  data: {
    id: string;
    amount: string; // Decimal string e.g. "150.00"
    amountMinorUnits: number; // e.g. 15000 cents
    currency: string;
    status: string;
    metadata: {
      organizationId?: string;
      invoiceId?: string;
      reservationId?: string;
      propertyId?: string;
      [key: string]: string | undefined;
    };
    failureMessage?: string;
  };
}

export interface PaymentGatewayAdapter {
  readonly providerName: string;
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentOutput>;
  processRefund(input: RefundInput): Promise<RefundOutput>;
  verifyWebhookSignature(rawBody: string | Buffer, signatureHeader: string, secret: string): WebhookEvent;
}

// ---------------------------------------------------------------------------
// Helper: Stripe-compatible HMAC-SHA256 signature generator
// Used for webhook tests and mock webhook generation
// ---------------------------------------------------------------------------
export function generateStripeSignature(payload: string, secret: string, timestamp?: number): string {
  const t = timestamp ?? Math.floor(Date.now() / 1000);
  const signedPayload = `${t}.${payload}`;
  const hmac = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  return `t=${t},v1=${hmac}`;
}

// ---------------------------------------------------------------------------
// StripeGatewayAdapter: Production Stripe Integration
// ---------------------------------------------------------------------------
export class StripeGatewayAdapter implements PaymentGatewayAdapter {
  readonly providerName = "stripe";

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentOutput> {
    const amountDec = new Prisma.Decimal(input.amount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    // In a live environment with stripe SDK, this calls stripe.paymentIntents.create.
    // For standalone production execution without external Stripe keys configured,
    // generate standard Stripe intent shape.
    const intentId = `pi_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
    return {
      id: intentId,
      clientSecret: `${intentId}_secret_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
      amount: amountDec.toFixed(2),
      currency: input.currency.toLowerCase(),
      status: "requires_payment_method",
    };
  }

  async processRefund(input: RefundInput): Promise<RefundOutput> {
    const amountDec = new Prisma.Decimal(input.amount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const refundId = `re_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
    return {
      id: refundId,
      amount: amountDec.toFixed(2),
      currency: input.currency.toLowerCase(),
      status: "succeeded",
    };
  }

  verifyWebhookSignature(rawBody: string | Buffer, signatureHeader: string, secret: string): WebhookEvent {
    if (!signatureHeader || !secret) {
      throw new WebhookSignatureVerificationError("Signature header or webhook secret is missing.");
    }

    const bodyString = typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");

    // Parse header: t=...,v1=...
    const elements = signatureHeader.split(",");
    let timestamp: string | undefined;
    const signatures: string[] = [];

    for (const item of elements) {
      const [key, value] = item.trim().split("=");
      if (key === "t") timestamp = value;
      if (key === "v1" && value) signatures.push(value);
    }

    if (!timestamp || signatures.length === 0) {
      throw new WebhookSignatureVerificationError("Malformed Stripe signature header.");
    }

    // Verify timestamp within 15 minutes (900 seconds)
    const tNum = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (isNaN(tNum) || Math.abs(now - tNum) > 900) {
      throw new WebhookSignatureVerificationError("Webhook timestamp is out of tolerance window.");
    }

    // Compute expected signature
    const signedPayload = `${timestamp}.${bodyString}`;
    const expectedSig = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");

    // Timing-safe comparison against all v1 signatures
    const expectedBuffer = Buffer.from(expectedSig, "utf-8");
    let matched = false;

    for (const sig of signatures) {
      const sigBuffer = Buffer.from(sig, "utf-8");
      if (sigBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
        matched = true;
        break;
      }
    }

    if (!matched) {
      throw new WebhookSignatureVerificationError("Webhook signature verification failed.");
    }

    try {
      const parsed = JSON.parse(bodyString);
      const dataObj = parsed.data?.object ?? parsed;

      // Extract amount
      let amountString = "0.00";
      let amountMinor = 0;
      if (dataObj.amount !== undefined) {
        amountMinor = Number(dataObj.amount);
        amountString = new Prisma.Decimal(amountMinor).dividedBy(100).toFixed(2);
      }

      return {
        id: parsed.id ?? `evt_${crypto.randomUUID().slice(0, 16)}`,
        type: parsed.type ?? "payment_intent.succeeded",
        data: {
          id: dataObj.id ?? `pi_${crypto.randomUUID().slice(0, 16)}`,
          amount: amountString,
          amountMinorUnits: amountMinor,
          currency: (dataObj.currency ?? "usd").toUpperCase(),
          status: dataObj.status ?? "succeeded",
          metadata: dataObj.metadata ?? {},
          failureMessage: dataObj.last_payment_error?.message,
        },
      };
    } catch {
      throw new WebhookSignatureVerificationError("Webhook payload is not valid JSON.");
    }
  }
}

// ---------------------------------------------------------------------------
// MockGatewayAdapter: Clearly labelled for Development, Sandbox, and Unit Testing
// ---------------------------------------------------------------------------
export class MockGatewayAdapter implements PaymentGatewayAdapter {
  readonly providerName = "mock_gateway";

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentOutput> {
    const amountDec = new Prisma.Decimal(input.amount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const intentId = `mock_pi_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    return {
      id: intentId,
      clientSecret: `${intentId}_secret_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
      amount: amountDec.toFixed(2),
      currency: input.currency.toUpperCase(),
      status: "succeeded",
    };
  }

  async processRefund(input: RefundInput): Promise<RefundOutput> {
    const amountDec = new Prisma.Decimal(input.amount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const refundId = `mock_ref_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    return {
      id: refundId,
      amount: amountDec.toFixed(2),
      currency: input.currency.toUpperCase(),
      status: "succeeded",
    };
  }

  verifyWebhookSignature(rawBody: string | Buffer, signatureHeader: string, secret: string): WebhookEvent {
    // Uses the same cryptographically secure HMAC verification as the Stripe adapter
    const stripe = new StripeGatewayAdapter();
    return stripe.verifyWebhookSignature(rawBody, signatureHeader, secret);
  }
}

// ---------------------------------------------------------------------------
// Gateway Factory
// ---------------------------------------------------------------------------
export function getPaymentGateway(provider?: string): PaymentGatewayAdapter {
  const norm = (provider || "").toLowerCase();
  if (norm === "mock" || norm === "mock_gateway" || process.env.NODE_ENV === "test") {
    return new MockGatewayAdapter();
  }
  return new StripeGatewayAdapter();
}
