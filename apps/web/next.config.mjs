/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const api = process.env.API_INTERNAL_URL ?? "http://localhost:3000";
    return [
      { source: "/api/:path*", destination: `${api}/api/:path*` },
      { source: "/tax/:path*", destination: `${api}/tax/:path*` },
    ];
  },
};

export default nextConfig;
