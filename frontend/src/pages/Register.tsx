import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      return;
    }
    setSubmitting(true);
    try {
      await register(email.trim(), password, name.trim() || undefined);
      navigate('/', { replace: true });
    } catch (err: any) {
      if (!err.response) {
        setError('Сервер недоступен. Проверьте подключение и запустите бэкенд при необходимости.');
        return;
      }
      const data = err.response?.data;
      const msg = data?.error || err.message || 'Ошибка регистрации';
      setError(typeof msg === 'string' ? msg : 'Ошибка регистрации');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form" style={{ display: 'block', marginTop: '1rem' }}>
      {error && <div className="auth-error">{error}</div>}
      <div className="form-group" style={{ display: 'block', marginBottom: '1rem' }}>
        <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Email *</label>
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
        <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Имя (необязательно)</label>
        <input
          type="text"
          className="form-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Как к вам обращаться"
          style={{ display: 'block', width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '6px', fontSize: '1rem', boxSizing: 'border-box' }}
        />
      </div>
      <div className="form-group" style={{ display: 'block', marginBottom: '1rem' }}>
        <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Пароль * (не менее 6 символов)</label>
        <input
          type="password"
          className="form-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
          style={{ display: 'block', width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '6px', fontSize: '1rem', boxSizing: 'border-box' }}
        />
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={submitting} style={{ display: 'block', width: '100%', marginTop: '0.75rem', padding: '0.65rem' }}>
        {submitting ? 'Регистрация…' : 'Зарегистрироваться'}
      </button>
    </form>
  );
}

export default Register;
