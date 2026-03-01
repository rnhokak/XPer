
import { QueryProvider } from "@/components/providers/query-provider";
import { MoneyVisibilityProvider } from "@/components/providers/money-visibility";
import { Notifications } from "@/components/ui/notifications";
import { IOSOptimization } from "@/components/ios/ios-optimization";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "XPer Finance",
  description: "Personal finance and trading journal",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "XPer Finance",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="bg-slate-50">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="stylesheet" href="/styles/globals.css" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="XPer Finance" />
        <meta name="application-name" content="XPer Finance" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased" data-money-hidden="true">
        <IOSOptimization />
        <QueryProvider>
          <MoneyVisibilityProvider />
          <Notifications />
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
