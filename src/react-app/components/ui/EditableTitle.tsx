import { useEffect, useRef, useState } from 'react';
import { updateBoard } from '@/react-app/hooks/useApi';

interface EditableTitleProps {
  boardId: number;
  value: string;
  onRenamed?: () => void;
}

/** Click the board title to rename it inline (Enter saves, Esc cancels). */
export default function EditableTitle({ boardId, value, onRenamed }: EditableTitleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = async () => {
    setEditing(false);
    const next = draft.trim();
    if (!next || next === value) {
      setDraft(value);
      return;
    }
    try {
      await updateBoard(boardId, { title: next });
      onRenamed?.();
    } catch (e) {
      console.error('Failed to rename board:', e);
      setDraft(value);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { e.preventDefault(); setDraft(value); setEditing(false); }
        }}
        className="block w-full max-w-full bg-transparent text-[15px] font-semibold tracking-tight text-ink outline-none rounded-md -mx-1.5 px-1.5"
        style={{ boxShadow: '0 0 0 2px var(--ring)' }}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Click to rename"
      className="block max-w-full truncate text-left text-[15px] font-semibold tracking-tight text-ink rounded-md -mx-1.5 px-1.5 hover:bg-surface-2 transition-colors cursor-text"
    >
      {value}
    </button>
  );
}
