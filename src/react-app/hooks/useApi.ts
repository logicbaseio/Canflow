import { useState, useEffect } from 'react';
import type { Board, BoardWithColumns, CreateBoard, UpdateBoard, CreateTask, UpdateTask, CreateColumn, UpdateColumn, MoveTask, Invitation, CreateInvitation, BetaCategory, CreateBetaCategory } from '@/shared/types';

const API_BASE = '/api';

// Generic API hook
function useApi<T>(url: string, dependencies: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}${url}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, dependencies);

  return { data, loading, error, refetch: fetchData };
}

// Boards API
export function useBoards() {
  return useApi<Board[]>('/boards');
}

export function useBoard(id: number | null) {
  return useApi<BoardWithColumns>(`/boards/${id}`, [id]);
}

export async function createBoard(board: CreateBoard): Promise<Board> {
  const response = await fetch(`${API_BASE}/boards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(board),
  });
  if (!response.ok) throw new Error('Failed to create board');
  return response.json();
}

export async function updateBoard(id: number, board: UpdateBoard): Promise<Board> {
  console.log('Updating board:', id, 'with data:', board);
  const response = await fetch(`${API_BASE}/boards/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(board),
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Update board failed:', response.status, errorText);
    throw new Error(`Failed to update board: ${response.status}`);
  }
  const result = await response.json();
  console.log('Update board result:', result);
  return result;
}

export async function deleteBoard(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/boards/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete board');
}

// Tasks API
export async function createTask(task: CreateTask): Promise<any> {
  const response = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!response.ok) throw new Error('Failed to create task');
  return response.json();
}

export async function updateTask(id: number, task: UpdateTask): Promise<any> {
  const response = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!response.ok) throw new Error('Failed to update task');
  return response.json();
}

export async function moveTask(id: number, move: MoveTask): Promise<any> {
  const response = await fetch(`${API_BASE}/tasks/${id}/move`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(move),
  });
  if (!response.ok) throw new Error('Failed to move task');
  return response.json();
}

export async function deleteTask(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete task');
}

// Columns API
export async function createColumn(column: CreateColumn): Promise<any> {
  const response = await fetch(`${API_BASE}/columns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(column),
  });
  if (!response.ok) throw new Error('Failed to create column');
  return response.json();
}

export async function updateColumn(id: number, column: UpdateColumn): Promise<any> {
  const response = await fetch(`${API_BASE}/columns/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(column),
  });
  if (!response.ok) throw new Error('Failed to update column');
  return response.json();
}

export async function deleteColumn(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/columns/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete column');
}

// Public board API
export function usePublicBoard(publicKey: string) {
  return useApi<BoardWithColumns>(`/public/${publicKey}`, [publicKey]);
}

// Invitations API
export async function createInvitation(invitation: CreateInvitation): Promise<Invitation> {
  const response = await fetch(`${API_BASE}/invitations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(invitation),
  });
  if (!response.ok) throw new Error('Failed to create invitation');
  return response.json();
}

export function useInvitations(boardId: number) {
  return useApi<Invitation[]>(`/invitations/${boardId}`, [boardId]);
}

// Beta Categories API
export async function createBetaCategory(category: CreateBetaCategory): Promise<BetaCategory> {
  const response = await fetch(`${API_BASE}/beta-categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(category),
  });
  if (!response.ok) throw new Error('Failed to create beta category');
  return response.json();
}

export function useBetaCategories(boardId: number) {
  return useApi<BetaCategory[]>(`/beta-categories/${boardId}`, [boardId]);
}
