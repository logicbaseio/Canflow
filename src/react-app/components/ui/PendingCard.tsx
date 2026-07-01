/** Subtle placeholder shown in a column while a new task is being created. */
export default function PendingCard() {
  return (
    <div className="card p-3 animate-pulse animate-fade-in">
      <div className="flex items-center gap-2">
        <span className="h-3.5 w-3.5 rounded-full border-2 border-line border-t-ink animate-spin" />
        <div className="h-3 flex-1 rounded bg-surface-2" />
      </div>
      <div className="mt-2.5 h-2.5 w-1/2 rounded bg-surface-2" />
    </div>
  );
}
