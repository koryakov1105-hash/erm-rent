import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSidebar } from '../contexts/SidebarContext';

export default function Header() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { isMobile, openSidebar } = useSidebar();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Доброе утро';
    if (hour < 18) return 'Добрый день';
    return 'Добрый вечер';
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <header className="app-header">
      <div className="header-content">
        {isMobile && (
          <button
            type="button"
            className="header-menu-btn"
            onClick={openSidebar}
            aria-label="Открыть меню"
            title="Меню"
          >
            <span className="header-menu-icon" aria-hidden>☰</span>
          </button>
        )}
        <div className="header-left">
          <div className="header-greeting">
            <span className="greeting-text">{getGreeting()}, {user?.name || 'Пользователь'}</span>
            <span className="greeting-icon">✨</span>
          </div>
          <p className="header-subtitle">Следите за задачами, контролируйте прогресс и отслеживайте статусы</p>
        </div>
        
        <div className="header-right">
          <div className="header-actions">
            <button className="header-icon-btn" title="Поиск">
              🔍
            </button>
            
            <button className="header-icon-btn notification-btn" title="Уведомления">
              🔔
              <span className="notification-badge">3</span>
            </button>
          </div>

          <Link to="/profile" className="header-profile">
            <div className="profile-avatar" style={{ backgroundColor: theme.accent }}>
              {getInitials(user?.name, user?.email)}
            </div>
            <div className="profile-info">
              <div className="profile-name">{user?.name || 'Пользователь'}</div>
              <div className="profile-email">{user?.email}</div>
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}
