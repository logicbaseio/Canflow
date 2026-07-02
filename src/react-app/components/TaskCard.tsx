import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { taskDndId } from '@/react-app/hooks/useBoardDnd';
import { Calendar, MoreHorizontal, Edit2, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { format } from 'date-fns';
import { ClaudeCodeLogo, CodexLogo } from '@/react-app/components/ui/AgentLogos';
import type { Task } from '@/shared/types';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  onFix?: (task: Task, agent: 'claude' | 'codex') => void;
}

const PRIORITY_DOT: Record<string, string> = {
  high: 'var(--danger)',
  medium: 'var(--warning)',
  low: 'var(--success)',
};

export default function TaskCard({ task, onEdit, onDelete, onFix }: TaskCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: taskDndId(task.id) });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const tags = task.tags ? task.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onEdit(task)}
      className={`card group p-3 cursor-pointer transition-shadow hover:shadow-subtle ${
        isDragging ? 'opacity-60 shadow-pop cursor-grabbing' : ''
      }`}
    >
      {task.image_url && (
        <img src={task.image_url} alt="" loading="lazy" className="mb-2.5 -mt-0.5 w-full max-h-36 rounded-md object-cover border border-line bg-surface-2" />
      )}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[13px] font-medium leading-5 text-ink">{task.title}</h3>
        <div className="relative shrink-0 -mr-1 -mt-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="h-6 w-6 rounded-md flex items-center justify-center text-ink-subtle hover:bg-surface-2 hover:text-ink opacity-0 group-hover:opacity-100 transition"
          >
            <MoreHorizontal size={14} />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
              <div className="menu absolute right-0 top-7 z-20 w-44 py-1">
                <button className="menu-item" onClick={(e) => { e.stopPropagation(); onEdit(task); setShowMenu(false); }}>
                  <Edit2 size={14} /> Edit
                </button>
                <div className="my-1 h-px bg-line" />
                <button className="menu-item text-danger" onClick={(e) => { e.stopPropagation(); onDelete(task.id); setShowMenu(false); }}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {task.description && (
        <p className="mt-1 text-[12px] leading-[1.45] text-ink-muted line-clamp-3">{task.description}</p>
      )}

      {(task.priority || tags.length > 0) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {task.priority && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium capitalize text-ink-muted">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: PRIORITY_DOT[task.priority] || 'var(--text-subtle)' }} />
              {task.priority}
            </span>
          )}
          {tags.map((tag, i) => (
            <span key={i} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">
              {tag}
            </span>
          ))}
        </div>
      )}

      {(task.due_date || task.upvotes > 0 || task.downvotes > 0) && (
        <div className="mt-2.5 flex items-center justify-between text-[11px] text-ink-subtle">
          {task.due_date ? (
            <span className="inline-flex items-center gap-1">
              <Calendar size={12} />
              {format(new Date(task.due_date), 'MMM d')}
            </span>
          ) : <span />}
          {(task.upvotes > 0 || task.downvotes > 0) && (
            <span className="flex items-center gap-2">
              {task.upvotes > 0 && <span className="inline-flex items-center gap-0.5 text-success"><ArrowUp size={12} />{task.upvotes}</span>}
              {task.downvotes > 0 && <span className="inline-flex items-center gap-0.5 text-danger"><ArrowDown size={12} />{task.downvotes}</span>}
            </span>
          )}
        </div>
      )}

      {onFix && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onFix(task, 'claude'); }}
            style={{ borderColor: 'var(--stroke-hard)' }}
            className="inline-flex items-center gap-1.5 border rounded-none px-2 py-1 text-[11px] font-medium text-ink-muted hover:text-ink transition-colors"
          >
            <ClaudeCodeLogo className="h-3.5 w-3.5" /> Fix with Claude Code
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onFix(task, 'codex'); }}
            style={{ borderColor: 'var(--stroke-hard)' }}
            className="inline-flex items-center gap-1.5 border rounded-none px-2 py-1 text-[11px] font-medium text-ink-muted hover:text-ink transition-colors"
          >
            <CodexLogo className="h-3.5 w-3.5" /> Fix with Codex
          </button>
        </div>
      )}
    </div>
  );
}
