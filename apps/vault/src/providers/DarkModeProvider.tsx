import { Component, createContext, useContext, JSX } from 'solid-js';
import { useDarkMode } from '../hooks/useDarkMode';

type DarkModeContextType = {
  isDarkMode: () => boolean;
  toggleDarkMode: () => void;
  setDarkMode: (value: boolean) => void;
};

const DarkModeContext = createContext<DarkModeContextType>();

export const DarkModeProvider: Component<{ children: JSX.Element }> = (props) => {
  const darkMode = useDarkMode();

  return (
    <DarkModeContext.Provider value={darkMode}>
      {props.children}
    </DarkModeContext.Provider>
  );
};

export const useDarkModeContext = () => {
  const context = useContext(DarkModeContext);
  if (!context) {
    throw new Error('useDarkModeContext must be used within DarkModeProvider');
  }
  return context;
};

