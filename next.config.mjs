/** @type {import('next').NextConfig} */
const allowedOrigins = [
  "localhost:3000",
  "127.0.0.1:3000",
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
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
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
