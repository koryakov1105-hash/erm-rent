import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeSwitcher from '../components/ThemeSwitcher';

function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div>
      <div className="card">
        <h1 className="card-title">Профиль пользователя</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
          Настройки аккаунта и выход из системы.
        </p>

        <section className="report-section" style={{ marginTop: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--color-text)' }}>Текущий пользователь</h2>
          <div className="card" style={{ padding: '1rem', background: 'var(--color-background)' }}>
            <p style={{ margin: 0 }}><strong>Имя:</strong> {user?.name || '—'}</p>
            <p style={{ margin: '0.25rem 0 0' }}><strong>Email:</strong> {user?.email || '—'}</p>
          </div>
        </section>

        <section className="report-section" style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--color-text)' }}>Внешний вид</h2>
          <ThemeSwitcher />
        </section>

        <section className="report-section" style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--color-text)' }}>Выход из системы</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>
            Завершить текущий сеанс и вернуться на страницу входа.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
          >
            Выйти
          </button>
        </section>
      </div>
    </div>
  );
}

export default Profile;
