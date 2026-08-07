import React from 'react';
import { FiSun, FiMoon } from 'react-icons/fi';
import { useTheme } from '../../context/ThemeContext';
import '../../styles/themeToggle.css';

const ThemeToggle = ({ showLabel = false, className = '' }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className={`theme-toggle-btn ${isDark ? 'is-dark' : 'is-light'} ${className}`}
      onClick={toggleTheme}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={`Current theme: ${theme}. Click to switch theme.`}
    >
      <div className="theme-toggle-track">
        {/* Track icons underneath */}
        <span className="track-icon track-sun" aria-hidden="true">
          <FiSun />
        </span>
        <span className="track-icon track-moon" aria-hidden="true">
          <FiMoon />
        </span>

        {/* Sliding Thumb Knob */}
        <div className="theme-toggle-knob">
          <span className="knob-icon-wrapper">
            {isDark ? (
              <FiMoon className="active-icon moon-icon" />
            ) : (
              <FiSun className="active-icon sun-icon" />
            )}
          </span>
        </div>
      </div>

      {showLabel && (
        <span className="theme-toggle-label">
          {isDark ? 'Dark Mode' : 'Light Mode'}
        </span>
      )}
    </button>
  );
};

export default ThemeToggle;
