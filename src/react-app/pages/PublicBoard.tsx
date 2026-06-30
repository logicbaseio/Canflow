import { useParams } from 'react-router';
import { useEffect, useState } from 'react';
import PublicBoardView from '@/react-app/components/PublicBoardView';
import { DarkModeProvider } from '@/react-app/components/DarkModeProvider';

export default function PublicBoardPage() {
  const { publicKey } = useParams<{ publicKey: string }>();
  const [darkModeInitialized, setDarkModeInitialized] = useState(false);

  useEffect(() => {
    // Initialize dark mode on public pages
    const initializeDarkMode = () => {
      const isDarkMode = localStorage.getItem('darkMode');
      if (isDarkMode === 'true') {
        document.documentElement.classList.add('dark');
      } else if (isDarkMode === 'false') {
        document.documentElement.classList.remove('dark');
      } else {
        // Default to system preference
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          document.documentElement.classList.add('dark');
        }
      }
      setDarkModeInitialized(true);
    };

    // Ensure DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeDarkMode);
    } else {
      initializeDarkMode();
    }

    return () => {
      document.removeEventListener('DOMContentLoaded', initializeDarkMode);
    };
  }, []);

  if (!publicKey) {
    return (
      <DarkModeProvider>
        <div className="min-h-screen bg-app text-ink flex items-center justify-center px-6">
          <div className="w-full max-w-md text-center">
            <Logo className="h-9 w-9 mx-auto mb-5" />
            <h2 className="text-[22px] font-semibold tracking-tight mb-1.5">Invalid link</h2>
            <p className="text-[13px] text-ink-muted">The public board link is invalid.</p>
          </div>
        </div>
      </DarkModeProvider>
    );
  }

  // Don't render until dark mode is initialized to prevent flash
  if (!darkModeInitialized) {
    return null;
  }

  return (
    <DarkModeProvider>
      <PublicBoardView publicKey={publicKey} />
    </DarkModeProvider>
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
