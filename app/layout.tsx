import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Mill Wall Tracker",
  description:
    "Tablet-first wall production tracking for The Mill Wood Systems",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico?v=circle-2" },
      { url: "/favicon-32.png?v=circle-2", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/icon-180.png?v=circle-2", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
