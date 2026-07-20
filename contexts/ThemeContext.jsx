'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const themes = {
  green: {
    name: 'Forest Green',
    primary: '#2d6a4f',
    primaryLight: '#40916c',
    primaryLighter: '#74c69d',
    bg: '#f0fdf4',
    accent: '#f59e0b',
    className: 'theme-green',
  },
  dark: {
    name: 'Dark Mode',
    primary: '#40916c',
    primaryLight: '#52b788',
    primaryLighter: '#74c69d',
    bg: '#0a0a0a',
    accent: '#fbbf24',
    className: 'theme-dark dark',
  },
  earth: {
    name: 'Earth Tone',
    primary: '#6b4226',
    primaryLight: '#8b5e3c',
    primaryLighter: '#c4956a',
    bg: '#fef9f4',
    accent: '#4caf50',
    className: 'theme-earth',
  },
  ocean: {
    name: 'Ocean Blue',
    primary: '#0077b6',
    primaryLight: '#0096c7',
    primaryLighter: '#48cae4',
    bg: '#f0f8ff',
    accent: '#f59e0b',
    className: 'theme-ocean',
  },
};

const ThemeContext = createContext({});

export function ThemeProvider({ children, defaultTheme = 'green' }) {
  const [theme, setTheme] = useState(defaultTheme);

  useEffect(() => {
    const saved = localStorage.getItem('si-theme');
    if (saved && themes[saved]) setTheme(saved);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const t = themes[theme];
    if (!t) return;
    root.className = '';
    t.className.split(' ').forEach(c => c && root.classList.add(c));
    root.style.setProperty('--color-primary', t.primary);
    root.style.setProperty('--color-primary-light', t.primaryLight);
    root.style.setProperty('--color-primary-lighter', t.primaryLighter);
    root.style.setProperty('--color-accent', t.accent);
    localStorage.setItem('si-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes, currentTheme: themes[theme] }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
export { themes };
