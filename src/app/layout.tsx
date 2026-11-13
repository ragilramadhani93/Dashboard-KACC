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
  title: "Kapal Api Coffee Corner | Sales Monitoring Dashboard",
  description:
    "Dashboard monitoring transaksi harian Kapal Api Coffee Corner (KACC) dengan auto-refresh dari Google Sheets. KPI revenue, transaksi, outlet, menu, payment, dan operasional.",
  keywords: [
    "Kapal Api",
    "Coffee Corner",
    "KACC",
    "dashboard",
    "sales monitoring",
    "transaksi",
    "outlet",
    "kopi",
    "Indonesia",
  ],
  authors: [{ name: "Kapal Api Coffee Corner Operations" }],
  icons: {
    icon: "/kapal-api-logo.jpg",
  },
};

const THEME_INIT_SCRIPT = `
try {
  var saved = localStorage.getItem('kacc-theme');
  var isDark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', isDark);
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <a href="#main-content" className="skip-link">
          Lewati ke konten utama
        </a>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
