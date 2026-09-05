/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: { "/api/public-registration-state": ["./database/registration_hot_path.sql"], "/api/admin/registration-waiting": ["./database/registration_hot_path.sql"] },
  turbopack: {
    root: process.cwd()
  }
};

export default nextConfig;
