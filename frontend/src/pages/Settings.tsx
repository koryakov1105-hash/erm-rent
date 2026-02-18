import { useAuth } from '../contexts/AuthContext';

function Settings() {
  const { user } = useAuth();

  return (
    <div>
      <div className="card">
        <h1 className="card-title">Настройки</h1>
        <p style={{ color: '#666', marginBottom: '1rem' }}>
          Профиль и параметры системы.
        </p>
        <div className="card" style={{ padding: '1rem', background: '#f9f9f9' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Текущий пользователь</h2>
          <p style={{ margin: 0 }}><strong>Имя:</strong> {user?.name || '—'}</p>
          <p style={{ margin: '0.25rem 0 0' }}><strong>Email:</strong> {user?.email || '—'}</p>
        </div>
      </div>
    </div>
  );
}

export default Settings;
