import React, { useState, useEffect, useRef } from 'react';
import { X, ImagePlus, Loader2, Trash2, Send, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import Select from '@/react-app/components/ui/Select';
import DatePicker from '@/react-app/components/ui/DatePicker';
import { AgentStatusBadge } from '@/react-app/components/ui/AgentStatusBadge';
import { agentIdentity } from '@/react-app/components/ui/AgentLogos';
import { authedFetch, useSession } from '@/react-app/lib/auth';
import type { Task, CreateTask, UpdateTask, IssueComment } from '@/shared/types';

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
  start_date: '',
  due_date: '',
  tags: '',
  intensity: 0,
  category: '',
  image_url: '',
};

/** Read an image file and downscale/compress it to a small JPEG data URL for storage. */
async function fileToDataURL(file: File, maxDim = 1280, quality = 0.72): Promise<string> {
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error('read failed'));
    r.readAsDataURL(file);
  });
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = () => rej(new Error('decode failed'));
    img.src = dataUrl;
  });
  let { width, height } = img;
  if (Math.max(width, height) > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

export default function TaskModal({ task, columnId, boardType = 'kanban', categories = [], isOpen, onClose, onSave }: TaskModalProps) {
  const [formData, setFormData] = useState(EMPTY);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: session } = useSession();
  const userName = session?.user?.name || session?.user?.email || 'You';

  const [comments, setComments] = useState<IssueComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!isOpen || !task?.id) { setComments([]); return; }
    setLoadingComments(true);
    authedFetch(`/api/issues/${task.id}/comments`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setComments(Array.isArray(d) ? d : []))
      .catch(() => setComments([]))
      .finally(() => setLoadingComments(false));
    setNewComment('');
  }, [isOpen, task?.id]);

  const postComment = async () => {
    if (!task?.id || !newComment.trim()) return;
    setPosting(true);
    try {
      const res = await authedFetch(`/api/issues/${task.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: userName, body: newComment.trim() }),
      });
      if (res.ok) {
        const created = await res.json();
        setComments((c) => [...c, created]);
        setNewComment('');
      }
    } catch (e) {
      console.error('Failed to post comment:', e);
    } finally {
      setPosting(false);
    }
  };

  useEffect(() => {
    setImgError(null);
    if (task) {
      setFormData({
        title: task.title,
        description: task.description || '',
        priority: (task.priority as 'low' | 'medium' | 'high' | '') || '',
        start_date: task.start_date || '',
        due_date: task.due_date || '',
        tags: task.tags || '',
        intensity: task.intensity || 0,
        category: task.category || '',
        image_url: task.image_url || '',
      });
    } else {
      setFormData(EMPTY);
    }
  }, [task, isOpen]);

  const isRoadmap = boardType === 'roadmap';
  const isBetaTesting = boardType === 'beta-testing';
  const dateLabel = isRoadmap ? 'Expected release' : isBetaTesting ? 'Reported date' : 'Due date';
  const taskLabel = isRoadmap ? 'Item' : isBetaTesting ? 'Report' : 'Task';

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImgError('Please choose an image file.');
      return;
    }
    setImgError(null);
    setImgLoading(true);
    try {
      const dataUrl = await fileToDataURL(file);
      setFormData((f) => ({ ...f, image_url: dataUrl }));
    } catch {
      setImgError('Could not process that image.');
    } finally {
      setImgLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const shared = {
      title: formData.title,
      description: formData.description || undefined,
      priority: formData.priority || undefined,
      start_date: formData.start_date || undefined,
      due_date: formData.due_date || undefined,
      tags: formData.tags || undefined,
      intensity: isBetaTesting ? formData.intensity : undefined,
      category: isBetaTesting ? (formData.category || undefined) : undefined,
      image_url: formData.image_url || null,
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
      <div className="card w-full max-w-md shadow-pop flex flex-col max-h-[90vh]" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line shrink-0">
          <h2 className="text-[14px] font-semibold text-ink">{task ? `Edit ${taskLabel.toLowerCase()}` : `New ${taskLabel.toLowerCase()}`}</h2>
          <button onClick={onClose} className="btn btn-ghost h-7 w-7 p-0 text-ink-subtle"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
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
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start date">
                  <DatePicker value={formData.start_date} onChange={(v) => setFormData({ ...formData, start_date: v })} placeholder="Pick a date" />
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

          {/* Attachment */}
          <div>
            <span className="mb-1.5 block text-[12px] font-medium text-ink-muted">Attachment</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {formData.image_url ? (
              <div className="relative group rounded-lg overflow-hidden border border-line">
                <img src={formData.image_url} alt="attachment" className="w-full max-h-52 object-contain bg-surface-2" />
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="btn btn-outline h-7 px-2 text-[12px] shadow-subtle"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((f) => ({ ...f, image_url: '' }))}
                    className="h-7 w-7 rounded-md flex items-center justify-center bg-surface border border-line text-danger hover:bg-surface-2 shadow-subtle"
                    title="Remove image"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={imgLoading}
                className="w-full rounded-lg border border-dashed border-line px-3 py-6 flex flex-col items-center gap-1.5 text-ink-subtle hover:text-ink hover:border-line-strong hover:bg-surface-2 transition-colors disabled:opacity-60"
              >
                {imgLoading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
                <span className="text-[12.5px] font-medium">{imgLoading ? 'Processing…' : 'Add an image for reference'}</span>
                <span className="text-[11px] text-ink-subtle">PNG, JPG - resized automatically</span>
              </button>
            )}
            {imgError && <p className="mt-1.5 text-[12px] text-danger">{imgError}</p>}
          </div>

          {task && task.agent && (
            <div className="border-t border-line pt-4">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">Agent run</span>
                <AgentStatusBadge agent={task.agent} status={task.agent_status} />
              </div>
              {task.agent_note && (
                <p className="mb-2 rounded-md bg-surface-2 px-2.5 py-2 text-[12.5px] leading-relaxed text-ink-muted whitespace-pre-wrap">{task.agent_note}</p>
              )}
              {task.github_url && (
                <a href={task.github_url} target="_blank" rel="noreferrer"
                   className="mb-3 inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[12px] font-medium text-ink hover:bg-surface-2 transition-colors">
                  <ExternalLink size={13} />
                  {task.github_issue_number ? `View #${task.github_issue_number} on GitHub` : 'View the pull request'}
                </a>
              )}
            </div>
          )}

          {task && (
            <div className="border-t border-line pt-4">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">Activity</span>
              </div>

              {loadingComments ? (
                <div className="flex items-center gap-2 text-[12px] text-ink-subtle"><Loader2 size={14} className="animate-spin" /> Loading activity…</div>
              ) : comments.length > 0 ? (
                <ul className="space-y-2.5">
                  {comments.map((cm) => <CommentRow key={cm.id} comment={cm} />)}
                </ul>
              ) : (
                <p className="text-[12px] text-ink-subtle">No activity yet.</p>
              )}

              <div className="mt-3 flex items-end gap-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); postComment(); } }}
                  rows={2}
                  className="field resize-none text-[12.5px]"
                  placeholder="Add a comment…"
                />
                <button
                  type="button"
                  onClick={postComment}
                  disabled={!newComment.trim() || posting}
                  className="btn btn-outline h-9 w-9 p-0 shrink-0"
                  title="Comment (⌘↵)"
                >
                  {posting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
              </div>
            </div>
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

/** Minimal inline renderer for **bold** (used by system phase-change notes and agent write-ups). */
function renderBody(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  );
}

function fmtTime(iso: string): string {
  try { return format(new Date(iso), 'MMM d, HH:mm'); } catch { return ''; }
}

function CommentRow({ comment }: { comment: IssueComment }) {
  const when = fmtTime(comment.created_at);

  if (comment.is_system) {
    return (
      <li className="flex items-center gap-2 text-[11.5px] text-ink-subtle">
        <span className="h-1 w-1 rounded-full shrink-0" style={{ backgroundColor: 'var(--border-strong)' }} />
        <span className="whitespace-pre-wrap">{renderBody(comment.body)}</span>
        {when && <span className="opacity-70">· {when}</span>}
      </li>
    );
  }

  const isKnownAgent = /claude|codex|openai|gpt/i.test(comment.author ?? '');
  const { name, Logo } = agentIdentity(comment.author);
  const displayName = comment.author ? (isKnownAgent ? name : comment.author) : 'You';

  return (
    <li className="flex gap-2">
      <span className="mt-0.5 h-5 w-5 rounded-full bg-surface-2 border border-line flex items-center justify-center shrink-0 overflow-hidden">
        {isKnownAgent
          ? <Logo className="h-3.5 w-3.5" />
          : <span className="text-[10px] font-semibold text-ink-muted">{displayName.charAt(0).toUpperCase()}</span>}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11.5px]">
          <span className="font-medium text-ink truncate">{displayName}</span>
          {when && <span className="text-ink-subtle shrink-0">{when}</span>}
        </div>
        <p className="text-[12.5px] leading-relaxed text-ink-muted whitespace-pre-wrap break-words">{renderBody(comment.body)}</p>
      </div>
    </li>
  );
}
