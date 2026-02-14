import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { Mrs_Saint_Delafield, Satisfy } from 'next/font/google';
import { headers } from 'next/headers';

import './globals.css';

import { ThemeProvider } from '@/components/providers/theme-provider';
// Register service worker for PWA
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

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
  title: 'matrix',
  description:
    'A stunning and functional retractable sidebar for Next.js built on top of shadcn/ui complete with desktop and mobile responsiveness.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    url: '/',
    title: 'shadcn/ui sidebar',
    description:
      'A stunning and functional retractable sidebar for Next.js built on top of shadcn/ui complete with desktop and mobile responsiveness.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'shadcn/ui sidebar',
    description:
      'A stunning and functional retractable sidebar for Next.js built on top of shadcn/ui complete with desktop and mobile responsiveness.',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Removed unused CSP / env helpers to satisfy linter

  const reqHeaders = await headers();
  const nonce = reqHeaders.get('x-csp-nonce') ?? '';

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        {nonce ? (
          <script
            nonce={nonce}
            dangerouslySetInnerHTML={{ __html: `window.__CSP_NONCE = ${JSON.stringify(nonce)}` }}
          />
        ) : null}
      </head>
      <body
        className={`${GeistSans.className} ${SignatureScript.variable} ${SatisfyScript.variable} h-screen overflow-y-hidden overflow-x-auto`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="app-min-width-wrapper">
            {children}
            <script suppressHydrationWarning={true} />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
