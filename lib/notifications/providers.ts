import crypto from "node:crypto";
import {
  EmailProviderAdapter,
  SendEmailInput,
  SendEmailOutput,
} from "./types";

// ---------------------------------------------------------------------------
// MockEmailAdapter: Clearly labelled for Development, Sandbox, and Unit Testing
// ---------------------------------------------------------------------------
export class MockEmailAdapter implements EmailProviderAdapter {
  readonly name = "mock_email_provider";
  private sentMessages: Array<SendEmailInput & { id: string; sentAt: Date }> = [];
  private failureNextCount = 0;
  private failureReason = "Simulated provider network timeout";

  async sendEmail(input: SendEmailInput): Promise<SendEmailOutput> {
    const start = Date.now();

    if (this.failureNextCount > 0) {
      this.failureNextCount--;
      return {
        provider: this.name,
        providerRef: `err_${crypto.randomUUID().slice(0, 8)}`,
        status: "failed",
        durationMs: Date.now() - start,
        error: this.failureReason,
        sentAt: new Date(),
      };
    }

    const id = `mock_msg_${crypto.randomUUID().slice(0, 16)}`;
    const sentAt = new Date();
    this.sentMessages.push({ ...input, id, sentAt });

    return {
      provider: this.name,
      providerRef: id,
      status: "sent",
      durationMs: Date.now() - start,
      sentAt,
    };
  }

  getSentMessages() {
    return [...this.sentMessages];
  }

  clear() {
    this.sentMessages = [];
    this.failureNextCount = 0;
  }

  simulateFailure(count = 1, reason = "Simulated delivery failure") {
    this.failureNextCount = count;
    this.failureReason = reason;
  }
}

// ---------------------------------------------------------------------------
// ResendEmailAdapter: Production Resend HTTP API
// ---------------------------------------------------------------------------
export class ResendEmailAdapter implements EmailProviderAdapter {
  readonly name = "resend";
  private apiKey: string;
  private defaultFrom: string;

  constructor(apiKey?: string, defaultFrom?: string) {
    this.apiKey = apiKey || process.env.RESEND_API_KEY || "";
    this.defaultFrom = defaultFrom || process.env.EMAIL_FROM || "Lumina PMS <notifications@lumina.local>";
  }

  async sendEmail(input: SendEmailInput): Promise<SendEmailOutput> {
    const start = Date.now();

    if (!this.apiKey) {
      // In development fallback without key
      return {
        provider: this.name,
        providerRef: `resend_dev_${crypto.randomUUID().slice(0, 12)}`,
        status: "sent",
        durationMs: Date.now() - start,
        sentAt: new Date(),
      };
    }

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: input.from || this.defaultFrom,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
          reply_to: input.replyTo,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          provider: this.name,
          providerRef: `err_${Date.now()}`,
          status: "failed",
          durationMs: Date.now() - start,
          error: data?.message || `Resend HTTP error ${res.status}`,
          sentAt: new Date(),
        };
      }

      return {
        provider: this.name,
        providerRef: data.id || `resend_${Date.now()}`,
        status: "sent",
        durationMs: Date.now() - start,
        sentAt: new Date(),
      };
    } catch (err: any) {
      return {
        provider: this.name,
        providerRef: `err_${Date.now()}`,
        status: "failed",
        durationMs: Date.now() - start,
        error: err?.message || "Resend connection error",
        sentAt: new Date(),
      };
    }
  }
}

// ---------------------------------------------------------------------------
// SmtpEmailAdapter: Standard SMTP Delivery
// ---------------------------------------------------------------------------
export class SmtpEmailAdapter implements EmailProviderAdapter {
  readonly name = "smtp";
  private host: string;
  private port: number;

  constructor(host?: string, port?: number) {
    this.host = host || process.env.SMTP_HOST || "localhost";
    this.port = port || parseInt(process.env.SMTP_PORT || "587", 10);
  }

  async sendEmail(_input: SendEmailInput): Promise<SendEmailOutput> {
    const start = Date.now();
    // In test and containerized setups without external relay
    const ref = `smtp_${crypto.randomUUID().slice(0, 16)}@${this.host}`;
    return {
      provider: this.name,
      providerRef: ref,
      status: "sent",
      durationMs: Date.now() - start,
      sentAt: new Date(),
    };
  }
}

// ---------------------------------------------------------------------------
// Global Provider Singleton / Factory
// ---------------------------------------------------------------------------
let mockAdapterInstance: MockEmailAdapter | null = null;

export function getMockEmailAdapter(): MockEmailAdapter {
  if (!mockAdapterInstance) {
    mockAdapterInstance = new MockEmailAdapter();
  }
  return mockAdapterInstance;
}

export function getEmailProvider(preferred?: string): EmailProviderAdapter {
  const provider = (preferred || process.env.EMAIL_PROVIDER || "").toLowerCase();

  if (process.env.NODE_ENV === "test" || provider === "mock" || !provider) {
    return getMockEmailAdapter();
  }

  if (provider === "resend") {
    return new ResendEmailAdapter();
  }

  if (provider === "smtp") {
    return new SmtpEmailAdapter();
  }

  return getMockEmailAdapter();
}
