import { useEffect, useMemo, useRef, useState } from 'react';
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DatePickerProps {
  value: string; // 'YYYY-MM-DD' or ''
  onChange: (value: string) => void;
  placeholder?: string;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function safeParse(value: string): Date | null {
  if (!value) return null;
  try {
    const d = parseISO(value);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export default function DatePicker({ value, onChange, placeholder = 'Pick a date' }: DatePickerProps) {
  const selected = safeParse(value);
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(selected ?? new Date(2026, 6, 1));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && selected) setViewMonth(selected);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth));
    const end = endOfWeek(endOfMonth(viewMonth));
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  const pick = (d: Date) => {
    onChange(format(d, 'yyyy-MM-dd'));
    setOpen(false);
  };

  const toggle = () => {
    if (!open) {
      const rect = ref.current?.getBoundingClientRect();
      const CAL_HEIGHT = 360;
      if (rect) {
        const spaceBelow = window.innerHeight - rect.bottom;
        setOpenUp(spaceBelow < CAL_HEIGHT && rect.top > spaceBelow);
      }
    }
    setOpen((v) => !v);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        className="field flex items-center justify-between gap-2 text-left"
      >
        <span className={`flex items-center gap-2 ${selected ? 'text-ink' : 'text-ink-subtle'}`}>
          <Calendar size={14} className="text-ink-subtle" />
          {selected ? format(selected, 'MMM d, yyyy') : placeholder}
        </span>
        {selected && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="text-ink-subtle hover:text-ink"
          >
            <X size={14} />
          </span>
        )}
      </button>

      {open && (
        <div className={`menu absolute left-0 z-30 w-64 p-3 ${openUp ? 'bottom-[calc(100%+4px)]' : 'top-[calc(100%+4px)]'}`}>
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setViewMonth((m) => subMonths(m, 1))} className="btn btn-ghost h-7 w-7 p-0 text-ink-muted">
              <ChevronLeft size={16} />
            </button>
            <span className="text-[13px] font-semibold text-ink">{format(viewMonth, 'MMMM yyyy')}</span>
            <button type="button" onClick={() => setViewMonth((m) => addMonths(m, 1))} className="btn btn-ghost h-7 w-7 p-0 text-ink-muted">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAYS.map((d, i) => (
              <div key={i} className="h-7 flex items-center justify-center text-[11px] font-medium text-ink-subtle">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {days.map((d) => {
              const isSel = selected && isSameDay(d, selected);
              const inMonth = isSameMonth(d, viewMonth);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => pick(d)}
                  className={`h-8 rounded-md text-[12.5px] transition-colors flex items-center justify-center ${
                    isSel
                      ? ''
                      : inMonth
                      ? 'text-ink hover:bg-surface-2'
                      : 'text-ink-subtle hover:bg-surface-2'
                  } ${!isSel && isToday(d) ? 'font-semibold text-brand' : ''}`}
                  style={isSel ? { background: 'var(--accent)', color: 'var(--accent-fg)' } : undefined}
                >
                  {format(d, 'd')}
                </button>
              );
            })}
          </div>

          <div className="flex justify-between mt-2 pt-2 border-t border-line">
            <button type="button" onClick={() => { onChange(''); setOpen(false); }} className="text-[12px] text-ink-muted hover:text-ink">
              Clear
            </button>
            <button type="button" onClick={() => pick(new Date())} className="text-[12px] text-brand hover:opacity-80">
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
