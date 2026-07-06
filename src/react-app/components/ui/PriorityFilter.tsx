import { useState } from 'react';
import { SlidersHorizontal, Check } from 'lucide-react';

const OPTIONS: { value: string; label: string; color: string }[] = [
  { value: '', label: 'All priorities', color: '' },
  { value: 'high', label: 'High', color: 'var(--danger)' },
  { value: 'medium', label: 'Medium', color: 'var(--warning)' },
  { value: 'low', label: 'Low', color: 'var(--success)' },
];

/** Compact board-header filter that scopes visible cards to a priority. */
export default function PriorityFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const active = OPTIONS.find((o) => o.value === value) || OPTIONS[0];

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="btn btn-outline h-8 px-3" title="Filter by priority">
        <SlidersHorizontal size={14} />
        {value ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: active.color }} />
            {active.label}
          </span>
        ) : (
          'Filter'
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="menu absolute right-0 top-10 z-20 w-48 py-1">
            {OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className="menu-item justify-between"
              >
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: o.color || 'var(--border-strong)' }} />
                  {o.label}
                </span>
                {value === o.value && <Check size={14} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
