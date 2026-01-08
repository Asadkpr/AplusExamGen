import React, { createContext, useContext, useState, useEffect } from 'react';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    // Check local storage or default to dark
    const stored = localStorage.getItem('aplus_theme');
    if (stored === 'light') {
      setIsDarkMode(false);
      document.body.classList.add('light-theme');
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newVal = !prev;
      if (newVal) {
        document.body.classList.remove('light-theme');
        localStorage.setItem('aplus_theme', 'dark');
      } else {
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