import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeSwitcher from '../components/ThemeSwitcher';
import { auditLogApi, AuditLogEntry } from '../services/api';

function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [auditLog, setAuditLog] = useState<AuditLogEntry[] | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'admin') {
      setAuditLog(null);
      setAuditError(null);
      return;
    }
    auditLogApi
      .getAll()
      .then((res) => setAuditLog(Array.isArray(res.data) ? res.data : []))
      .catch((e) => {
        setAuditError(e?.response?.data?.error || 'Нет доступа к журналу');
        setAuditLog(null);
      });
  }, [user?.role]);

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
            <p style={{ margin: '0.25rem 0 0' }}><strong>Роль:</strong> {user?.role || 'operator'} (admin — полный доступ; finance — утверждение заявок на оплату; operator — операции без утверждения чужих заявок)</p>
          </div>
        </section>

        {user?.role === 'admin' && (
          <section className="report-section" style={{ marginTop: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--color-text)' }}>Журнал аудита</h2>
            {auditError && <p className="text-secondary">{auditError}</p>}
            {auditLog && auditLog.length === 0 && !auditError && <p className="text-secondary">Записей пока нет.</p>}
            {auditLog && auditLog.length > 0 && (
              <div className="finance-table-wrap" style={{ maxHeight: 320, overflow: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Время</th>
                      <th>Действие</th>
                      <th>Сущность</th>
                      <th>ID</th>
                      <th>Пользователь</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.map((a) => (
                      <tr key={a.id}>
                        <td style={{ fontSize: '0.85rem' }}>{a.created_at ? new Date(a.created_at).toLocaleString('ru-RU') : '—'}</td>
                        <td>{a.action}</td>
                        <td>{a.entity_type}</td>
                        <td>{a.entity_id ?? '—'}</td>
                        <td>{a.user_id ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

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
