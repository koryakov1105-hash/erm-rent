import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { bankAccountsApi, bankStatementsApi, BankAccount } from '../services/api';

function BankStatementImport() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: '', account_number: '', comment: '' });
  const [savingAccount, setSavingAccount] = useState(false);

  const loadAccounts = async () => {
    try {
      const res = await bankAccountsApi.getAll();
      setAccounts(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.name.trim() || !newAccount.account_number.trim()) {
      setError('Укажите название и номер счёта');
      return;
    }
    setSavingAccount(true);
    setError(null);
    try {
      await bankAccountsApi.create({
        name: newAccount.name.trim(),
        account_number: newAccount.account_number.trim(),
        comment: newAccount.comment.trim() || undefined,
      });
      await loadAccounts();
      setShowAddAccount(false);
      setNewAccount({ name: '', account_number: '', comment: '' });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось добавить счёт');
    } finally {
      setSavingAccount(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    setError(null);
    setSuccessCount(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId || !file) {
      setError(selectedAccountId ? 'Выберите файл выписки (.xml или .xlsx)' : 'Выберите банковский счёт');
      return;
    }
    setUploading(true);
    setError(null);
    setSuccessCount(null);
    try {
      const res = await bankStatementsApi.upload(file, parseInt(selectedAccountId, 10));
      setSuccessCount(res.data?.created ?? 0);
      setFile(null);
      const input = document.getElementById('statement-file') as HTMLInputElement;
      if (input) input.value = '';
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.details || 'Ошибка загрузки выписки';
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <p>Загрузка…</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h1 className="card-title">Импорт выписки из банка</h1>
        <Link to="/finance" className="btn btn-secondary">
          Назад к финансам
        </Link>
      </div>

      <p className="muted" style={{ marginBottom: '1rem' }}>
        Загрузите файл выписки в формате XML или Excel (.xlsx, .xls). Обязательно укажите банковский счёт — все операции будут привязаны к нему.
      </p>

      {accounts.length === 0 && !showAddAccount && (
        <div className="card" style={{ marginBottom: '1rem', background: 'var(--color-surface-alt)' }}>
          <p>Сначала добавьте банковский счёт.</p>
          <button type="button" className="btn btn-primary" onClick={() => setShowAddAccount(true)}>
            Добавить банковский счёт
          </button>
        </div>
      )}

      {showAddAccount && (
        <div className="card" style={{ marginBottom: '1rem', background: 'var(--color-surface-alt)' }}>
          <h2 style={{ marginTop: 0 }}>Новый банковский счёт</h2>
          <form onSubmit={handleAddAccount}>
            <div className="form-group">
              <label htmlFor="ba-name">Название</label>
              <input
                id="ba-name"
                type="text"
                className="form-input"
                value={newAccount.name}
                onChange={(e) => setNewAccount((a) => ({ ...a, name: e.target.value }))}
                placeholder="Например: Расчётный счёт ООО"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="ba-number">Номер счёта</label>
              <input
                id="ba-number"
                type="text"
                className="form-input"
                value={newAccount.account_number}
                onChange={(e) => setNewAccount((a) => ({ ...a, account_number: e.target.value }))}
                placeholder="20 цифр"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="ba-comment">Комментарий (необязательно)</label>
              <input
                id="ba-comment"
                type="text"
                className="form-input"
                value={newAccount.comment}
                onChange={(e) => setNewAccount((a) => ({ ...a, comment: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={savingAccount}>
                {savingAccount ? 'Сохранение…' : 'Сохранить'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setShowAddAccount(false); setError(null); }}
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {accounts.length > 0 && (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="bank-account">Банковский счёт *</label>
            <select
              id="bank-account"
              className="form-input"
              value={selectedAccountId}
              onChange={(e) => { setSelectedAccountId(e.target.value); setError(null); }}
              required
            >
              <option value="">— Выберите счёт —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {a.account_number}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="statement-file">Файл выписки (.xml, .xlsx, .xls)</label>
            <input
              id="statement-file"
              name="statement"
              type="file"
              accept=".xml,.xlsx,.xls"
              onChange={handleFileChange}
              className="form-input"
            />
            {file && <p className="muted" style={{ marginTop: '0.25rem' }}>Выбран: {file.name}</p>}
          </div>
          {error && <p style={{ color: 'var(--color-error)', marginBottom: '0.5rem' }}>{error}</p>}
          {successCount !== null && (
            <p style={{ color: 'var(--color-success)', marginBottom: '0.5rem' }}>
              Импортировано транзакций: {successCount}.{' '}
              <Link to="/finance">Перейти к списку транзакций</Link>
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button type="submit" className="btn btn-primary" disabled={uploading || !file}>
              {uploading ? 'Загрузка…' : 'Импортировать'}
            </button>
            {accounts.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAddAccount(true)}
              >
                Добавить счёт
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

export default BankStatementImport;
