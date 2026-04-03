import type { Metadata } from "next";
import localFont from "next/font/local";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = localFont({
  src: [
    { path: "../../node_modules/@fontsource/inter/files/inter-latin-300-normal.woff2", weight: "300" },
    { path: "../../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2", weight: "400" },
    { path: "../../node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2", weight: "500" },
    { path: "../../node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2", weight: "600" },
    { path: "../../node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-sans",
});

const geistMono = localFont({
  src: "../../node_modules/geist/dist/fonts/geist-mono/GeistMono-Regular.woff2",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "MediQueue Pro — Smart Hospital Queue Management System",
  description:
    "Experience seamless hospital visits with intelligent queue tracking, appointment booking, and digital waiting rooms. AI-powered healthcare platform.",
  keywords: [
    "hospital queue management",
    "appointment booking",
    "digital waiting room",
    "healthcare SaaS",
    "patient queue system",
  ],
  openGraph: {
    title: "MediQueue Pro — Smart Hospital Queue Management",
    description:
      "AI-powered hospital queue management with real-time updates, appointment booking, and digital waiting rooms.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={cn(inter.variable, geistMono.variable)} suppressHydrationWarning>
        <body className="antialiased">
          {children}
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
