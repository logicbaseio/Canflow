import { useState } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { Plus, Settings, UserPlus, X } from 'lucide-react';
import BetaColumn from './BetaColumn';
import BetaTaskCard from './BetaTaskCard';
import TaskModal from './TaskModal';
import FixWithModal from './FixWithModal';
import Select from '@/react-app/components/ui/Select';
import EditableTitle from '@/react-app/components/ui/EditableTitle';
import AutopilotMenu from '@/react-app/components/ui/AutopilotMenu';
import BoardLoader from '@/react-app/components/ui/BoardLoader';
import InviteList from '@/react-app/components/ui/InviteList';
import { useDialog } from '@/react-app/components/ui/Dialog';
import { authedFetch } from '@/react-app/lib/auth';
import { useBoardDnd } from '@/react-app/hooks/useBoardDnd';
import { useBoard, createTask, updateTask, deleteTask, createColumn, deleteColumn, updateBoard, useBetaCategories } from '@/react-app/hooks/useApi';
import type { Task, CreateTask, UpdateTask, CreateColumn } from '@/shared/types';

interface BetaTestingBoardProps {
  boardId: number;
  onBoardChanged?: () => void;
}

export default function BetaTestingBoard({ boardId, onBoardChanged }: BetaTestingBoardProps) {
  const { data: board, loading, refetch } = useBoard(boardId);
  const { data: categories, refetch: refetchCategories } = useBetaCategories(boardId);
  const { confirm, prompt, toast } = useDialog();
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskColumnId, setNewTaskColumnId] = useState<number | null>(null);
  const [pendingColumnId, setPendingColumnId] = useState<number | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [inviteColumnId, setInviteColumnId] = useState<number | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRefresh, setInviteRefresh] = useState(0);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [fixingTask, setFixingTask] = useState<Task | null>(null);
  const [fixAgent, setFixAgent] = useState<'claude' | 'codex' | null>(null);
  const handleFix = (task: Task, agent: 'claude' | 'codex') => { setFixAgent(agent); setFixingTask(task); };

  const { columns, activeTask, sensors, collisionDetection, onDragStart, onDragOver, onDragEnd } = useBoardDnd(board, refetch);

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
    if (!(await confirm({ title: 'Delete report', message: 'This bug report will be permanently removed.', confirmText: 'Delete', danger: true }))) return;

    try {
      await deleteTask(taskId);
      refetch();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
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
    const title = await prompt({ title: 'Add phase', placeholder: 'e.g. Testing, Verified, Fixing…', confirmText: 'Add phase' });
    if (!title?.trim() || !board) return;

    try {
      const columnData: CreateColumn = {
        board_id: board.id,
        title: title.trim(),
        position: board.columns.length,
        color: '#cbd5e1',
      };
      await createColumn(columnData);
      refetch();
    } catch (error) {
      console.error('Failed to create column:', error);
    }
  };

  const handleDeleteColumn = async (columnId: number) => {
    if (!(await confirm({ title: 'Delete phase', message: 'This phase and all its reports will be permanently removed.', confirmText: 'Delete', danger: true }))) return;
    try { await deleteColumn(columnId); refetch(); } catch (e) { console.error('Failed to delete phase:', e); }
  };

  const handleInviteToColumn = (columnId: number) => {
    setInviteColumnId(columnId);
    setShowInviteModal(true);
  };

  const handleInviteUser = async () => {
    if (!inviteEmail.trim() || !inviteColumnId) {
      toast('Enter an email and select a phase');
      return;
    }

    try {
      const response = await authedFetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board_id: boardId,
          column_id: inviteColumnId,
          email: inviteEmail.trim(),
          invited_by: 'admin',
        }),
      });

      const responseData = await response.json();

      if (response.ok) {
        if (responseData.emailSent) {
          toast(responseData.reinvited ? `Invite re-sent to ${inviteEmail.trim()}` : `Invite emailed to ${inviteEmail.trim()}`);
        } else if (responseData.inviteUrl) {
          await navigator.clipboard.writeText(responseData.inviteUrl).catch(() => {});
          toast('Invite created - link copied to clipboard');
        } else {
          toast('Invite created');
        }
        setInviteEmail('');
        setInviteColumnId(null);
        setInviteRefresh((n) => n + 1);
      } else {
        // Surface the server's actual reason (e.g. the free-plan tester limit).
        throw new Error(responseData.error || `HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send invitation:', error);
      toast(error instanceof Error && error.message ? error.message : 'Failed to create invite');
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      const response = await authedFetch('/api/beta-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board_id: boardId,
          name: newCategoryName.trim(),
        }),
      });

      if (response.ok) {
        setNewCategoryName('');
        refetchCategories();
      }
    } catch (error) {
      console.error('Failed to add category:', error);
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
        <div className="min-w-0 flex-1 pr-4">
          <EditableTitle boardId={board.id} value={board.title} onRenamed={() => { refetch(); onBoardChanged?.(); }} />
          <p className="truncate text-[12px] text-ink-subtle pl-1.5 -ml-1.5">Beta testing space</p>
        </div>
        <div className="flex items-center gap-2">
          <AutopilotMenu
            agent={board.autopilot_agent ?? null}
            priority={board.autopilot_priority ?? null}
            showCondition={false}
            label="new bug reports"
            onChange={async (agent) => {
              try {
                await updateBoard(board.id, { autopilot_agent: agent, autopilot_priority: '' });
                await refetch();
                toast(agent ? `Autopilot on — new bug reports auto-queue for ${agent === 'codex' ? 'Codex' : 'Claude Code'}` : 'Autopilot off');
              } catch (e) { console.error('autopilot', e); toast('Could not update autopilot'); }
            }}
          />
          <button onClick={() => setShowCategoriesModal(true)} className="btn btn-outline h-8 px-3">
            <Settings size={15} /> Categories
          </button>
          <button onClick={() => setShowInviteModal(true)} className="btn btn-outline h-8 px-3">
            <UserPlus size={15} /> Invite testers
          </button>
          <button onClick={handleAddColumn} className="btn btn-outline h-8 px-3">
            <Plus size={15} /> Add phase
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-5">
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <div className="flex gap-4 h-full items-stretch">
            {columns.map((column) => (
              <BetaColumn
                key={column.id}
                column={column}
                pending={pendingColumnId === column.id}
                onAddTask={handleAddTask}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
                onFixTask={handleFix}
                onInviteToColumn={handleInviteToColumn}
                onDeleteColumn={handleDeleteColumn}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask && (
              <div className="w-72 rotate-1">
                <BetaTaskCard
                  task={activeTask}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Task Modal */}
      <TaskModal
        task={editingTask}
        columnId={newTaskColumnId || undefined}
        boardType="beta-testing"
        categories={categories || []}
        isOpen={taskModalOpen}
        onClose={() => {
          setTaskModalOpen(false);
          setEditingTask(null);
          setNewTaskColumnId(null);
        }}
        onSave={handleTaskSave}
      />

      <FixWithModal task={fixingTask} boardTitle={board.title} githubRepo={board.github_repo} initialAgent={fixAgent} isOpen={!!fixingTask} onClose={() => setFixingTask(null)} />

      {/* Invite Modal */}
      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'var(--overlay)' }}
        >
          <div className="card w-full max-w-lg shadow-pop">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
              <h2 className="text-[14px] font-semibold text-ink">Invite beta tester</h2>
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteEmail('');
                  setInviteColumnId(null);
                }}
                className="btn btn-ghost h-7 w-7 p-0 text-ink-subtle"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-ink-muted">
                  Email address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="field"
                  placeholder="Enter tester's email…"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-ink-muted">
                  Assign to phase
                </label>
                <Select
                  value={inviteColumnId ? String(inviteColumnId) : ''}
                  onChange={(v) => setInviteColumnId(v ? parseInt(v) : null)}
                  options={board.columns.map((column) => ({ value: String(column.id), label: column.title }))}
                  placeholder="Select a phase…"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteEmail('');
                    setInviteColumnId(null);
                  }}
                  className="btn btn-outline flex-1 h-9"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInviteUser}
                  disabled={!inviteEmail.trim() || !inviteColumnId}
                  className="btn btn-primary flex-1 h-9"
                >
                  Send invite
                </button>
              </div>

              <InviteList boardId={boardId} columns={board.columns} refreshKey={inviteRefresh} />
            </div>
          </div>
        </div>
      )}

      {/* Categories Modal */}
      {showCategoriesModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'var(--overlay)' }}
        >
          <div className="card w-full max-w-md shadow-pop">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
              <h2 className="text-[14px] font-semibold text-ink">Manage categories</h2>
              <button
                onClick={() => setShowCategoriesModal(false)}
                className="btn btn-ghost h-7 w-7 p-0 text-ink-subtle"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="field"
                  placeholder="Category name…"
                />
                <button
                  onClick={handleAddCategory}
                  disabled={!newCategoryName.trim()}
                  className="btn btn-primary h-9 px-4 shrink-0"
                >
                  Add
                </button>
              </div>

              <div className="space-y-1.5">
                {categories && categories.length > 0 ? (
                  categories.map((category) => (
                    <div key={category.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
                      <span className="text-[13px] text-ink">{category.name}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-[12px] text-ink-subtle">No categories yet. Add some to organize bug reports.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
