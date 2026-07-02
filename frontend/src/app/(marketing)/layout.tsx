// Marketing pages are fully public — no auth, no AppLayout, no force-dynamic.
// Static rendering is fine here for performance.
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
