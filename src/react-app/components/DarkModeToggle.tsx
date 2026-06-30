import { Moon, Sun } from 'lucide-react';
import { useDarkMode } from '@/react-app/hooks/useDarkMode';

export default function DarkModeToggle() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <button
      onClick={toggleDarkMode}
      className="btn btn-ghost h-7 w-7 p-0 text-ink-muted"
      title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
