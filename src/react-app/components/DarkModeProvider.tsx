import { ReactNode } from 'react';
import { DarkModeContext, useDarkModeState } from '@/react-app/hooks/useDarkMode';

interface DarkModeProviderProps {
  children: ReactNode;
}

export function DarkModeProvider({ children }: DarkModeProviderProps) {
  const darkModeState = useDarkModeState();

  return (
    <DarkModeContext.Provider value={darkModeState}>
      {children}
    </DarkModeContext.Provider>
  );
}
