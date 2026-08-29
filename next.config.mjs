/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  images: {
    // Must stay in sync with ALLOWED_HOSTS in src/lib/swiggy-image.ts — an
    // unlisted host fails at request time and blanks the card.
    remotePatterns: [
      { protocol: "https", hostname: "media-assets.swiggy.com" },
      { protocol: "https", hostname: "rmpassets.swiggystatic.com" },
      { protocol: "https", hostname: "res.cloudinary.com" }
    ]
  }
};

export default nextConfig;
