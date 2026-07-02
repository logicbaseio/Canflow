import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Board, UpdateBoard } from '@/shared/types';

interface EditBoardModalProps {
  board: Board | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: UpdateBoard) => void;
}

const SWATCHES = ['#1d1d1f', '#2f6feb', '#2f9e6f', '#c98a1b', '#d23f3f', '#8b5cf6', '#0ea5a3', '#e2547d'];

export default function EditBoardModal({ board, isOpen, onClose, onSave }: EditBoardModalProps) {
  const [formData, setFormData] = useState({ title: '', description: '', color: '#1d1d1f', github_repo: '' });

  useEffect(() => {
    if (board) {
      setFormData({ title: board.title, description: board.description || '', color: board.color || '#1d1d1f', github_repo: board.github_repo || '' });
    }
  }, [board, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ title: formData.title, description: formData.description || undefined, color: formData.color, github_repo: formData.github_repo.trim() || null });
    onClose();
  };

  if (!isOpen || !board) return null;

  const boardTypeLabel = board.board_type === 'roadmap' ? 'roadmap' : board.board_type === 'beta-testing' ? 'beta board' : 'board';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--overlay)' }}
      onMouseDown={onClose}
    >
      <div className="card w-full max-w-md shadow-pop" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
          <h2 className="text-[14px] font-semibold text-ink">Edit {boardTypeLabel}</h2>
          <button onClick={onClose} className="btn btn-ghost h-7 w-7 p-0 text-ink-subtle"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-ink-muted">Name</span>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="field"
              placeholder="Board name…"
              required
              autoFocus
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-ink-muted">Description</span>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="field resize-none"
              placeholder="Add a description…"
              rows={3}
            />
          </label>

          <div>
            <span className="mb-1.5 block text-[12px] font-medium text-ink-muted">Color</span>
            <div className="flex items-center gap-2">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: c })}
                  className={`h-6 w-6 rounded-full transition-transform ${formData.color === c ? 'ring-2 ring-offset-2 ring-[var(--border-strong)] scale-110' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c, '--tw-ring-offset-color': 'var(--surface)' } as React.CSSProperties}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-ink-muted">GitHub repo <span className="text-ink-subtle font-normal">(optional)</span></span>
            <input
              type="text"
              value={formData.github_repo}
              onChange={(e) => setFormData({ ...formData, github_repo: e.target.value })}
              className="field font-mono text-[12.5px]"
              placeholder="owner/repo"
            />
            <span className="mt-1.5 block text-[11px] text-ink-subtle">Lets you open GitHub issues from cards. Connect GitHub in Settings → Developer first.</span>
          </label>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn btn-outline flex-1 h-9">Cancel</button>
            <button type="submit" className="btn btn-primary flex-1 h-9">Save changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}
