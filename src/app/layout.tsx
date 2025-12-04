
import { Inter } from "next/font/google";
import "../styles/globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import type { Metadata } from "next";
import type { ReactNode } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "XPer Finance",
  description: "Personal finance and trading journal",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="bg-slate-50">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="XPer Finance" />
        <meta name="application-name" content="XPer Finance" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={`${inter.className} min-h-screen bg-slate-50 text-slate-900 antialiased`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
