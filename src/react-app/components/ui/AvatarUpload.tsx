import { useRef, useState } from 'react';
import { Loader2, Camera, Trash2 } from 'lucide-react';
import { downscaleImage } from '@/react-app/lib/image';

interface AvatarUploadProps {
  src?: string | null;                 // current image data URL
  fallback: React.ReactNode;           // shown when no image (e.g. initial letter or icon)
  onChange: (dataUrl: string | null) => void;
  size?: number;                       // px
  shape?: 'circle' | 'square';
  label?: string;                      // e.g. "Upload a photo"
}

/** A clickable avatar/logo that lets the user pick, replace, or remove an image. Controlled by the parent. */
export default function AvatarUpload({ src, fallback, onChange, size = 64, shape = 'circle', label }: AvatarUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const radius = shape === 'circle' ? '9999px' : '12px';

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr('Please choose an image file.'); return; }
    setErr(null);
    setBusy(true);
    try {
      onChange(await downscaleImage(file));
    } catch {
      setErr('Could not process that image.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-3.5">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="group relative shrink-0 overflow-hidden border border-line bg-accent-soft flex items-center justify-center"
        style={{ width: size, height: size, borderRadius: radius }}
        title="Change image"
      >
        {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : fallback}
        <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 group-hover:opacity-100 transition-opacity">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
        </span>
      </button>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="btn btn-outline h-8 px-3 text-[12.5px]">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <><Camera size={14} /> {src ? 'Change' : (label || 'Upload')}</>}
          </button>
          {src && (
            <button type="button" onClick={() => onChange(null)} className="btn btn-ghost h-8 w-8 p-0 text-danger" title="Remove image">
              <Trash2 size={14} />
            </button>
          )}
        </div>
        {err ? <p className="text-[11.5px] text-danger">{err}</p> : <p className="text-[11px] text-ink-subtle">PNG or JPG — resized automatically.</p>}
      </div>
    </div>
  );
}
