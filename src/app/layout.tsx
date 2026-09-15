import type { Metadata, Viewport } from "next";
import { Archivo_Black, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { PWA } from "@/components/PWA";

const display = Archivo_Black({ subsets: ["latin"], weight: "400", variable: "--font-display" });
const body = DM_Sans({ subsets: ["latin"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Money Heist — Hunt for Money",
  description: "QR treasure hunt. Crack the clues, beat the clock, bank the credits.",
  applicationName: "Hunt for Money",
  appleWebApp: {
    capable: true,
    title: "Hunt for Money",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#14110F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        {children}
        <PWA />
      </body>
    </html>
  );
}
