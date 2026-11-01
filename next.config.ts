import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Médias envoyés par les membres et l'administration (Vercel Blob).
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
};

export default nextConfig;
