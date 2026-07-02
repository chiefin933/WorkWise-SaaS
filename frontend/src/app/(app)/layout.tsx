import AppLayout from '@/components/layout/AppLayout';
import ErrorBoundary from '@/components/ErrorBoundary';

// All pages in the authenticated (app) group require a Clerk session
// and use dynamic data — disable static pre-rendering for the entire group.
export const dynamic = 'force-dynamic';

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <AppLayout>{children}</AppLayout>
    </ErrorBoundary>
  );
}
