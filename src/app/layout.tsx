import type { Metadata, Viewport } from "next";
import "./globals.css";

/**
 * Declaring both schemes stops a browser's force-dark filter from inventing its
 * own dark theme over the cream palette — which is what shipped to real phones
 * before this, and looked like mud.
 */
export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8F5EF" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1211" }
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "GlycoCart — Order food that works for your body",
  description:
    "A glucose-aware ordering agent for PCOS, prediabetes & metabolic health. Built on Swiggy's MCP.",
  icons: {
    icon: "/glycocart_logo.png",
    apple: "/glycocart_logo.png",
  },
  openGraph: {
    title: "GlycoCart",
    description: "Glucose-aware ordering. For your body, not against it.",
    type: "website",
    images: ["/glycocart_logo.png"],
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="grain min-h-dvh">{children}</body>
    </html>
  );
}
