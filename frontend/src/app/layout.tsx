import type { Metadata, Viewport } from 'next';
import './globals.css';
import Providers from '@/components/providers';
import { ServiceWorkerRegistration } from '@/components/pwa/ServiceWorkerRegistration';

export const viewport: Viewport = {
  themeColor: '#0d9488',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: 'WorkWise — Kenya HR & Payroll SaaS',
    template: '%s | WorkWise',
  },
  description:
    'The all-in-one HR & Finance platform built for Kenyan SMEs. Manage payroll, attendance, leave, expenses, and statutory compliance in one place.',
  keywords: ['HR software Kenya', 'payroll Kenya', 'PAYE', 'NSSF', 'SHIF', 'workforce management'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'WorkWise',
  },
  openGraph: {
    type: 'website',
    siteName: 'WorkWise',
    title: 'WorkWise — Kenya HR & Payroll SaaS',
    description:
      'Automate payroll, leave, attendance, and finance for your Kenyan business. KRA compliant. M-Pesa payments. 14-day free trial.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-sans">
        <Providers>
          <ServiceWorkerRegistration />
          {children}
        </Providers>
      </body>
    </html>
  );
}
