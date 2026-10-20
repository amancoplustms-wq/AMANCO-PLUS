import type { Metadata, Viewport } from 'next';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://amanco-plus.com';

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'أمانكو بلس للشحن والتوريد | AMANCO PLUS',
    template: '%s | أمانكو بلس',
  },
  description:
    'شركة أمانكو بلس للشحن والتوريد (AMANCO PLUS) - خدمات لوجستية متكاملة وشحن وتوريد سريع وآمن في القاهرة والجيزة والقليوبية. تتبع شحنتك برقم البوليصة.',
  keywords: [
    'شحن وتوريد',
    'أمانكو بلس',
    'AMANCO PLUS',
    'شركة شحن',
    'توريد بضائع',
    'القاهرة',
    'الجيزة',
    'القليوبية',
    'تتبع شحنة',
    'شحن فوري',
    'لوجستيات مصر',
  ],
  authors: [{ name: 'أمانكو بلس للشحن والتوريد | AMANCO PLUS' }],
  creator: 'أمانكو بلس',
  publisher: 'أمانكو بلس',
  formatDetection: {
    telephone: true,
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'ar_EG',
    url: siteUrl,
    siteName: 'أمانكو بلس للشحن والتوريد | AMANCO PLUS',
    title: 'أمانكو بلس للشحن والتوريد | AMANCO PLUS',
    description:
      'خدمات لوجستية متكاملة وشحن وتوريد سريع وآمن في القاهرة والجيزة والقليوبية. تتبع شحنتك لحظة بلحظة.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'أمانكو بلس للشحن والتوريد - AMANCO PLUS',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'أمانكو بلس للشحن والتوريد | AMANCO PLUS',
    description:
      'خدمات لوجستية متكاملة وشحن وتوريد سريع وآمن في القاهرة والجيزة والقليوبية. تتبع شحنتك لحظة بلحظة.',
    images: ['/og-image.png'],
    creator: '@amancoplus',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
