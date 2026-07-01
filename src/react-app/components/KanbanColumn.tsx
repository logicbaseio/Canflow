import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, MoreHorizontal, Edit2, Trash2 } from 'lucide-react';
import TaskCard from './TaskCard';
import PendingCard from './ui/PendingCard';
import type { Column, Task } from '@/shared/types';

interface KanbanColumnProps {
  column: Column & { tasks: Task[] };
  pending?: boolean;
  onAddTask: (columnId: number) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: number) => void;
  onEditColumn: (column: Column) => void;
  onDeleteColumn: (id: number) => void;
}

export default function KanbanColumn({
  column,
  pending,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onEditColumn,
  onDeleteColumn,
}: KanbanColumnProps) {
  const [showMenu, setShowMenu] = useState(false);
  const { isOver, setNodeRef } = useDroppable({ id: column.id });

  return (
    <div className="flex w-72 shrink-0 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-1.5 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: column.color || 'var(--text-subtle)' }} />
          <h2 className="truncate text-[13px] font-semibold text-ink">{column.title}</h2>
          <span className="inline-flex min-w-[18px] justify-center rounded bg-surface-2 px-1 text-[11px] font-medium text-ink-muted shrink-0">{column.tasks.length}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => onAddTask(column.id)} className="btn btn-ghost h-6 w-6 p-0 text-ink-subtle" title="Add task">
            <Plus size={15} />
          </button>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="btn btn-ghost h-6 w-6 p-0 text-ink-subtle">
              <MoreHorizontal size={15} />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="menu absolute right-0 top-7 z-20 w-40 py-1">
                  <button className="menu-item" onClick={() => { onEditColumn(column); setShowMenu(false); }}>
                    <Edit2 size={14} /> Rename column
                  </button>
                  <button className="menu-item text-danger" onClick={() => { onDeleteColumn(column.id); setShowMenu(false); }}>
                    <Trash2 size={14} /> Delete column
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tasks */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-0 overflow-y-auto rounded-xl p-1.5 space-y-2 transition-colors ${
          isOver ? 'bg-surface-2' : ''
        }`}
      >
        <SortableContext items={column.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {column.tasks.map((task) => (
            <TaskCard key={task.id} task={task} onEdit={onEditTask} onDelete={onDeleteTask} />
          ))}
        </SortableContext>

        {pending && <PendingCard />}

        <button
          onClick={() => onAddTask(column.id)}
          className="w-full rounded-lg border border-dashed border-line px-3 py-2 text-left text-[12.5px] text-ink-subtle hover:text-ink hover:border-line-strong hover:bg-surface-2 transition-colors flex items-center gap-1.5"
        >
          <Plus size={14} /> Add task
        </button>
      </div>
    </div>
  );
}
