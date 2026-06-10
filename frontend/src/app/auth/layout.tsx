/**
 * Auth routes use a plain background so Clerk forms stay readable
 * (root body uses a full-page hero image).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-white">{children}</div>;
}
