import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import type { Board, BoardWithColumns } from '@/shared/types';

interface AppState {
  selectedBoardId: number | null;
  boards: Board[];
  currentBoard: BoardWithColumns | null;
  isLoading: boolean;
  error: string | null;
}

type AppAction =
  | { type: 'SET_BOARDS'; payload: Board[] }
  | { type: 'SET_CURRENT_BOARD'; payload: BoardWithColumns | null }
  | { type: 'SET_SELECTED_BOARD_ID'; payload: number | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'ADD_BOARD'; payload: Board }
  | { type: 'UPDATE_BOARD'; payload: Board }
  | { type: 'DELETE_BOARD'; payload: number };

const initialState: AppState = {
  selectedBoardId: null,
  boards: [],
  currentBoard: null,
  isLoading: false,
  error: null,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_BOARDS':
      return { ...state, boards: action.payload };
    case 'SET_CURRENT_BOARD':
      return { ...state, currentBoard: action.payload };
    case 'SET_SELECTED_BOARD_ID':
      return { ...state, selectedBoardId: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'ADD_BOARD':
      return { ...state, boards: [...state.boards, action.payload] };
    case 'UPDATE_BOARD':
      return {
        ...state,
        boards: state.boards.map(board =>
          board.id === action.payload.id ? action.payload : board
        ),
      };
    case 'DELETE_BOARD':
      return {
        ...state,
        boards: state.boards.filter(board => board.id !== action.payload),
        selectedBoardId: state.selectedBoardId === action.payload ? null : state.selectedBoardId,
        currentBoard: state.selectedBoardId === action.payload ? null : state.currentBoard,
      };
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
