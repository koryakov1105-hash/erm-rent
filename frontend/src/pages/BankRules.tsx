import { useEffect, useState } from 'react';
import { bankMatchRulesApi, ledgerAccountsApi, BankMatchRule, LedgerAccount } from '../services/api';

export default function BankRules() {
  const [rules, setRules] = useState<BankMatchRule[]>([]);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [pattern, setPattern] = useState('');
  const [matchField, setMatchField] = useState<'description' | 'counterparty'>('description');
  const [ledgerId, setLedgerId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [priority, setPriority] = useState('0');

  const load = async () => {
    const [r, a] = await Promise.all([bankMatchRulesApi.getAll(), ledgerAccountsApi.getAll()]);
    setRules(Array.isArray(r.data) ? r.data : []);
    setAccounts(Array.isArray(a.data) ? a.data : []);
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const addRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern.trim()) return;
    await bankMatchRulesApi.create({
      pattern: pattern.trim(),
      match_field: matchField,
      ledger_account_id: ledgerId ? parseInt(ledgerId, 10) : null,
      property_id: propertyId ? parseInt(propertyId, 10) : null,
      priority: parseInt(priority, 10) || 0,
    });
    setPattern('');
    await load();
  };

  const del = async (id: number) => {
    if (!confirm('Удалить правило?')) return;
    await bankMatchRulesApi.delete(id);
    await load();
  };

  return (
    <div className="card">
      <h1 className="card-title">Правила импорта банка</h1>
      <p className="text-secondary" style={{ marginBottom: '1rem' }}>
        Подстрока в назначении или в контрагенте выписки. При совпадении к импортируемой операции подставляются счёт учёта и объект. Большее значение «Приоритет» проверяется раньше.
      </p>
      <form onSubmit={addRule} style={{ display: 'grid', gap: '0.75rem', maxWidth: 560 }}>
        <div>
          <label className="form-label">Подстрока поиска</label>
          <input className="form-input" value={pattern} onChange={(e) => setPattern(e.target.value)} required />
        </div>
        <div>
          <label className="form-label">Где искать</label>
          <select className="form-input" value={matchField} onChange={(e) => setMatchField(e.target.value as 'description' | 'counterparty')}>
            <option value="description">Назначение / объединённое описание</option>
            <option value="counterparty">Контрагент</option>
          </select>
        </div>
        <div>
          <label className="form-label">Счёт учёта</label>
          <select className="form-input" value={ledgerId} onChange={(e) => setLedgerId(e.target.value)}>
            <option value="">—</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} {a.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Объект (ID)</label>
          <input className="form-input" value={propertyId} onChange={(e) => setPropertyId(e.target.value)} />
        </div>
        <div>
          <label className="form-label">Приоритет</label>
          <input className="form-input" value={priority} onChange={(e) => setPriority(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary">Добавить правило</button>
      </form>

      <h2 className="card-title" style={{ marginTop: '2rem' }}>Активные правила</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Подстрока</th>
            <th>Поле</th>
            <th>Счёт</th>
            <th>Объект</th>
            <th>Приоритет</th>
            <th /></tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id}>
              <td>{r.pattern}</td>
              <td>{r.match_field}</td>
              <td>{r.ledger_account_id ?? '—'}</td>
              <td>{r.property_id ?? '—'}</td>
              <td>{r.priority}</td>
              <td><button type="button" className="btn" onClick={() => del(r.id)}>Удалить</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
