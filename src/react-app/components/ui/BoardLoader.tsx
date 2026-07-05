import { useEffect, useState } from 'react';

/**
 * Subtle, delayed loading indicator for board content.
 * Stays invisible for `delay`ms so fast (local) loads don't flash a spinner -
 * the content just fades in. Only slow loads reveal the spinner.
 */
export default function BoardLoader({ delay = 160 }: { delay?: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div className="h-full flex items-center justify-center bg-app">
      {show && (
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <span className="h-5 w-5 rounded-full border-2 border-line border-t-ink animate-spin" />
          <span className="text-[12px] text-ink-subtle">Loading…</span>
        </div>
      )}
    </div>
  );
}
