import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "XPer API",
  description: "XPer Finance API Documentation",
  applicationName: "XPer Finance",
  appleWebApp: {
    capable: true,
    title: "XPer",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/vite.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
