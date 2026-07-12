import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../theme/useTheme';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className="theme-toggle-btn"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="theme-toggle-inner" aria-hidden="true">
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </span>
    </button>
  );
};

export default ThemeToggle;
