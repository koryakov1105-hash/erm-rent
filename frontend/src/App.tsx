import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SidebarProvider, useSidebar } from './contexts/SidebarContext';
import Breadcrumbs from './components/Breadcrumbs';
import Header from './components/Header';
import { SidebarIcons } from './components/SidebarIcons';
import Dashboard from './pages/Dashboard';
import Properties from './pages/Properties';
import PropertyDetail from './pages/PropertyDetail';
import Units from './pages/Units';
import Tenants from './pages/Tenants';
import Leases from './pages/Leases';
import Finance from './pages/Finance';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Register from './pages/Register';
import './App.css';

function AuthScreen() {
  const location = useLocation();
  const isLogin = location.pathname === '/login';
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>🏢 ERP квадрат</h1>
        <p className="auth-subtitle">
          Система управления коммерческой недвижимостью. Зарегистрируйте первый аккаунт или войдите в существующий.
        </p>
        <div className="auth-tabs">
          <Link to="/login" className={isLogin ? 'active' : ''}>
            Вход
          </Link>
          <Link to="/register" className={!isLogin ? 'active' : ''}>
            Регистрация
          </Link>
        </div>
        {isLogin ? <Login /> : <Register />}
      </div>
    </div>
  );
}

function SidebarLink({ to, children, end = false, icon }: { to: string; children: React.ReactNode; end?: boolean; icon?: React.ReactNode }) {
  const location = useLocation();
  const { isCollapsed, isMobile, closeSidebar } = useSidebar();
  const isActive = end ? location.pathname === to : location.pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={`sidebar-link ${isActive ? 'sidebar-link-active' : ''} ${isCollapsed && !isMobile ? 'collapsed' : ''}`}
      title={isCollapsed && !isMobile ? String(children) : undefined}
      onClick={() => isMobile && closeSidebar()}
    >
      <span className="sidebar-icon">{icon}</span>
      {(!isCollapsed || isMobile) && <span className="sidebar-text">{children}</span>}
    </Link>
  );
}

function AppLayout() {
  const { isCollapsed, toggleSidebar, isMobile, isMobileOpen, closeSidebar } = useSidebar();

  useEffect(() => {
    if (isMobile && isMobileOpen) {
      document.body.classList.add('sidebar-open');
      return () => document.body.classList.remove('sidebar-open');
    }
  }, [isMobile, isMobileOpen]);

  return (
    <div className={`app app-with-sidebar ${isCollapsed && !isMobile ? 'sidebar-collapsed' : ''} ${isMobile ? 'sidebar-mobile' : ''}`}>
      {isMobile && isMobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={closeSidebar}
          onKeyDown={(e) => e.key === 'Escape' && closeSidebar()}
          aria-hidden="true"
          role="presentation"
        />
      )}
      <aside className={`sidebar ${isCollapsed && !isMobile ? 'collapsed' : ''} ${isMobileOpen ? 'sidebar-mobile-open' : ''}`}>
        <div className="sidebar-header">
          <Link to="/" className="sidebar-brand">
            <span className="sidebar-brand-icon">🏢</span>
            {!isCollapsed && <span className="sidebar-brand-text">ERP квадрат</span>}
          </Link>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={isMobile ? closeSidebar : toggleSidebar}
            title={isMobile ? 'Закрыть меню' : isCollapsed ? 'Развернуть панель' : 'Свернуть панель'}
            aria-label={isMobile ? 'Закрыть меню' : isCollapsed ? 'Развернуть панель' : 'Свернуть панель'}
          >
            {isMobile ? '✕' : isCollapsed ? SidebarIcons.expand : SidebarIcons.collapse}
          </button>
        </div>
        <nav className="sidebar-nav">
          <SidebarLink to="/" end icon={SidebarIcons.dashboard}>Главная</SidebarLink>
          {(!isCollapsed || isMobile) && (
            <div className="sidebar-group">
              <div className="sidebar-group-title">Недвижимость</div>
            </div>
          )}
          <SidebarLink to="/properties" icon={SidebarIcons.properties}>Объекты</SidebarLink>
          <SidebarLink to="/units" icon={SidebarIcons.units}>Юниты</SidebarLink>
          {(!isCollapsed || isMobile) && (
            <div className="sidebar-group">
              <div className="sidebar-group-title">Аренда</div>
            </div>
          )}
          <SidebarLink to="/tenants" icon={SidebarIcons.tenants}>Арендаторы</SidebarLink>
          <SidebarLink to="/leases" icon={SidebarIcons.leases}>Договоры</SidebarLink>
          {(!isCollapsed || isMobile) && (
            <div className="sidebar-group">
              <div className="sidebar-group-title">Деньги</div>
            </div>
          )}
          <SidebarLink to="/finance" icon={SidebarIcons.finance}>Финансы и платежи</SidebarLink>
        </nav>
        <div className="sidebar-footer">
          <SidebarLink to="/profile" icon={SidebarIcons.profile}>Профиль пользователя</SidebarLink>
        </div>
      </aside>

      <div className="app-main-wrapper">
        <Header />
        <main className="main-content">
          <Breadcrumbs />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/properties" element={<Properties />} />
            <Route path="/properties/:id" element={<PropertyDetail />} />
            <Route path="/units" element={<Units />} />
            <Route path="/tenants" element={<Tenants />} />
            <Route path="/leases" element={<Leases />} />
            <Route path="/payments" element={<Navigate to="/finance" replace />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Navigate to="/profile" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p>Загрузка…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<AuthScreen />} />
        <Route path="/register" element={<AuthScreen />} />
        <Route path="*" element={<Navigate to="/register" replace />} />
      </Routes>
    );
  }

  return <AppLayout />;
}

function App() {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<AuthScreen />} />
              <Route path="/register" element={<AuthScreen />} />
              <Route path="*" element={<AppRoutes />} />
            </Routes>
          </AuthProvider>
        </Router>
      </SidebarProvider>
    </ThemeProvider>
  );
}

export default App;
