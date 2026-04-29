import type { Metadata } from "next";
import "./globals.css";

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
      <body className="grain min-h-screen">{children}</body>
    </html>
  );
}
