import { useParams } from 'react-router';
import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import TaskModal from '@/react-app/components/TaskModal';
import type { BoardWithColumns, CreateTask, UpdateTask, BetaCategory } from '@/shared/types';

interface InvitedUserData {
  board: BoardWithColumns;
  invitation: {
    id: number;
    board_id: number;
    column_id: number | null;
    email: string;
    status: string;
  };
  allowedColumnId: number | null;
}

export default function InvitedUserPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<InvitedUserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [categories, setCategories] = useState<BetaCategory[]>([]);

  useEffect(() => {
    if (!token) return;

    fetchInvitedBoard();
    fetchCategories();
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invitation');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    if (!data?.board?.id) return;

    try {
      const response = await fetch(`/api/beta-categories/${data.board.id}`);
      if (response.ok) {
        const result = await response.json();
        setCategories(result);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleTaskSave = async (taskData: CreateTask | UpdateTask) => {
    if (!data?.allowedColumnId) return;

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(taskData as CreateTask),
          column_id: data.allowedColumnId,
          position: 0,
        }),
      });

      if (response.ok) {
        fetchInvitedBoard(); // Refresh the board
      }
    } catch (error) {
      console.error('Failed to create task:', error);
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

  const allowedColumn = data.board.columns.find(col => col.id === data.allowedColumnId);

  return (
    <div className="min-h-screen bg-app text-ink">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 h-14 border-b border-line">
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold tracking-tight text-ink">{data.board.title}</h1>
          <p className="truncate text-[12px] text-ink-subtle">
            Beta testing - add bug reports to the “{allowedColumn?.title}” phase
          </p>
        </div>
      </header>

      <div className="px-6 py-5">
        {/* Column Content */}
        {allowedColumn && (
          <div className="max-w-2xl">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
                {allowedColumn.title}
              </h2>
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-surface-2 text-[11px] font-medium text-ink-muted">
                {allowedColumn.tasks.length}
              </span>
            </div>

            {/* Tasks */}
            <div className="space-y-3 mb-6">
              {allowedColumn.tasks.map((task) => (
                <div
                  key={task.id}
                  className="card p-3 transition-shadow hover:shadow-subtle"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-[13px] font-medium leading-5 text-ink flex-1">
                      {task.title}
                    </h3>
                    {task.intensity > 0 && (
                      <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[11px] font-medium ${getIntensityColor(task.intensity)}`}>
                        {task.intensity}/10
                      </span>
                    )}
                  </div>

                  {task.description && (
                    <p className="text-[12px] leading-[1.45] text-ink-muted line-clamp-2 mb-2.5">
                      {task.description}
                    </p>
                  )}

                  {task.category && (
                    <span className="inline-flex rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">
                      {task.category}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Add Bug Report Button */}
            <button
              onClick={() => setTaskModalOpen(true)}
              className="w-full p-4 border border-dashed border-line rounded-lg text-ink-subtle hover:border-line-strong hover:text-ink-muted transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              <span className="text-[13px] font-medium">Report bug / issue</span>
            </button>
          </div>
        )}

        <TaskModal
          columnId={data.allowedColumnId || undefined}
          boardType="beta-testing"
          categories={categories}
          isOpen={taskModalOpen}
          onClose={() => setTaskModalOpen(false)}
          onSave={handleTaskSave}
        />
      </div>
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
