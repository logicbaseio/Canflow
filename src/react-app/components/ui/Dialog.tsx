import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

type ConfirmOpts = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};
type PromptOpts = {
  title?: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
};

type DialogState =
  | { kind: 'confirm'; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: 'prompt'; opts: PromptOpts; resolve: (v: string | null) => void }
  | null;

interface DialogApi {
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
  prompt: (opts: PromptOpts) => Promise<string | null>;
  toast: (message: string) => void;
}

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within a DialogProvider');
  return ctx;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState>(null);
  const [inputValue, setInputValue] = useState('');
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);

  const confirm = useCallback(
    (opts: ConfirmOpts) =>
      new Promise<boolean>((resolve) => setState({ kind: 'confirm', opts, resolve })),
    []
  );

  const prompt = useCallback(
    (opts: PromptOpts) =>
      new Promise<string | null>((resolve) => {
        setInputValue(opts.defaultValue ?? '');
        setState({ kind: 'prompt', opts, resolve });
      }),
    []
  );

  const toast = useCallback((message: string) => {
    const id = Date.now() + Math.floor(performance.now());
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400);
  }, []);

  const close = useCallback(
    (result: boolean | string | null) => {
      if (!state) return;
      if (state.kind === 'confirm') state.resolve(result as boolean);
      else state.resolve(result as string | null);
      setState(null);
    },
    [state]
  );

  // Keyboard: Esc cancels, Enter confirms
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(state.kind === 'confirm' ? false : null);
      } else if (e.key === 'Enter' && state.kind === 'confirm') {
        e.preventDefault();
        close(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, close]);

  return (
    <DialogContext.Provider value={{ confirm, prompt, toast }}>
      {children}

      {state && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'var(--overlay)' }}
          onMouseDown={() => close(state.kind === 'confirm' ? false : null)}
        >
          <div
            className="card w-full max-w-sm shadow-pop p-5"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {state.opts.title && (
              <h2 className="text-[14px] font-semibold text-ink mb-1.5">{state.opts.title}</h2>
            )}
            {state.kind === 'confirm' && (
              <p className="text-[13px] leading-relaxed text-ink-muted">{state.opts.message}</p>
            )}
            {state.kind === 'prompt' && (
              <>
                {state.opts.message && (
                  <p className="text-[13px] leading-relaxed text-ink-muted mb-3">{state.opts.message}</p>
                )}
                <input
                  autoFocus
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (inputValue.trim()) close(inputValue.trim());
                    }
                  }}
                  placeholder={state.opts.placeholder}
                  className="field"
                />
              </>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => close(state.kind === 'confirm' ? false : null)}
                className="btn btn-outline h-8 px-3.5"
              >
                {state.kind === 'confirm' ? state.opts.cancelText ?? 'Cancel' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  if (state.kind === 'confirm') close(true);
                  else close(inputValue.trim() ? inputValue.trim() : null);
                }}
                disabled={state.kind === 'prompt' && !inputValue.trim()}
                className={`btn h-8 px-3.5 ${
                  state.kind === 'confirm' && state.opts.danger
                    ? 'text-[var(--accent-fg)]'
                    : 'btn-primary'
                }`}
                style={
                  state.kind === 'confirm' && state.opts.danger
                    ? { background: 'var(--danger)' }
                    : undefined
                }
              >
                {state.kind === 'confirm' ? state.opts.confirmText ?? 'Confirm' : state.opts.confirmText ?? 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] flex flex-col items-center gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="rounded-lg px-3.5 py-2 text-[12.5px] font-medium shadow-pop"
              style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              {t.message}
            </div>
          ))}
        </div>
      )}
    </DialogContext.Provider>
  );
}
