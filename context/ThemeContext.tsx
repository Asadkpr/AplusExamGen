import React, { createContext, useContext, useEffect } from 'react';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Always use the unified light/warm-bronze theme across the app
  useEffect(() => {
    document.documentElement.classList.add('light-theme');
    document.body.classList.add('light-theme');
    localStorage.setItem('aplus_theme', 'light');
  }, []);

  const toggleTheme = () => {
    // Theme switching disabled; app uses the unified light & warm-bronze theme
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode: false, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};