import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeName = 'pine' | 'cherry' | 'orange' | 'milky';

export interface Theme {
  name: ThemeName;
  displayName: string;
  primary: string;
  secondary: string;
  primaryDark: string;
  secondaryLight: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  border: string;
  shadow: string;
}

const themes: Record<ThemeName, Theme> = {
  pine: {
    name: 'pine',
    displayName: 'Pine & Milk',
    primary: '#00311F', // PINE - темно-зеленый
    secondary: '#F5F5F0', // MILK - молочный
    primaryDark: '#001A0F',
    secondaryLight: '#FFFFFF',
    background: '#F7F7F2', // молочный фон
    surface: '#FFFFFF',
    text: '#1A1A1A',
    textSecondary: '#666666',
    accent: '#00311F', // акцент — сосна, без оранжевого
    success: '#27AE60',
    warning: '#F39C12',
    error: '#E74C3C',
    border: '#E8E6E1',
    shadow: 'rgba(0, 49, 31, 0.08)',
  },
  cherry: {
    name: 'cherry',
    displayName: 'Cherry Cola & Cream Vanilla',
    primary: '#9A0002', // CHERRY COLA - темно-красный
    secondary: '#EFE6DE', // CREAM VANILLA - кремовый
    primaryDark: '#6B0001',
    secondaryLight: '#F5EDE5',
    background: '#F5F5F5',
    surface: '#FFFFFF',
    text: '#1A1A1A',
    textSecondary: '#666666',
    accent: '#9A0002',
    success: '#27AE60',
    warning: '#F39C12',
    error: '#C62828',
    border: '#E0E0E0',
    shadow: 'rgba(154, 0, 2, 0.1)',
  },
  orange: {
    name: 'orange',
    displayName: 'Orange & Graphite',
    primary: '#FD802E', // ORANGE - оранжевый
    secondary: '#403D39', // GRAPHITE - графитовый
    primaryDark: '#E66A1A',
    secondaryLight: '#5A5752',
    background: '#FAFAFA',
    surface: '#FFFFFF',
    text: '#1A1A1A',
    textSecondary: '#666666',
    accent: '#FD802E',
    success: '#27AE60',
    warning: '#F39C12',
    error: '#E74C3C',
    border: '#E0E0E0',
    shadow: 'rgba(253, 128, 46, 0.1)',
  },
  milky: {
    name: 'milky',
    displayName: 'Milky & Black',
    primary: '#1A1A1A', // BLACK - черный
    secondary: '#F5F5F0', // MILKY - молочный
    primaryDark: '#000000',
    secondaryLight: '#FFFFFF',
    background: '#F5F5F0', // Молочный фон
    surface: '#FFFFFF', // Белая поверхность
    text: '#1A1A1A', // Черный текст
    textSecondary: '#666666',
    accent: '#1A1A1A', // Черный акцент
    success: '#27AE60',
    warning: '#F39C12',
    error: '#E74C3C',
    border: '#E0E0E0',
    shadow: 'rgba(26, 26, 26, 0.1)',
  },
};

interface ThemeContextType {
  theme: Theme;
  themeName: ThemeName;
  setTheme: (theme: ThemeName) => void;
  themes: Record<ThemeName, Theme>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeNameState] = useState<ThemeName>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as ThemeName) || 'pine';
  });

  const setTheme = (name: ThemeName) => {
    setThemeNameState(name);
    localStorage.setItem('theme', name);
    applyTheme(themes[name]);
  };

  const hexToRgb = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : '0, 0, 0';
  };

  const applyTheme = (theme: Theme) => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme.name);
    root.style.setProperty('--color-primary', theme.primary);
    root.style.setProperty('--color-primary-dark', theme.primaryDark);
    root.style.setProperty('--color-secondary', theme.secondary);
    root.style.setProperty('--color-secondary-light', theme.secondaryLight);
    root.style.setProperty('--color-background', theme.background);
    root.style.setProperty('--color-surface', theme.surface);
    root.style.setProperty('--color-text', theme.text);
    root.style.setProperty('--color-text-secondary', theme.textSecondary);
    root.style.setProperty('--color-accent', theme.accent);
    root.style.setProperty('--color-success', theme.success);
    root.style.setProperty('--color-warning', theme.warning);
    root.style.setProperty('--color-error', theme.error);
    root.style.setProperty('--color-border', theme.border);
    root.style.setProperty('--color-shadow', theme.shadow);
    root.style.setProperty('--color-accent-rgb', hexToRgb(theme.accent));
    root.style.setProperty('--color-primary-rgb', hexToRgb(theme.primary));
    root.style.setProperty('--color-success-rgb', hexToRgb(theme.success));
    root.style.setProperty('--color-error-rgb', hexToRgb(theme.error));
    root.style.setProperty('--color-warning-rgb', hexToRgb(theme.warning));
  };

  useEffect(() => {
    applyTheme(themes[themeName]);
  }, [themeName]);

  return (
    <ThemeContext.Provider value={{ theme: themes[themeName], themeName, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
