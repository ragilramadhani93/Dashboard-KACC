import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KACC Dashboard | Monitoring Transaksi Outlet",
  description:
    "Dashboard monitoring transaksi harian KACC (Kopi Aku Coffe Corner) dengan auto-refresh dari Google Sheets. KPI revenue, transaksi, outlet, menu, payment, dan operasional.",
  keywords: [
    "KACC",
    "dashboard",
    "monitoring",
    "transaksi",
    "outlet",
    "kopi",
    "Indonesia",
  ],
  authors: [{ name: "KACC Operations" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
