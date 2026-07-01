import React, { useState } from 'react';
import { Plus, MoreHorizontal, Edit2, Trash2, Link2, Globe, Lock, LogOut, Settings } from 'lucide-react';
import { createBoard, deleteBoard, updateBoard } from '@/react-app/hooks/useApi';
import { useAppContext } from '@/react-app/context/AppContext';
import DarkModeToggle from '@/react-app/components/DarkModeToggle';
import EditBoardModal from '@/react-app/components/EditBoardModal';
import SettingsModal from '@/react-app/components/SettingsModal';
import { useDialog } from '@/react-app/components/ui/Dialog';
import { authClient, useSession } from '@/react-app/lib/auth';
import { celebrate } from '@/react-app/lib/confetti';
import type { CreateBoard, Board, UpdateBoard } from '@/shared/types';

interface BoardSelectorProps {
  boards: Board[] | null;
  refetchBoards: () => void;
  onBoardSelect: (boardId: number) => void;
}

const BOARD_TYPES: { value: CreateBoard['board_type']; label: string }[] = [
  { value: 'kanban', label: 'Kanban' },
  { value: 'roadmap', label: 'Roadmap' },
  { value: 'beta-testing', label: 'Beta' },
];

function typeLabel(t: string) {
  if (t === 'roadmap') return 'Roadmap';
  if (t === 'beta-testing') return 'Beta testing';
  return 'Kanban';
}

export default function BoardSelector({ boards, refetchBoards, onBoardSelect }: BoardSelectorProps) {
  const loading = boards === null;
  const { state, dispatch } = useAppContext();
  const { confirm, toast } = useDialog();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showMenu, setShowMenu] = useState<number | null>(null);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [newBoardType, setNewBoardType] = useState<CreateBoard['board_type']>('kanban');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingBoard, setEditingBoard] = useState<Board | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardTitle.trim()) return;
    try {
      const newBoard = await createBoard({
        title: newBoardTitle.trim(),
        description: undefined,
        color: '#1d1d1f',
        board_type: newBoardType,
      });
      dispatch({ type: 'ADD_BOARD', payload: newBoard });
      setNewBoardTitle('');
      setNewBoardType('kanban');
      setShowCreateForm(false);
      onBoardSelect(newBoard.id);
      celebrate();
      refetchBoards();
    } catch (error) {
      console.error('Failed to create board:', error);
    }
  };

  const handleTogglePublic = async (board: Board) => {
    try {
      await updateBoard(board.id, { is_public: !board.is_public });
      refetchBoards();
    } catch (error) {
      console.error('Failed to toggle board visibility:', error);
    }
  };

  const copyPublicLink = (publicKey: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/public/${publicKey}`);
    toast('Public link copied to clipboard');
  };

  const handleEditBoard = (board: Board) => {
    setEditingBoard(board);
    setEditModalOpen(true);
    setShowMenu(null);
  };

  const handleSaveBoard = async (data: UpdateBoard) => {
    if (!editingBoard) return;
    try {
      const updatedBoard = await updateBoard(editingBoard.id, data);
      dispatch({ type: 'UPDATE_BOARD', payload: updatedBoard });
      refetchBoards();
    } catch (error) {
      console.error('Failed to update board:', error);
    }
  };

  const handleDeleteBoard = async (boardId: number) => {
    if (!(await confirm({ title: 'Delete board', message: 'All its columns and tasks will be permanently removed.', confirmText: 'Delete', danger: true }))) return;
    try {
      await deleteBoard(boardId);
      dispatch({ type: 'DELETE_BOARD', payload: boardId });
      refetchBoards();
    } catch (error) {
      console.error('Failed to delete board:', error);
    }
  };

  return (
    <aside className="w-64 shrink-0 h-screen bg-app border-r border-line flex flex-col">
      {/* Brand + new */}
      <div className="px-3 pt-3.5 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 pl-1">
          <Logo className="h-[18px] w-[18px]" />
          <span className="text-[13.5px] font-semibold tracking-tight">Canflow</span>
        </div>
        <button
          onClick={() => setShowCreateForm((v) => !v)}
          className="btn btn-ghost h-7 w-7 p-0"
          title="New board"
        >
          <Plus size={16} className="text-ink-muted" />
        </button>
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreateBoard} className="px-3 pb-2">
          <div className="card p-2 space-y-2 shadow-subtle">
            <input
              type="text"
              value={newBoardTitle}
              onChange={(e) => setNewBoardTitle(e.target.value)}
              placeholder="Board name"
              className="field"
              autoFocus
            />
            <div className="flex gap-1 p-0.5 rounded-lg bg-surface-2">
              {BOARD_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setNewBoardType(t.value)}
                  className={`flex-1 rounded-md py-1 text-[12px] font-medium transition-colors ${
                    newBoardType === t.value
                      ? 'bg-surface text-ink shadow-subtle'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <button type="submit" className="btn btn-primary flex-1 h-7">Create</button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewBoardTitle('');
                  setNewBoardType('kanban');
                }}
                className="btn btn-outline h-7 px-3"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Board list */}
      <div className="flex-1 overflow-y-auto px-2 pt-1">
        <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
          Boards
        </div>

        {loading ? (
          <div className="space-y-1 px-1 animate-pulse">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 rounded-lg bg-surface-2" />
            ))}
          </div>
        ) : boards && boards.length === 0 ? (
          <button
            onClick={() => setShowCreateForm(true)}
            className="w-full text-left px-3 py-2 text-[13px] text-ink-muted hover:text-ink transition-colors"
          >
            No boards yet — create one
          </button>
        ) : (
          <nav className="space-y-0.5">
            {boards?.map((board) => {
              const active = state.selectedBoardId === board.id;
              return (
                <div key={board.id} className="relative group">
                  <button
                    onClick={() => onBoardSelect(board.id)}
                    className={`w-full flex items-center gap-2.5 rounded-lg pl-2.5 pr-8 py-[7px] text-left transition-colors ${
                      active ? 'bg-accent-soft text-ink' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
                    }`}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: board.color || 'var(--text-subtle)' }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-medium">{board.title}</span>
                        {!!board.is_public && <Globe size={11} className="text-brand shrink-0" />}
                      </span>
                      <span className="block truncate text-[11px] text-ink-subtle">{typeLabel(board.board_type)}</span>
                    </span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(showMenu === board.id ? null : board.id);
                    }}
                    className={`absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md flex items-center justify-center text-ink-subtle hover:bg-surface-3 hover:text-ink transition ${
                      showMenu === board.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <MoreHorizontal size={15} />
                  </button>

                  {showMenu === board.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowMenu(null)} />
                      <div className="menu absolute right-1.5 top-9 z-20 w-44 py-1">
                        <button className="menu-item" onClick={() => { handleTogglePublic(board); setShowMenu(null); }}>
                          {board.is_public ? <Lock size={14} /> : <Globe size={14} />}
                          {board.is_public ? 'Make private' : 'Make public'}
                        </button>
                        {!!board.is_public && board.public_key && (
                          <button className="menu-item" onClick={() => { copyPublicLink(board.public_key!); setShowMenu(null); }}>
                            <Link2 size={14} />
                            Copy public link
                          </button>
                        )}
                        <button className="menu-item" onClick={() => handleEditBoard(board)}>
                          <Edit2 size={14} />
                          Edit
                        </button>
                        <div className="my-1 h-px bg-line" />
                        <button
                          className="menu-item text-danger"
                          onClick={() => { handleDeleteBoard(board.id); setShowMenu(null); }}
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </nav>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-line">
        <UserFooter boardCount={boards?.length ?? 0} onOpenSettings={() => setSettingsOpen(true)} />
      </div>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <EditBoardModal
        board={editingBoard}
        isOpen={editModalOpen}
        onClose={() => { setEditModalOpen(false); setEditingBoard(null); }}
        onSave={handleSaveBoard}
      />
    </aside>
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

function UserFooter({ boardCount, onOpenSettings }: { boardCount: number; onOpenSettings: () => void }) {
  const { data } = useSession();
  const user = data?.user;
  const label = user?.name || user?.email || 'Account';
  const initial = (user?.name || user?.email || '?').charAt(0).toUpperCase();

  const signOut = async () => {
    try { await authClient.signOut(); } catch { /* ignore */ }
    window.location.assign('/');
  };

  return (
    <div className="px-2.5 py-2">
      <button onClick={onOpenSettings} className="w-full flex items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-surface-2 transition-colors" title="Settings">
        <span className="h-6 w-6 rounded-full bg-accent-soft flex items-center justify-center text-[11px] font-semibold text-ink shrink-0">
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-medium text-ink">{label}</span>
          {user?.email && user?.name && (
            <span className="block truncate text-[11px] text-ink-subtle">{user.email}</span>
          )}
        </span>
      </button>
      <div className="mt-1 flex items-center justify-between px-1.5">
        <span className="text-[11px] text-ink-subtle">
          {boardCount} {boardCount === 1 ? 'board' : 'boards'}
        </span>
        <div className="flex items-center gap-0.5">
          <button onClick={onOpenSettings} className="btn btn-ghost h-7 w-7 p-0 text-ink-subtle" title="Settings">
            <Settings size={15} />
          </button>
          <DarkModeToggle />
          <button onClick={signOut} className="btn btn-ghost h-7 w-7 p-0 text-ink-subtle" title="Sign out">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
