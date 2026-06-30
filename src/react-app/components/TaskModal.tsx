import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import Select from '@/react-app/components/ui/Select';
import DatePicker from '@/react-app/components/ui/DatePicker';
import type { Task, CreateTask, UpdateTask } from '@/shared/types';

interface TaskModalProps {
  task?: Task | null;
  columnId?: number;
  boardType?: 'kanban' | 'roadmap' | 'beta-testing';
  categories?: Array<{ id: number; name: string; color: string }>;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateTask | UpdateTask) => void;
}

const EMPTY = {
  title: '',
  description: '',
  priority: '' as 'low' | 'medium' | 'high' | '',
  due_date: '',
  tags: '',
  intensity: 0,
  category: '',
};

export default function TaskModal({ task, columnId, boardType = 'kanban', categories = [], isOpen, onClose, onSave }: TaskModalProps) {
  const [formData, setFormData] = useState(EMPTY);

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description || '',
        priority: (task.priority as 'low' | 'medium' | 'high' | '') || '',
        due_date: task.due_date || '',
        tags: task.tags || '',
        intensity: task.intensity || 0,
        category: task.category || '',
      });
    } else {
      setFormData(EMPTY);
    }
  }, [task, isOpen]);

  const isRoadmap = boardType === 'roadmap';
  const isBetaTesting = boardType === 'beta-testing';
  const dateLabel = isRoadmap ? 'Expected release' : isBetaTesting ? 'Reported date' : 'Due date';
  const taskLabel = isRoadmap ? 'Item' : isBetaTesting ? 'Report' : 'Task';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const shared = {
      title: formData.title,
      description: formData.description || undefined,
      priority: formData.priority || undefined,
      due_date: formData.due_date || undefined,
      tags: formData.tags || undefined,
      intensity: isBetaTesting ? formData.intensity : undefined,
      category: isBetaTesting ? (formData.category || undefined) : undefined,
    };
    if (task) {
      onSave(shared as UpdateTask);
    } else if (columnId) {
      onSave({ ...shared, column_id: columnId, position: 0 } as CreateTask);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--overlay)' }}
      onMouseDown={onClose}
    >
      <div className="card w-full max-w-md shadow-pop" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 h-13 py-3.5 border-b border-line">
          <h2 className="text-[14px] font-semibold text-ink">{task ? `Edit ${taskLabel.toLowerCase()}` : `New ${taskLabel.toLowerCase()}`}</h2>
          <button onClick={onClose} className="btn btn-ghost h-7 w-7 p-0 text-ink-subtle"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Field label={`${taskLabel} title`}>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="field"
              placeholder={`${taskLabel} title…`}
              required
              autoFocus
            />
          </Field>

          <Field label="Description">
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="field resize-none"
              placeholder={isBetaTesting ? 'Describe the bug or issue…' : 'Add a description…'}
              rows={3}
            />
          </Field>

          {isBetaTesting ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category">
                  <Select
                    value={formData.category}
                    onChange={(v) => setFormData({ ...formData, category: v })}
                    options={categories.map((c) => ({ value: c.name, label: c.name, color: c.color }))}
                    placeholder="Select…"
                  />
                </Field>
                <Field label={`Intensity · ${formData.intensity}`}>
                  <input
                    type="range" min={0} max={10}
                    value={formData.intensity}
                    onChange={(e) => setFormData({ ...formData, intensity: parseInt(e.target.value) })}
                    className="w-full accent-[var(--accent)] mt-2"
                  />
                </Field>
              </div>
              <Field label={dateLabel}>
                <DatePicker value={formData.due_date} onChange={(v) => setFormData({ ...formData, due_date: v })} placeholder="Pick a date" />
              </Field>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Priority">
                  <Select
                    value={formData.priority}
                    onChange={(v) => setFormData({ ...formData, priority: v as 'low' | 'medium' | 'high' | '' })}
                    options={[
                      { value: '', label: 'None' },
                      { value: 'low', label: 'Low', color: 'var(--success)' },
                      { value: 'medium', label: 'Medium', color: 'var(--warning)' },
                      { value: 'high', label: 'High', color: 'var(--danger)' },
                    ]}
                    placeholder="None"
                  />
                </Field>
                <Field label={dateLabel}>
                  <DatePicker value={formData.due_date} onChange={(v) => setFormData({ ...formData, due_date: v })} placeholder="Pick a date" />
                </Field>
              </div>
              <Field label="Tags">
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="field"
                  placeholder="comma, separated, tags"
                />
              </Field>
            </>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn btn-outline flex-1 h-9">Cancel</button>
            <button type="submit" className="btn btn-primary flex-1 h-9">{task ? 'Save changes' : `Create ${taskLabel.toLowerCase()}`}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
