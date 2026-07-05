import { useEffect, useState } from 'react';
import { X, Copy, Check, Link2, Share2 } from 'lucide-react';

interface ShareBoardModalProps {
  url: string;
  title?: string;
  isOpen: boolean;
  onClose: () => void;
}

const enc = encodeURIComponent;

/** Brand glyphs (inline so we ship no icon dependency). */
const Glyph = {
  x: <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.58-6.63 7.58H.49l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93Zm-1.29 19.5h2.04L6.48 3.24H4.29L17.61 20.65Z" />,
  facebook: <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.03 4.39 11.03 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z" />,
  linkedin: <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14Zm1.78 13.02H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z" />,
  whatsapp: <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35ZM12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.75.98 1-3.66-.24-.38a9.86 9.86 0 0 1-1.51-5.26C1.9 6.85 6.4 2.35 11.9 2.35c2.65 0 5.15 1.03 7.02 2.9a9.82 9.82 0 0 1 2.9 7.01c0 5.5-4.5 10-9.77 10ZM20.6 3.15A11.75 11.75 0 0 0 11.9 0C5.36 0 .04 5.32.04 11.86c0 2.09.55 4.13 1.6 5.93L0 24l6.34-1.66a11.9 11.9 0 0 0 5.56 1.42h.01c6.55 0 11.87-5.32 11.87-11.86 0-3.17-1.24-6.15-3.49-8.4Z" />,
  telegram: <path d="M23.91 3.79 20.3 20.84c-.25 1.21-.98 1.5-1.99.93l-5.5-4.05-2.65 2.55c-.3.3-.55.55-1.12.55l.4-5.65 10.3-9.31c.45-.4-.1-.62-.69-.22L6.44 13.05.9 11.3c-1.2-.38-1.23-1.2.26-1.78l21.63-8.34c1-.36 1.87.24 1.54 1.61Z" />,
  reddit: <path d="M24 11.78a2.34 2.34 0 0 0-2.34-2.33c-.62 0-1.18.24-1.6.63a11.5 11.5 0 0 0-6.19-1.95l1.05-4.94 3.44.73a1.67 1.67 0 1 0 .18-.87l-3.85-.82a.42.42 0 0 0-.5.32l-1.17 5.5a11.5 11.5 0 0 0-6.28 1.95 2.33 2.33 0 1 0-2.56 3.79 4.6 4.6 0 0 0-.06.72c0 3.66 4.26 6.63 9.52 6.63s9.53-2.97 9.53-6.63a4.6 4.6 0 0 0-.06-.71A2.33 2.33 0 0 0 24 11.78ZM6 13.44a1.67 1.67 0 1 1 3.34 0 1.67 1.67 0 0 1-3.34 0Zm9.34 4.42c-1.14 1.15-3.32 1.23-3.96 1.23-.64 0-2.82-.08-3.96-1.23a.43.43 0 0 1 .61-.61c.72.72 2.26.98 3.35.98s2.63-.26 3.35-.98a.43.43 0 1 1 .61.61Zm-.29-2.75a1.67 1.67 0 1 1 0-3.34 1.67 1.67 0 0 1 0 3.34Z" />,
  instagram: <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16ZM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.12 1.38A5.86 5.86 0 0 0 .63 4.14c-.3.76-.5 1.64-.56 2.9C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.79.72 1.46 1.38 2.12.66.66 1.33 1.08 2.12 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.86 5.86 0 0 0 2.12-1.38 5.86 5.86 0 0 0 1.38-2.12c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.86 5.86 0 0 0-1.38-2.12A5.86 5.86 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0Zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.4-10.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88Z" />,
};

const NETWORKS: { key: keyof typeof Glyph; label: string; color: string; href: (u: string, t: string) => string | null }[] = [
  { key: 'x', label: 'X', color: '#000000', href: (u, t) => `https://twitter.com/intent/tweet?url=${enc(u)}&text=${enc(t)}` },
  { key: 'facebook', label: 'Facebook', color: '#1877F2', href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${enc(u)}` },
  { key: 'whatsapp', label: 'WhatsApp', color: '#25D366', href: (u, t) => `https://wa.me/?text=${enc(t + ' ' + u)}` },
  { key: 'linkedin', label: 'LinkedIn', color: '#0A66C2', href: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${enc(u)}` },
  { key: 'telegram', label: 'Telegram', color: '#26A5E4', href: (u, t) => `https://t.me/share/url?url=${enc(u)}&text=${enc(t)}` },
  { key: 'reddit', label: 'Reddit', color: '#FF4500', href: (u, t) => `https://www.reddit.com/submit?url=${enc(u)}&title=${enc(t)}` },
  { key: 'instagram', label: 'Instagram', color: '#E4405F', href: () => null }, // no web share intent → copies link
];

export default function ShareBoardModal({ url, title = 'Check out our roadmap', isOpen, onClose }: ShareBoardModalProps) {
  const [copied, setCopied] = useState(false);
  const [igHint, setIgHint] = useState(false);

  useEffect(() => { if (isOpen) { setCopied(false); setIgHint(false); } }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const copy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const nativeShare = async () => {
    if (navigator.share) { try { await navigator.share({ title, url }); } catch { /* cancelled */ } }
    else copy();
  };

  const openNetwork = (n: typeof NETWORKS[number]) => {
    const href = n.href(url, title);
    if (!href) { navigator.clipboard.writeText(url); setIgHint(true); setTimeout(() => setIgHint(false), 3200); return; }
    window.open(href, '_blank', 'noopener,noreferrer,width=600,height=560');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'var(--overlay)' }} onMouseDown={onClose}>
      <div className="card w-full max-w-md shadow-pop" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
          <h2 className="text-[14px] font-semibold text-ink flex items-center gap-2"><Share2 size={16} /> Share this board</h2>
          <button onClick={onClose} className="btn btn-ghost h-7 w-7 p-0 text-ink-subtle"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-[12.5px] text-ink-muted">Anyone with this link can view the board. Share it anywhere:</p>

          {/* URL + copy */}
          <div className="flex items-stretch gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0 field cursor-default">
              <Link2 size={15} className="text-ink-subtle shrink-0" />
              <span className="truncate text-[12.5px] text-ink">{url}</span>
            </div>
            <button onClick={copy} className="btn btn-primary h-auto px-3.5 shrink-0">
              {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}
            </button>
          </div>

          {/* Social buttons */}
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-subtle">Share to</p>
            <div className="flex flex-wrap gap-2.5">
              {NETWORKS.map((n) => (
                <button
                  key={n.key}
                  onClick={() => openNetwork(n)}
                  title={n.key === 'instagram' ? 'Copy link for Instagram' : `Share to ${n.label}`}
                  className="group flex flex-col items-center gap-1 w-[52px]"
                >
                  <span className="h-11 w-11 rounded-full flex items-center justify-center transition-transform group-hover:scale-105 shadow-subtle" style={{ backgroundColor: n.color }}>
                    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="#ffffff" aria-hidden>{Glyph[n.key]}</svg>
                  </span>
                  <span className="text-[10.5px] text-ink-subtle">{n.label}</span>
                </button>
              ))}
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button onClick={nativeShare} title="More…" className="group flex flex-col items-center gap-1 w-[52px]">
                  <span className="h-11 w-11 rounded-full flex items-center justify-center bg-surface-2 border border-line transition-transform group-hover:scale-105">
                    <Share2 size={17} className="text-ink-muted" />
                  </span>
                  <span className="text-[10.5px] text-ink-subtle">More</span>
                </button>
              )}
            </div>
            {igHint && <p className="mt-2 text-[11.5px] text-success">Link copied - paste it into your Instagram story or bio.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
