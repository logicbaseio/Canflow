import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MoreHorizontal, Edit2, Trash2 } from 'lucide-react';
import type { Task } from '@/shared/types';

interface BetaTaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
}

export default function BetaTaskCard({ task, onEdit, onDelete }: BetaTaskCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const intensityColor = (intensity: number) => {
    if (intensity >= 7) return 'var(--danger)';
    if (intensity >= 4) return 'var(--warning)';
    return 'var(--success)';
  };

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
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[13px] font-medium leading-5 text-ink flex-1">{task.title}</h3>
        <div className="relative shrink-0 -mr-1 -mt-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="h-6 w-6 rounded-md flex items-center justify-center text-ink-subtle hover:bg-surface-2 hover:text-ink opacity-0 group-hover:opacity-100 transition"
          >
            <MoreHorizontal size={14} />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
              <div className="menu absolute right-0 top-7 z-20 w-32 py-1">
                <button
                  className="menu-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(task);
                    setShowMenu(false);
                  }}
                >
                  <Edit2 size={14} /> Edit
                </button>
                <button
                  className="menu-item text-danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(task.id);
                    setShowMenu(false);
                  }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {task.description && (
        <p className="mt-1 text-[12px] leading-[1.45] text-ink-muted line-clamp-2">{task.description}</p>
      )}

      {(task.intensity > 0 || task.category) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {task.intensity > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: intensityColor(task.intensity) }} />
              Intensity {task.intensity}
            </span>
          )}
          {task.category && (
            <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">
              {task.category}
            </span>
          )}
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-end">
        <div className="flex -space-x-1">
          <div className="h-6 w-6 rounded-full bg-surface-3 border border-line flex items-center justify-center">
            <span className="text-[11px] font-medium text-ink-muted">
              {task.title.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
