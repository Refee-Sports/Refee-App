import type { Metadata, Viewport } from "next";
import { Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { RouteGate } from "@/components/providers/RouteGate";

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter-tight",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const SITE_URL = "https://refee.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Refee — The on-demand marketplace for sports officials",
    template: "%s · Refee",
  },
  description:
    "Refee connects vetted referees and umpires with the leagues that need them. Officials get booked and paid. Leagues staff every game. Download the app.",
  keywords: [
    "sports officials",
    "referees",
    "umpires",
    "youth sports",
    "referee jobs",
    "assign officials",
    "sports league staffing",
  ],
  openGraph: {
    title: "Refee — The on-demand marketplace for sports officials",
    description:
      "Officials get booked and paid. Leagues staff every game. Vetted, background-checked, on-demand.",
    url: SITE_URL,
    siteName: "Refee",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Refee — The on-demand marketplace for sports officials",
    description:
      "Officials get booked and paid. Leagues staff every game. Vetted, background-checked, on-demand.",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#08111C",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${interTight.variable} ${jetBrainsMono.variable}`}
    >
      {/* font-body (500) matches the mobile app's Inter Tight body weight */}
      <body className="font-body">
        <AuthProvider>
          <RouteGate>{children}</RouteGate>
        </AuthProvider>
      </body>
    </html>
  );
}
