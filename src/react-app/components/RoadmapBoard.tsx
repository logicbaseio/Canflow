import { useState } from 'react';
import { Plus, Share2, Globe, Eye, Copy, ArrowUp, MoreHorizontal, Edit2, Trash2 } from 'lucide-react';
import TaskModal from './TaskModal';
import ShareBoardModal from './ShareBoardModal';
import EditableTitle from '@/react-app/components/ui/EditableTitle';
import BoardLoader from '@/react-app/components/ui/BoardLoader';
import PendingCard from '@/react-app/components/ui/PendingCard';
import { useDialog } from '@/react-app/components/ui/Dialog';
import { celebrate } from '@/react-app/lib/confetti';
import { useBoard, createTask, updateTask, createColumn, updateColumn, deleteColumn, updateBoard } from '@/react-app/hooks/useApi';
import type { Task, Column, CreateTask, UpdateTask, CreateColumn } from '@/shared/types';

interface RoadmapBoardProps {
  boardId: number;
  onBoardChanged?: () => void;
}

const THEMES: { value: 'auto' | 'light' | 'dark'; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function RoadmapBoard({ boardId, onBoardChanged }: RoadmapBoardProps) {
  const { data: board, loading, refetch } = useBoard(boardId);
  const { confirm, prompt, toast } = useDialog();
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskColumnId, setNewTaskColumnId] = useState<number | null>(null);
  const [pendingColumnId, setPendingColumnId] = useState<number | null>(null);
  const [showPublicMenu, setShowPublicMenu] = useState(false);
  const [columnMenu, setColumnMenu] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const publicUrl = board?.public_key ? `${window.location.origin}/public/${board.public_key}` : '';

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
    } catch (error) {
      console.error('Failed to save task:', error);
    } finally {
      setPendingColumnId(null);
    }
  };

  const handleAddColumn = async () => {
    const title = await prompt({ title: 'Add column', placeholder: 'e.g. Ideas, Planned, Released…', confirmText: 'Add column' });
    if (!title?.trim() || !board) return;
    try {
      const columnData: CreateColumn = { board_id: board.id, title: title.trim(), position: board.columns.length, color: '#cbd5e1' };
      await createColumn(columnData);
      refetch();
    } catch (error) {
      console.error('Failed to create column:', error);
    }
  };

  const handleEditColumn = async (column: Column) => {
    const title = await prompt({ title: 'Rename column', defaultValue: column.title, confirmText: 'Rename' });
    if (!title?.trim() || title === column.title) return;
    try { await updateColumn(column.id, { title: title.trim() }); refetch(); } catch (e) { console.error('Failed to rename column:', e); }
  };

  const handleDeleteColumn = async (columnId: number) => {
    if (!(await confirm({ title: 'Delete column', message: 'This column and all its items will be permanently removed.', confirmText: 'Delete', danger: true }))) return;
    try { await deleteColumn(columnId); refetch(); } catch (e) { console.error('Failed to delete column:', e); }
  };

  const handleTogglePublic = async () => {
    if (!board) return;
    const makingPublic = !board.is_public;
    setShowPublicMenu(false);
    try {
      await updateBoard(board.id, { is_public: makingPublic });
      await refetch();
      if (makingPublic) {
        celebrate();          // 🎉 it's live
        setShareOpen(true);   // show the share modal with URL + social buttons
      }
    } catch (error) {
      console.error('Failed to toggle board visibility:', error);
    }
  };

  const copyPublicLink = () => {
    if (!board?.public_key) return;
    navigator.clipboard.writeText(`${window.location.origin}/public/${board.public_key}`);
    setShowPublicMenu(false);
    toast('Share link copied to clipboard');
  };

  const handleThemeChange = async (theme: 'auto' | 'light' | 'dark') => {
    if (!board) return;
    try {
      await updateBoard(board.id, { public_theme: theme });
      refetch();
    } catch (error) {
      console.error('Failed to update theme:', error);
    }
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
        <div className="min-w-0">
          <EditableTitle boardId={board.id} value={board.title} onRenamed={() => { refetch(); onBoardChanged?.(); }} />
          <p className="truncate text-[12px] text-ink-subtle pl-1.5 -ml-1.5">Roadmap</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowPublicMenu(!showPublicMenu)}
              className={board.is_public ? 'btn btn-outline h-8 px-3 text-success' : 'btn btn-outline h-8 px-3'}
            >
              {board.is_public ? <Globe size={15} /> : <Share2 size={15} />}
              {board.is_public ? 'Public' : 'Share'}
            </button>

            {showPublicMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowPublicMenu(false)} />
                <div className="menu absolute right-0 top-10 z-20 w-56 py-1">
                  <button onClick={handleTogglePublic} className="menu-item">
                    {board.is_public ? <Eye size={14} /> : <Globe size={14} />}
                    {board.is_public ? 'Make private' : 'Make public'}
                  </button>
                  {!!board.is_public && board.public_key && (
                    <>
                      <button onClick={() => { setShowPublicMenu(false); setShareOpen(true); }} className="menu-item text-brand">
                        <Share2 size={14} />
                        Share…
                      </button>
                      <button onClick={copyPublicLink} className="menu-item">
                        <Copy size={14} />
                        Copy share link
                      </button>
                    </>
                  )}

                  {!!board.is_public && (
                    <>
                      <div className="my-1 h-px bg-line" />
                      <div className="px-3 pt-1 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
                        Public appearance
                      </div>
                      <div className="px-2 pb-1.5">
                        <div className="flex gap-1 p-0.5 rounded-lg bg-surface-2">
                          {THEMES.map((t) => (
                            <button
                              key={t.value}
                              onClick={() => handleThemeChange(t.value)}
                              className={`flex-1 rounded-md py-1 text-[12px] font-medium transition-colors ${
                                board.public_theme === t.value ? 'bg-surface text-ink shadow-subtle' : 'text-ink-muted hover:text-ink'
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          <button onClick={handleAddColumn} className="btn btn-outline h-8 px-3">
            <Plus size={15} /> Add column
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-5">
        <div className="flex gap-4 h-full items-stretch">
          {board.columns.map((column) => (
            <div key={column.id} className="flex w-72 shrink-0 flex-col">
              {/* Column Header */}
              <div className="flex items-center justify-between px-1.5 pb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: column.color || 'var(--text-subtle)' }} />
                  <h2 className="truncate text-[13px] font-semibold text-ink">{column.title}</h2>
                  <span className="inline-flex min-w-[18px] justify-center rounded bg-surface-2 px-1 text-[11px] font-medium text-ink-muted shrink-0">
                    {column.tasks.length}
                  </span>
                </div>
                <div className="relative">
                  <button onClick={() => setColumnMenu(columnMenu === column.id ? null : column.id)} className="btn btn-ghost h-6 w-6 p-0 text-ink-subtle" title="Column options">
                    <MoreHorizontal size={15} />
                  </button>
                  {columnMenu === column.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setColumnMenu(null)} />
                      <div className="menu absolute right-0 top-7 z-20 w-40 py-1">
                        <button className="menu-item" onClick={() => { handleEditColumn(column); setColumnMenu(null); }}>
                          <Edit2 size={14} /> Rename column
                        </button>
                        <button className="menu-item text-danger" onClick={() => { handleDeleteColumn(column.id); setColumnMenu(null); }}>
                          <Trash2 size={14} /> Delete column
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Tasks */}
              <div className="flex-1 min-h-0 overflow-y-auto rounded-xl p-1.5 space-y-2">
                {column.tasks.map((task) => {
                  const tags = task.tags ? task.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [];
                  const primaryTag = tags[0] || '';

                  return (
                    <div
                      key={task.id}
                      className="card group p-3 cursor-pointer transition-shadow hover:shadow-subtle"
                      onClick={() => handleEditTask(task)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Vote count (votes come from the public board) */}
                        <div className="flex flex-col items-center shrink-0 rounded-md bg-surface-2 px-1.5 py-1 min-w-[34px]">
                          <ArrowUp size={14} className="text-ink-subtle" />
                          <span className="text-[12px] font-semibold text-ink leading-tight">{task.upvotes}</span>
                        </div>

                        {/* Task Content */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[13px] font-medium leading-5 text-ink">{task.title}</h3>

                          {task.description && (
                            <p className="mt-1 text-[12px] leading-[1.45] text-ink-muted line-clamp-2">{task.description}</p>
                          )}

                          {task.image_url && (
                            <img src={task.image_url} alt="" loading="lazy" className="mt-2 w-full max-h-32 rounded-md object-cover border border-line bg-surface-2" />
                          )}

                          {primaryTag && (
                            <div className="mt-2.5">
                              <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">
                                {primaryTag}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {pendingColumnId === column.id && <PendingCard />}

                <button
                  onClick={() => handleAddTask(column.id)}
                  className="w-full rounded-lg border border-dashed border-line px-3 py-2 text-left text-[12.5px] text-ink-subtle hover:text-ink hover:border-line-strong hover:bg-surface-2 transition-colors flex items-center gap-1.5"
                >
                  <Plus size={14} /> Add item
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <TaskModal
        task={editingTask}
        columnId={newTaskColumnId || undefined}
        boardType="roadmap"
        isOpen={taskModalOpen}
        onClose={() => {
          setTaskModalOpen(false);
          setEditingTask(null);
          setNewTaskColumnId(null);
        }}
        onSave={handleTaskSave}
      />

      <ShareBoardModal url={publicUrl} title={`${board.title} — roadmap`} isOpen={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
