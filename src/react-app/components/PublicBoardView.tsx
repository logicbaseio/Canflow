import { useState, useEffect } from 'react';
import { Share2, Globe, ArrowUp, ArrowDown } from 'lucide-react';
import ShareBoardModal from './ShareBoardModal';
import type { BoardWithColumns } from '@/shared/types';

interface PublicBoardViewProps {
  publicKey: string;
}

type PublicBoard = BoardWithColumns & { org?: { name: string | null; image: string | null } };

export default function PublicBoardView({ publicKey }: PublicBoardViewProps) {
  const [board, setBoard] = useState<PublicBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [votingTasks, setVotingTasks] = useState<Set<number>>(new Set());
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    fetchBoard();
  }, [publicKey]);

  useEffect(() => {
    if (board && board.public_theme && board.public_theme !== 'auto') {
      if (board.public_theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [board]);

  const fetchBoard = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/public/${publicKey}`);
      if (!response.ok) {
        throw new Error('Board not found or not public');
      }
      const data = await response.json();
      setBoard(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load board');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (taskId: number, voteType: 'upvote' | 'downvote') => {
    if (votingTasks.has(taskId)) return;

    setVotingTasks(prev => new Set(prev).add(taskId));

    try {
      const response = await fetch(`/api/public/${publicKey}/tasks/${taskId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote_type: voteType }),
      });

      if (response.ok) {
        const updatedTask = await response.json();
        // Update the task in the board state
        setBoard(prevBoard => {
          if (!prevBoard) return null;
          return {
            ...prevBoard,
            columns: prevBoard.columns.map(column => ({
              ...column,
              tasks: column.tasks.map(task =>
                task.id === taskId ? updatedTask : task
              ),
            })),
          };
        });
      }
    } catch (error) {
      console.error('Failed to vote:', error);
    } finally {
      setVotingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-app text-ink flex items-center justify-center px-6">
        <div className="flex flex-col items-center text-center">
          <Logo className="h-9 w-9 mb-5" />
          <div className="h-7 w-7 rounded-full border-2 border-line border-t-ink animate-spin mb-4" />
          <p className="text-[13px] text-ink-muted">Loading board…</p>
        </div>
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="min-h-screen bg-app text-ink flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <Logo className="h-9 w-9 mx-auto mb-5" />
          <h2 className="text-[22px] font-semibold tracking-tight mb-1.5">Board not found</h2>
          <p className="text-[13px] text-ink-muted">{error || 'This board may not be public or may have been removed.'}</p>
        </div>
      </div>
    );
  }

  const isRoadmap = board.board_type === 'roadmap';
  const org = board.org || { name: null, image: null };
  const shareUrl = `${window.location.origin}/public/${publicKey}`;

  return (
    <div className="min-h-screen bg-app text-ink">
      {/* Canflow marketing nav */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-6 h-12 border-b border-line bg-app/90 backdrop-blur-sm">
        <a href="https://canflow.app" target="_blank" rel="noreferrer" className="flex items-center gap-2 shrink-0">
          <Logo className="h-[18px] w-[18px]" />
          <span className="text-[13.5px] font-semibold tracking-tight text-ink">Canflow</span>
        </a>
        <div className="flex items-center gap-2">
          <a href="https://boards.canflow.app" target="_blank" rel="noreferrer" className="hidden sm:inline-flex items-center h-8 px-3 rounded-lg text-[12.5px] font-medium text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors">
            Create your own roadmap →
          </a>
          <button onClick={() => setShareOpen(true)} className="btn btn-outline h-8 px-3">
            <Share2 size={15} /> Share
          </button>
        </div>
      </header>

      {/* Board owner's brand + title */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-3 min-w-0">
          {org.image && (
            <img src={org.image} alt="" className="h-10 w-10 rounded-lg object-cover border border-line shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {org.name && <span className="text-[13.5px] font-semibold text-ink">{org.name}</span>}
              {org.name && <span className="text-ink-subtle">·</span>}
              <h1 className="text-[19px] font-semibold tracking-tight text-ink truncate">{board.title}</h1>
              <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-brand">
                <Globe size={12} /> Public {isRoadmap ? 'roadmap' : 'board'}
              </span>
            </div>
            {board.description && <p className="mt-0.5 text-[12.5px] text-ink-muted truncate">{board.description}</p>}
          </div>
        </div>
      </div>

      {/* Board Content */}
      <div className="px-6 pb-8">
        {isRoadmap ? (
          <RoadmapPublicView board={board} onVote={handleVote} votingTasks={votingTasks} />
        ) : (
          <KanbanPublicView board={board} onVote={handleVote} votingTasks={votingTasks} />
        )}
      </div>

      <ShareBoardModal url={shareUrl} title={`${board.title} — ${isRoadmap ? 'roadmap' : 'board'}`} isOpen={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}

function PublicColumns({
  board,
  onVote,
  votingTasks,
}: {
  board: BoardWithColumns;
  onVote: (taskId: number, voteType: 'upvote' | 'downvote') => void;
  votingTasks: Set<number>;
}) {
  return (
    <div className="flex w-full">
      {board.columns.map((column, index) => (
        <div key={column.id} className={`flex flex-col ${
          board.columns.length === 1 ? 'w-full' :
          board.columns.length === 2 ? 'w-1/2' :
          board.columns.length === 3 ? 'w-1/3' :
          board.columns.length === 4 ? 'w-1/4' :
          'w-1/5'
        } ${index < board.columns.length - 1 ? 'border-r border-line pr-4' : ''} ${index > 0 ? 'pl-4' : ''}`}>
          {/* Column Header */}
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
              {column.title}
            </h2>
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-surface-2 text-[11px] font-medium text-ink-muted">
              {column.tasks.length}
            </span>
          </div>

          {/* Tasks */}
          <div className="space-y-3 flex-1">
            {column.tasks.map((task) => {
              const tags = task.tags ? task.tags.split(',').map(tag => tag.trim()) : [];
              const primaryTag = tags[0] || '';

              return (
                <div
                  key={task.id}
                  className="card group p-3 transition-shadow hover:shadow-subtle"
                >
                  <div className="flex items-start gap-3">
                    {/* Vote Buttons */}
                    <div className="flex flex-col items-center gap-0.5 pt-0.5">
                      <button
                        onClick={() => onVote(task.id, 'upvote')}
                        disabled={votingTasks.has(task.id)}
                        className="btn btn-ghost h-7 w-7 p-0 text-ink-subtle hover:text-success"
                      >
                        <ArrowUp size={16} />
                      </button>
                      <span className="text-[12px] font-medium tabular-nums text-ink">
                        {task.upvotes}
                      </span>
                      <button
                        onClick={() => onVote(task.id, 'downvote')}
                        disabled={votingTasks.has(task.id)}
                        className="btn btn-ghost h-7 w-7 p-0 text-ink-subtle hover:text-danger"
                      >
                        <ArrowDown size={16} />
                      </button>
                    </div>

                    {/* Task Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[13px] font-medium leading-5 text-ink mb-1">
                        {task.title}
                      </h3>

                      {task.description && (
                        <p className="text-[12px] leading-[1.45] text-ink-muted line-clamp-2 mb-2.5">
                          {task.description}
                        </p>
                      )}

                      {task.image_url && (
                        <img src={task.image_url} alt="" loading="lazy" className="mb-2.5 w-full max-h-36 rounded-md object-cover border border-line bg-surface-2" />
                      )}

                      {primaryTag && (
                        <span className="inline-flex rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">
                          {primaryTag}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {column.tasks.length === 0 && (
              <div className="text-center py-8">
                <p className="text-[13px] text-ink-subtle">No items yet</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function KanbanPublicView(props: {
  board: BoardWithColumns;
  onVote: (taskId: number, voteType: 'upvote' | 'downvote') => void;
  votingTasks: Set<number>;
}) {
  return <PublicColumns {...props} />;
}

function RoadmapPublicView(props: {
  board: BoardWithColumns;
  onVote: (taskId: number, voteType: 'upvote' | 'downvote') => void;
  votingTasks: Set<number>;
}) {
  return <PublicColumns {...props} />;
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
