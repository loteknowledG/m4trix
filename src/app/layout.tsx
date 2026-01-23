import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";

import "./globals.css";

import { ThemeProvider } from "@/components/providers/theme-provider";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.APP_URL
      ? `${process.env.APP_URL}`
      : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${process.env.PORT || 3000}`
  ),
  title: "matrix",
  description:
    "A stunning and functional retractable sidebar for Next.js built on top of shadcn/ui complete with desktop and mobile responsiveness.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    url: "/",
    title: "shadcn/ui sidebar",
    description:
      "A stunning and functional retractable sidebar for Next.js built on top of shadcn/ui complete with desktop and mobile responsiveness.",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "shadcn/ui sidebar",
    description:
      "A stunning and functional retractable sidebar for Next.js built on top of shadcn/ui complete with desktop and mobile responsiveness."
  }
};

import crypto from "crypto";

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.NODE_ENV !== "production";

  // Generate a nonce for each request
  const nonce = crypto.randomBytes(16).toString("base64");

  const devCsp =
    `default-src 'self' http://localhost:3000; script-src 'self' http://localhost:3000 'unsafe-inline' 'unsafe-eval' 'nonce-${nonce}'; style-src 'self' http://localhost:3000 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' http://localhost:3000 ws://localhost:3000; object-src 'none'; base-uri 'self'`;

  const prodCsp =
    `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'`;

  return (
    <html lang="en" suppressHydrationWarning nonce={nonce}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Mrs+Saint+Delafield&family=Satisfy&display=swap" rel="stylesheet" />
        <meta
          httpEquiv="Content-Security-Policy"
          content={isDev ? devCsp : prodCsp}
        />
      </head>
      <body className={GeistSans.className} nonce={nonce}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
