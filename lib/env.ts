import { z } from "zod";

const INSECURE_AUTH_SECRETS = [
  "lumina-dev-only-insecure-secret-change-me-32b",
  "change-me-in-production",
  "generate-with-openssl-rand-base64-32",
];

const ZERO_KEY = "0000000000000000000000000000000000000000000000000000000000000000";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1).default("file:./dev.db"),
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters").default("lumina-dev-only-insecure-secret-change-me-32b"),
    AUTH_ENCRYPTION_KEY: z.string().default(ZERO_KEY),
    AUTH_URL: z.string().default("http://localhost:3000"),
    AUTH_TRUST_HOST: z.string().default("true"),
    NEXT_PUBLIC_APP_NAME: z.string().default("Lumina PMS"),
    NEXT_PUBLIC_SUPPORT_EMAIL: z.string().default("support@lumina.pms"),
    NEXT_PUBLIC_CHATBOT_ENABLED: z.string().default("true"),
    NEXT_PUBLIC_DEFAULT_TIMEZONE: z.string().default("America/New_York"),
    EMAIL_PROVIDER: z.string().default("log"),
    EMAIL_FROM: z.string().default("no-reply@lumina.pms"),
    SMTP_HOST: z.string().default(""),
    SMTP_PORT: z.string().default("587"),
    SMTP_USER: z.string().default(""),
    SMTP_PASS: z.string().default(""),
    INTEGRATION_ENCRYPTION_KEY: z.string().default(ZERO_KEY),
    INTEGRATION_WEBHOOK_SECRET: z.string().default("dev-only-webhook-secret-0123456789abcdef"),
    ALLOW_PRODUCTION_SEED: z.string().optional(),
    SEED_ADMIN_PASSWORD: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // When running in production (outside Next.js build phase), refuse insecure defaults and zero keys
    const isProductionRuntime =
      (data.NODE_ENV === "production" || process.env.NODE_ENV === "production") &&
      process.env.NEXT_PHASE !== "phase-production-build";

    if (isProductionRuntime) {
      if (INSECURE_AUTH_SECRETS.includes(data.AUTH_SECRET)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AUTH_SECRET"],
          message:
            "In production, AUTH_SECRET cannot use default or insecure values.",
        });
      }
      if (data.AUTH_ENCRYPTION_KEY === ZERO_KEY || !/^[0-9a-fA-F]{64}$/.test(data.AUTH_ENCRYPTION_KEY)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AUTH_ENCRYPTION_KEY"],
          message:
            "In production, AUTH_ENCRYPTION_KEY must be a 64-character hex string and cannot be the zero key.",
        });
      }
      if (
        data.INTEGRATION_ENCRYPTION_KEY === ZERO_KEY ||
        !/^[0-9a-fA-F]{64}$/.test(data.INTEGRATION_ENCRYPTION_KEY)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["INTEGRATION_ENCRYPTION_KEY"],
          message:
            "In production, INTEGRATION_ENCRYPTION_KEY must be a 64-character hex string and cannot be the zero key.",
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = JSON.stringify(parsed.error.format(), null, 2);
  console.error("[lumina] Invalid environment configuration:\n", formatted);
  throw new Error(`[lumina] Invalid environment configuration: ${parsed.error.message}`);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
