import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/providers";
import AppLayout from "@/components/layout/AppLayout";
import ErrorBoundary from "@/components/ErrorBoundary";

// All pages in this app require authentication and use Clerk hooks.
// Disable static pre-rendering globally so Next.js always renders at request time.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Workwise HR SaaS",
  description: "Modern, compliant HR & Payroll platform for Kenyan SMEs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        <ErrorBoundary>
          <Providers>
            <AppLayout>{children}</AppLayout>
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
