import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { Mrs_Saint_Delafield, Satisfy } from 'next/font/google';

import { getAppReleaseVersion } from '@/lib/app-release-version.server';

import './globals.css';

import { AppUpdatePrompt } from '@/components/providers/app-update-prompt';
import { ThemeProvider } from '@/components/providers/theme-provider';

const SignatureScript = Mrs_Saint_Delafield({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-mrs-saint-delafield',
  display: 'swap',
});

const SatisfyScript = Satisfy({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-satisfy',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.APP_URL
      ? `${process.env.APP_URL}`
      : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${process.env.PORT || 3000}`
  ),
  title: 'm4trix',
  description: 'm4trix',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    url: '/',
    title: 'm4trix',
    description: 'm4trix',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'm4trix',
    description: 'm4trix',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const releaseVersion = getAppReleaseVersion();

  return (
    <html lang="en" suppressHydrationWarning data-m4trix-release={releaseVersion}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="m4trix-release" content={releaseVersion} />
      </head>
      <body
        className={`${GeistSans.className} ${SignatureScript.variable} ${SatisfyScript.variable} h-screen overflow-y-hidden overflow-x-auto`}
      >
        <ThemeProvider attribute="class" forcedTheme="dark">
          <div className="app-min-width-wrapper">
            <AppUpdatePrompt />
            {children}
            <script suppressHydrationWarning={true} />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
