import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  compress: true,
  // Keep native/PDF worker packages out of the Turbopack/webpack bundle (fixes
  // "Object.defineProperty called on non-object" from pdf-parse / pdfjs-dist).
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
    "pdf-parse",
    "@napi-rs/canvas",
  ],
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-dialog",
      "date-fns",
    ],
  },
  /** Keep more compiled pages warm during `next dev` (faster sidebar navigation). */
  onDemandEntries: {
    maxInactiveAge: 120 * 1000,
    pagesBufferLength: 16,
  },
  async redirects() {
    return [
      {
        source: "/favicon.ico",
        destination: "/Softora-favicon.png",
        permanent: false,
      },
    ];
  },
  async headers() {
    if (process.env.NODE_ENV !== "production") return [];
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/Softora-favicon.png",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400",
          },
        ],
      },
      {
        source: "/favicon.ico",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400",
          },
        ],
      },
    ];
  },
  images: supabaseHost
    ? {
        remotePatterns: [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ],
      }
    : undefined,
};

export default nextConfig;
