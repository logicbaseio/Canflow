import { useParams } from 'react-router';
import { useState, useEffect } from 'react';
import { Plus, Lock, Eye } from 'lucide-react';
import TaskModal from '@/react-app/components/TaskModal';
import type { BoardWithColumns, Task, CreateTask, UpdateTask, BetaCategory } from '@/shared/types';

interface InvitedUserData {
  board: BoardWithColumns;
  invitation: {
    id: number;
    board_id: number;
    column_id: number | null;
    column_ids: number[] | null;
    email: string;
    status: string;
  };
  access?: 'editor' | 'viewer';
  allowedColumnId: number | null;
  allowedColumnIds?: number[];
}

export default function InvitedUserPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<InvitedUserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [addColumnId, setAddColumnId] = useState<number | null>(null);
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [categories, setCategories] = useState<BetaCategory[]>([]);

  useEffect(() => {
    if (!token) return;

    fetchInvitedBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchInvitedBoard = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/invited/${token}`);
      if (!response.ok) {
        throw new Error('Invalid or expired invitation');
      }
      const result = await response.json();
      setData(result);
      setError(null);
      fetchCategories(result.board?.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invitation');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async (boardId?: number) => {
    if (!boardId) return;

    try {
      const response = await fetch(`/api/invited/${token}/categories`);
      if (response.ok) {
        const result = await response.json();
        setCategories(result);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleTaskSave = async (taskData: CreateTask | UpdateTask) => {
    try {
      // The client picks WHICH granted phase to work in; the server validates
      // every write against the invite's grant set, so access can't be widened.
      const response = openTask
        ? await fetch(`/api/invited/${token}/tasks/${openTask.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData),
          })
        : await fetch(`/api/invited/${token}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...taskData, column_id: addColumnId ?? undefined }),
          });
      if (response.ok) {
        setTaskModalOpen(false);
        setAddColumnId(null);
        setOpenTask(null);
        fetchInvitedBoard();
      }
    } catch (error) {
      console.error('Failed to save task:', error);
    }
  };

  const getIntensityColor = (intensity: number) => {
    if (intensity >= 8) return 'bg-surface-2 text-danger';
    if (intensity >= 6) return 'bg-surface-2 text-warning';
    if (intensity >= 4) return 'bg-surface-2 text-warning';
    if (intensity >= 2) return 'bg-surface-2 text-brand';
    return 'bg-surface-2 text-ink-muted';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-app text-ink flex items-center justify-center px-6">
        <div className="flex flex-col items-center text-center">
          <Logo className="h-9 w-9 mb-5" />
          <div className="h-7 w-7 rounded-full border-2 border-line border-t-ink animate-spin mb-4" />
          <p className="text-[13px] text-ink-muted">Loading invitation…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-app text-ink flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <Logo className="h-9 w-9 mx-auto mb-5" />
          <h2 className="text-[22px] font-semibold tracking-tight mb-1.5">Invalid invitation</h2>
          <p className="text-[13px] text-ink-muted">{error || 'This invitation may have expired or been revoked.'}</p>
        </div>
      </div>
    );
  }

  const allowedIds = data.allowedColumnIds?.length
    ? data.allowedColumnIds
    : data.allowedColumnId ? [data.allowedColumnId] : [];
  const isViewer = data.access === 'viewer';
  const allowedTitles = data.board.columns
    .filter((col) => allowedIds.includes(col.id))
    .map((col) => `“${col.title}”`)
    .join(', ');
  const isBeta = data.board.board_type === 'beta-testing';
  const canEditTask = (t: Task) => !isViewer && allowedIds.includes(t.column_id);
  const addLabel = isBeta ? 'Report bug / issue' : 'Add item';
  const PRIORITY: Record<string, { label: string; color: string }> = {
    high: { label: 'High', color: 'var(--danger)' },
    medium: { label: 'Medium', color: 'var(--warning)' },
    low: { label: 'Low', color: 'var(--success)' },
  };

  return (
    <div className="h-screen flex flex-col bg-app text-ink">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 h-14 border-b border-line shrink-0">
        <div className="min-w-0 flex items-center gap-2.5">
          <Logo className="h-6 w-6 shrink-0" />
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold tracking-tight text-ink">{data.board.title}</h1>
            <p className="truncate text-[12px] text-ink-subtle">
              {isViewer
                ? 'You have view-only access to this board.'
                : `You can view the whole board and ${isBeta ? 'report bugs' : 'add items'} in the ${allowedTitles} ${allowedIds.length > 1 ? 'phases' : 'phase'}.`}
            </p>
          </div>
        </div>
      </header>

      {/* Full board — every phase visible; only the invited phase is editable */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-5">
        <div className="flex gap-4 h-full items-start">
          {data.board.columns.map((col) => {
            const editable = !isViewer && allowedIds.includes(col.id);
            return (
              <div key={col.id} className="w-72 shrink-0 flex flex-col max-h-full">
                <div className="mb-3 flex items-center gap-2 px-1">
                  <h2 className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted truncate">{col.title}</h2>
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-surface-2 text-[11px] font-medium text-ink-muted">
                    {col.tasks.length}
                  </span>
                  {!editable && (
                    <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] text-ink-subtle" title="You can open cards in this phase but not edit them">
                      <Lock size={11} /> View only
                    </span>
                  )}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
                  {col.tasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => { setOpenTask(task); setAddColumnId(null); setTaskModalOpen(true); }}
                      className={`card block w-full p-3 text-left transition-shadow hover:shadow-pop ${editable ? '' : 'opacity-80'}`}
                    >
                      {task.image_url && (
                        <img src={task.image_url} alt="" className="mb-2 w-full max-h-36 rounded-md border border-line bg-surface-2 object-cover" />
                      )}
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="text-[13px] font-medium leading-5 text-ink flex-1">{task.title}</h3>
                        {isBeta && task.intensity > 0 && (
                          <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[11px] font-medium ${getIntensityColor(task.intensity)}`}>
                            {task.intensity}/10
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-[12px] leading-[1.45] text-ink-muted line-clamp-2 mb-2">{task.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {!isBeta && task.priority && PRIORITY[task.priority] && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: PRIORITY[task.priority].color }} />
                            {PRIORITY[task.priority].label}
                          </span>
                        )}
                        {task.category && (
                          <span className="inline-flex rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">{task.category}</span>
                        )}
                        {!editable && (
                          <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] text-ink-subtle"><Eye size={11} /></span>
                        )}
                      </div>
                    </button>
                  ))}

                  {editable && (
                    <button
                      onClick={() => { setOpenTask(null); setAddColumnId(col.id); setTaskModalOpen(true); }}
                      className="w-full p-3 border border-dashed border-line rounded-lg text-ink-subtle hover:border-line-strong hover:text-ink-muted transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus size={15} />
                      <span className="text-[13px] font-medium">{addLabel}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TaskModal
        task={openTask}
        columnId={addColumnId ?? allowedIds[0] ?? undefined}
        boardType={data.board.board_type as 'kanban' | 'roadmap' | 'beta-testing'}
        categories={categories}
        isOpen={taskModalOpen}
        onClose={() => { setTaskModalOpen(false); setAddColumnId(null); setOpenTask(null); }}
        onSave={handleTaskSave}
        readOnly={!!openTask && !canEditTask(openTask)}
        hideAgent
        commentsBase={`/api/invited/${token}/tasks`}
        commentsFetch={(input, init) => fetch(input, init)}
        authorName={data.invitation.email}
      />
    </div>
  );
}

function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <rect width="100" height="100" rx="22" fill="var(--accent)" />
      <rect x="24" y="24" width="16" height="52" rx="4" fill="var(--accent-fg)" />
      <rect x="46" y="24" width="16" height="34" rx="4" fill="var(--accent-fg)" />
      <rect x="68" y="24" width="8" height="24" rx="3" fill="var(--accent-fg)" />
    </svg>
  );
}
