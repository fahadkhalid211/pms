/** @type {import('next').NextConfig} */
const allowedOrigins = [
  "localhost:3000",
  "127.0.0.1:3000",
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "penthousepms.com",
  "www.penthousepms.com",
  "olive-pigeon-172996.hostingersite.com",
];

const authUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
if (authUrl) {
  try {
    const u = new URL(authUrl);
    if (!allowedOrigins.includes(u.host)) allowedOrigins.push(u.host);
    if (u.hostname && !allowedOrigins.includes(u.hostname)) allowedOrigins.push(u.hostname);
  } catch {}
}

if (process.env.NEXT_PUBLIC_APP_URL) {
  try {
    const u = new URL(process.env.NEXT_PUBLIC_APP_URL);
    if (!allowedOrigins.includes(u.host)) allowedOrigins.push(u.host);
    if (u.hostname && !allowedOrigins.includes(u.hostname)) allowedOrigins.push(u.hostname);
  } catch {}
}

if (process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS.split(",").forEach((o) => {
    const trimmed = o.trim();
    if (trimmed && !allowedOrigins.includes(trimmed)) {
      allowedOrigins.push(trimmed);
    }
  });
}

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  serverExternalPackages: ["bcryptjs", "@prisma/client"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
  async headers() {
    return [
      // ---------------------------------------------------------------
      // Auth & protected pages — NEVER cache on CDN or browser.
      // Hostinger hcdn respects Cache-Control and CDN-Cache-Control.
      // ---------------------------------------------------------------
      {
        source: "/login",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Surrogate-Control", value: "no-store" },
        ],
      },
      {
        source: "/register",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Surrogate-Control", value: "no-store" },
        ],
      },
      {
        source: "/(dashboard|analytics|reservations|frontdesk|calendar|rooms|properties|billing|housekeeping|maintenance|reports|staff|settings|ai|guests|integrations|support|notifications|activity-logs)(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Surrogate-Control", value: "no-store" },
        ],
      },
      // ---------------------------------------------------------------
      // API routes — always dynamic, never cached
      // ---------------------------------------------------------------
      {
        source: "/api/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
          { key: "CDN-Cache-Control", value: "no-store" },
        ],
      },
      // ---------------------------------------------------------------
      // Global security headers for all other routes
      // ---------------------------------------------------------------
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
