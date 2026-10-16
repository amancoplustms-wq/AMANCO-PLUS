import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'أمانكو بلس للشحن والتوريد | AMANCO PLUS',
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
  ],
  authors: [{ name: 'أمانكو بلس للشحن والتوريد | AMANCO PLUS' }],
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
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
