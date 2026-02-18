import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err: any) {
      if (!err.response) {
        setError('Сервер недоступен. Запустите бэкенд (в папке backend: npm run dev).');
        return;
      }
      const data = err.response?.data;
      const msg = data?.error || 'Ошибка входа';
      const detail = data?.detail;
      setError(detail ? `${msg}: ${detail}` : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form" style={{ display: 'block', marginTop: '1rem' }}>
      {error && <div className="auth-error">{error}</div>}
      <div className="form-group" style={{ display: 'block', marginBottom: '1rem' }}>
        <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Email</label>
        <input
          type="email"
          className="form-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          style={{ display: 'block', width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '6px', fontSize: '1rem', boxSizing: 'border-box' }}
        />
      </div>
      <div className="form-group" style={{ display: 'block', marginBottom: '1rem' }}>
        <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Пароль</label>
        <input
          type="password"
          className="form-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          style={{ display: 'block', width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '6px', fontSize: '1rem', boxSizing: 'border-box' }}
        />
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={submitting} style={{ display: 'block', width: '100%', marginTop: '0.75rem', padding: '0.65rem' }}>
        {submitting ? 'Вход…' : 'Войти'}
      </button>
    </form>
  );
}

export default Login;
