import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  color?: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
}

export default function Select({ value, onChange, options, placeholder = 'Select…', disabled }: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="field flex items-center justify-between gap-2 text-left disabled:opacity-50"
      >
        <span className={`truncate flex items-center gap-2 ${selected ? 'text-ink' : 'text-ink-subtle'}`}>
          {selected?.color && <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: selected.color }} />}
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={15} className={`shrink-0 text-ink-subtle transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="menu absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-60 overflow-y-auto py-1">
          {options.length === 0 && (
            <div className="px-3 py-1.5 text-[12px] text-ink-subtle">No options</div>
          )}
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className="menu-item justify-between"
            >
              <span className="flex items-center gap-2 truncate">
                {o.color && <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: o.color }} />}
                {o.label}
              </span>
              {o.value === value && <Check size={14} className="text-ink shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
