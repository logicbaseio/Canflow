import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import BoardSelector from '@/react-app/components/BoardSelector';
import KanbanBoard from '@/react-app/components/KanbanBoard';
import RoadmapBoard from '@/react-app/components/RoadmapBoard';
import BetaTestingBoard from '@/react-app/components/BetaTestingBoard';
import { useAppContext } from '@/react-app/context/AppContext';
import { useBoards, createBoard } from '@/react-app/hooks/useApi';
import type { CreateBoard } from '@/shared/types';

const QUICK_TYPES: { type: CreateBoard['board_type']; label: string }[] = [
  { type: 'kanban', label: 'Kanban' },
  { type: 'roadmap', label: 'Roadmap' },
  { type: 'beta-testing', label: 'Beta Testing' },
];

export default function Home() {
  const { state, dispatch } = useAppContext();
  const { data: boards, refetch: refetchBoards } = useBoards();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (boards) {
      dispatch({ type: 'SET_BOARDS', payload: boards });
    }
  }, [boards, dispatch]);

  const handleBoardSelect = (boardId: number) => {
    dispatch({ type: 'SET_SELECTED_BOARD_ID', payload: boardId });
  };

  const handleQuickCreate = async (type: CreateBoard['board_type']) => {
    setCreating(true);
    try {
      const label = type === 'roadmap' ? 'Roadmap' : type === 'beta-testing' ? 'Beta Testing' : 'Board';
      const board = await createBoard({
        title: `Untitled ${label}`,
        description: undefined,
        color: '#1d1d1f',
        board_type: type,
      });
      // Add to context first so the board view can render immediately (no flash).
      dispatch({ type: 'ADD_BOARD', payload: board });
      dispatch({ type: 'SET_SELECTED_BOARD_ID', payload: board.id });
      refetchBoards();
    } catch (e) {
      console.error('Failed to create board:', e);
    } finally {
      setCreating(false);
    }
  };

  const selectedBoard = state.boards.find((b) => b.id === state.selectedBoardId);

  const renderBoard = () => {
    if (!state.selectedBoardId || !selectedBoard) return null;
    const id = state.selectedBoardId;
    const props = { boardId: id, onBoardChanged: refetchBoards };
    // key per board → clean mount on switch (no stale-content flash)
    if (selectedBoard.board_type === 'roadmap') return <RoadmapBoard key={id} {...props} />;
    if (selectedBoard.board_type === 'beta-testing') return <BetaTestingBoard key={id} {...props} />;
    return <KanbanBoard key={id} {...props} />;
  };

  return (
    <div className="flex h-screen bg-app text-ink overflow-hidden">
      <BoardSelector boards={boards ?? null} refetchBoards={refetchBoards} onBoardSelect={handleBoardSelect} />

      {state.selectedBoardId && selectedBoard ? (
        <main className="flex-1 min-w-0 overflow-hidden">{renderBoard()}</main>
      ) : (
        <main className="flex-1 min-w-0 flex items-center justify-center px-6">
          <div className="w-full max-w-lg -mt-10">
            <div className="flex items-center gap-2.5 mb-7 justify-center">
              <Logo className="h-7 w-7" />
              <span className="text-[15px] font-semibold tracking-tight">Canflow</span>
            </div>

            <h1 className="text-center text-[22px] font-semibold tracking-tight mb-1.5">Start a board</h1>
            <p className="text-center text-[13px] text-ink-muted mb-7">
              Plan tasks and tickets, ship roadmaps, and run beta tests — all in one minimal workspace.
            </p>

            <div className="card shadow-subtle p-1.5">
              {QUICK_TYPES.map(({ type, label }) => (
                <button
                  key={type}
                  disabled={creating}
                  onClick={() => handleQuickCreate(type)}
                  className="group w-full flex items-center justify-between rounded-lg px-3.5 py-3 text-left transition-colors hover:bg-surface-2 disabled:opacity-50"
                >
                  <span className="flex items-center gap-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-ink-subtle group-hover:bg-ink transition-colors" />
                    <span className="text-[13.5px] font-medium">{label}</span>
                  </span>
                  <ArrowRight size={15} className="text-ink-subtle opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                </button>
              ))}
            </div>

            <p className="mt-5 text-center text-[12px] text-ink-subtle">or pick an existing board from the sidebar</p>
          </div>
        </main>
      )}
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
