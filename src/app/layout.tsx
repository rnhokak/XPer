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
    <html lang="en" className="bg-muted">
      <body className={inter.className}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
