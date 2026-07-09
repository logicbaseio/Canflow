import { useState } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import KanbanColumn from './KanbanColumn';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import EditableTitle from '@/react-app/components/ui/EditableTitle';
import PriorityFilter from '@/react-app/components/ui/PriorityFilter';
import BoardLoader from '@/react-app/components/ui/BoardLoader';
import { authedFetch } from '@/react-app/lib/auth';
import { useDialog } from '@/react-app/components/ui/Dialog';
import { useBoardDnd } from '@/react-app/hooks/useBoardDnd';
import { useBoard, createTask, updateTask, deleteTask, createColumn, updateColumn, deleteColumn } from '@/react-app/hooks/useApi';
import type { Task, Column, CreateTask, UpdateTask, CreateColumn } from '@/shared/types';

interface KanbanBoardProps {
  boardId: number;
  onBoardChanged?: () => void;
}

export default function KanbanBoard({ boardId, onBoardChanged }: KanbanBoardProps) {
  const { data: board, loading, refetch } = useBoard(boardId);
  const { confirm, prompt, toast } = useDialog();
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskColumnId, setNewTaskColumnId] = useState<number | null>(null);
  const [pendingColumnId, setPendingColumnId] = useState<number | null>(null);
  const [priorityFilter, setPriorityFilter] = useState('');

  const { columns, activeTask, sensors, collisionDetection, onDragStart, onDragOver, onDragEnd } = useBoardDnd(board, refetch);
  const displayColumns = priorityFilter
    ? columns.map((col) => ({ ...col, tasks: col.tasks.filter((t) => t.priority === priorityFilter) }))
    : columns;

  const handleAddTask = (columnId: number) => {
    setNewTaskColumnId(columnId);
    setEditingTask(null);
    setTaskModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setNewTaskColumnId(null);
    setTaskModalOpen(true);
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!(await confirm({ title: 'Delete task', message: 'This task will be permanently removed.', confirmText: 'Delete', danger: true }))) return;
    try { await deleteTask(taskId); refetch(); } catch (e) { console.error('Failed to delete task:', e); }
  };

  const handleAssignTask = async (taskId: number, agent: 'claude' | 'codex' | null) => {
    try {
      await authedFetch(`/api/tasks/${taskId}/assign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: agent ?? '' }),
      });
      refetch();
      if (agent) toast(`Queued for ${agent === 'codex' ? 'Codex' : 'Claude Code'} — run your agent to pick it up`);
    } catch (e) { console.error('Failed to assign agent:', e); toast('Could not assign agent'); }
  };

  const handleTaskSave = async (data: CreateTask | UpdateTask) => {
    const createInColumn = editingTask ? null : newTaskColumnId;
    try {
      if (editingTask) {
        await updateTask(editingTask.id, data as UpdateTask);
      } else if (createInColumn) {
        setPendingColumnId(createInColumn);
        await createTask({ ...(data as CreateTask), column_id: createInColumn, position: 0 });
      }
      await refetch();
    } catch (e) { console.error('Failed to save task:', e); }
    finally { setPendingColumnId(null); }
  };

  const handleAddColumn = async () => {
    const title = await prompt({ title: 'Add column', placeholder: 'Column name…', confirmText: 'Add column' });
    if (!title?.trim() || !board) return;
    try {
      const columnData: CreateColumn = { board_id: board.id, title: title.trim(), position: board.columns.length, color: '#cbd5e1' };
      await createColumn(columnData);
      refetch();
    } catch (e) { console.error('Failed to create column:', e); }
  };

  const handleEditColumn = async (column: Column) => {
    const newTitle = await prompt({ title: 'Rename column', defaultValue: column.title, confirmText: 'Rename' });
    if (!newTitle?.trim() || newTitle === column.title) return;
    try { await updateColumn(column.id, { title: newTitle.trim() }); refetch(); } catch (e) { console.error('Failed to update column:', e); }
  };

  const handleDeleteColumn = async (columnId: number) => {
    if (!(await confirm({ title: 'Delete column', message: 'This column and all its tasks will be removed.', confirmText: 'Delete', danger: true }))) return;
    try { await deleteColumn(columnId); refetch(); } catch (e) { console.error('Failed to delete column:', e); }
  };

  if (loading && !board) return <BoardLoader />;

  if (!board) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[13px] text-ink-muted">This board could not be loaded.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-app animate-board-in">
      <header className="flex items-center justify-between px-6 h-14 border-b border-line shrink-0">
        <div className="min-w-0 flex-1 pr-4">
          <EditableTitle boardId={board.id} value={board.title} onRenamed={() => { refetch(); onBoardChanged?.(); }} />
          {board.description && <p className="truncate text-[12px] text-ink-subtle pl-1.5 -ml-1.5">{board.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <PriorityFilter value={priorityFilter} onChange={setPriorityFilter} />
          <button onClick={handleAddColumn} className="btn btn-outline h-8 px-3">
            <Plus size={15} /> Add column
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-5">
        <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
          <div className="flex gap-4 h-full items-stretch">
            {displayColumns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                pending={pendingColumnId === column.id}
                onAddTask={handleAddTask}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
                onAssignTask={handleAssignTask}
                onEditColumn={handleEditColumn}
                onDeleteColumn={handleDeleteColumn}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTask && (
              <div className="w-72 rotate-1">
                <TaskCard task={activeTask} onEdit={() => {}} onDelete={() => {}} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      <TaskModal
        task={editingTask}
        columnId={newTaskColumnId || undefined}
        isOpen={taskModalOpen}
        onClose={() => { setTaskModalOpen(false); setEditingTask(null); setNewTaskColumnId(null); }}
        onSave={handleTaskSave}
      />

    </div>
  );
}
