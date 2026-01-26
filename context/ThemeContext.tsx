import React, { createContext, useContext, useState, useEffect } from 'react';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Sync theme on initial load
  useEffect(() => {
    const stored = localStorage.getItem('aplus_theme');
    if (stored === 'light') {
      setIsDarkMode(false);
      document.documentElement.classList.add('light-theme');
      document.body.classList.add('light-theme');
    } else {
      setIsDarkMode(true);
      document.documentElement.classList.remove('light-theme');
      document.body.classList.remove('light-theme');
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newVal = !prev;
      if (newVal) {
        // Switching to Dark
        document.documentElement.classList.remove('light-theme');
        document.body.classList.remove('light-theme');
        localStorage.setItem('aplus_theme', 'dark');
      } else {
        // Switching to Light
        document.documentElement.classList.add('light-theme');
        document.body.classList.add('light-theme');
        localStorage.setItem('aplus_theme', 'light');
      }
      return newVal;
    });
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
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