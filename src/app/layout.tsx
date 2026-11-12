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
