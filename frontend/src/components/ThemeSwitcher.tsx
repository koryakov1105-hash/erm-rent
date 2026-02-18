import { useTheme } from '../contexts/ThemeContext';

export default function ThemeSwitcher() {
  const { themeName, setTheme, themes } = useTheme();

  return (
    <div className="theme-switcher">
      <label className="theme-switcher-label">Цветовая тема:</label>
      <div className="theme-switcher-options">
        {Object.values(themes).map((t) => (
          <button
            key={t.name}
            type="button"
            className={`theme-option ${themeName === t.name ? 'active' : ''}`}
            onClick={() => setTheme(t.name)}
            title={t.displayName}
          >
            <div className="theme-option-preview">
              <div
                className="theme-option-color"
                style={{ backgroundColor: t.primary }}
              />
              <div
                className="theme-option-color"
                style={{ backgroundColor: t.secondary }}
              />
            </div>
            <span className="theme-option-name">{t.displayName}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
