export function PageBusy({ label = "Getting this ready." }: { label?: string }) {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <p className="text-lg font-semibold">{label}</p>
      <div className="h-8 w-2/3 animate-pulse rounded-xl bg-muted" />
      <div className="h-28 animate-pulse rounded-2xl bg-muted" />
      <div className="h-28 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
