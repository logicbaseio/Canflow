import { useEffect, useRef, useState } from 'react';
import {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { moveTask } from '@/react-app/hooks/useApi';
import type { BoardWithColumns, Column, Task } from '@/shared/types';

export type ColumnWithTasks = Column & { tasks: Task[] };

// DnD ids are namespaced so a task id can never collide with a column id
// (they come from separate DB sequences and DO overlap otherwise).
export const taskDndId = (id: number) => `task-${id}`;
export const colDndId = (id: number) => `col-${id}`;
const parse = (id: string | number, prefix: string): number | null =>
  typeof id === 'string' && id.startsWith(prefix) ? Number(id.slice(prefix.length)) : null;

/**
 * Optimistic drag-and-drop for a Kanban/Beta board.
 *
 * Renders from local `columns` state that updates instantly as you drag (so the
 * card follows the cursor across columns with no snap-back), then persists the
 * final position in the background. On error it reconciles with the server.
 */
export function useBoardDnd(board: BoardWithColumns | null, refetch: () => void) {
  const [columns, setColumns] = useState<ColumnWithTasks[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const dragging = useRef(false);

  // Sync from the server whenever fresh data arrives - but never mid-drag,
  // or we'd yank the card out from under the cursor.
  useEffect(() => {
    if (board && !dragging.current) setColumns(board.columns as ColumnWithTasks[]);
  }, [board]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const containerOf = (dndId: string | number, cols: ColumnWithTasks[]): number => {
    const colId = parse(dndId, 'col-');
    if (colId != null) return cols.findIndex((c) => c.id === colId);
    const taskId = parse(dndId, 'task-');
    if (taskId != null) return cols.findIndex((c) => c.tasks.some((t) => t.id === taskId));
    return -1;
  };

  const onDragStart = (event: DragStartEvent) => {
    dragging.current = true;
    const taskId = parse(event.active.id, 'task-');
    setActiveTask(columns.flatMap((c) => c.tasks).find((t) => t.id === taskId) ?? null);
  };

  // Live cross-column movement: as the pointer enters another column, relocate
  // the dragged card into it so the layout reflows under the cursor.
  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = parse(active.id, 'task-');
    if (activeId == null) return;

    setColumns((prev) => {
      const from = containerOf(active.id, prev);
      const to = containerOf(over.id, prev);
      if (from === -1 || to === -1 || from === to) return prev;

      const next = prev.map((c) => ({ ...c, tasks: [...c.tasks] }));
      const src = next[from];
      const dst = next[to];
      const ai = src.tasks.findIndex((t) => t.id === activeId);
      if (ai === -1) return prev;
      const [moved] = src.tasks.splice(ai, 1);

      const overTaskId = parse(over.id, 'task-');
      const insertAt = overTaskId != null ? dst.tasks.findIndex((t) => t.id === overTaskId) : dst.tasks.length;
      dst.tasks.splice(insertAt === -1 ? dst.tasks.length : insertAt, 0, { ...moved, column_id: dst.id });
      return next;
    });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    dragging.current = false;

    const activeId = parse(active.id, 'task-');
    // `columns` already reflects any cross-column move from onDragOver, so we can
    // read the destination synchronously here (no state-updater timing games).
    const to = over && activeId != null ? containerOf(over.id, columns) : -1;
    if (to === -1 || activeId == null || !over) return;

    const dst = columns[to];
    const oldIndex = dst.tasks.findIndex((t) => t.id === activeId);
    const overTaskId = parse(over.id, 'task-');
    const newIndex = overTaskId != null ? dst.tasks.findIndex((t) => t.id === overTaskId) : dst.tasks.length - 1;
    const reordered =
      oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex ? arrayMove(dst.tasks, oldIndex, newIndex) : dst.tasks;
    const position = reordered.findIndex((t) => t.id === activeId);

    if (reordered !== dst.tasks) {
      setColumns((prev) => prev.map((c, i) => (i === to ? { ...c, tasks: reordered } : c)));
    }

    moveTask(activeId, { column_id: dst.id, position }).catch((err) => {
      console.error('Failed to move task:', err);
      refetch(); // roll back to server truth
    });
  };

  return { columns, activeTask, sensors, collisionDetection: closestCorners, onDragStart, onDragOver, onDragEnd };
}
