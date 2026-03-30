import { useEffect, useState } from 'react';
import { budgetsApi, ledgerAccountsApi, Budget, BudgetLine, LedgerAccount } from '../services/api';

export default function Budgets() {
  const [list, setList] = useState<Budget[]>([]);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<(Budget & { lines: BudgetLine[] }) | null>(null);
  const [comparison, setComparison] = useState<{ budget: Budget; lines: BudgetLine[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [lineDrafts, setLineDrafts] = useState<{ ledger_account_id: string; property_id: string; amount_plan: string }[]>([
    { ledger_account_id: '', property_id: '', amount_plan: '' },
  ]);

  const loadList = async () => {
    const res = await budgetsApi.getAll();
    setList(Array.isArray(res.data) ? res.data : []);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [bRes, aRes] = await Promise.all([budgetsApi.getAll(), ledgerAccountsApi.getAll()]);
        setList(Array.isArray(bRes.data) ? bRes.data : []);
        setAccounts(Array.isArray(aRes.data) ? aRes.data : []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (selected == null) {
      setDetail(null);
      setComparison(null);
      return;
    }
    (async () => {
      try {
        const [d, c] = await Promise.all([budgetsApi.getById(selected), budgetsApi.vsActual(selected)]);
        setDetail(d.data);
        setComparison(c.data);
        const lines = Array.isArray(d.data.lines) ? d.data.lines : [];
        if (lines.length) {
          setLineDrafts(
            lines.map((l) => ({
              ledger_account_id: l.ledger_account_id != null ? String(l.ledger_account_id) : '',
              property_id: l.property_id != null ? String(l.property_id) : '',
              amount_plan: String(l.amount_plan ?? ''),
            }))
          );
        } else {
          setLineDrafts([{ ledger_account_id: '', property_id: '', amount_plan: '' }]);
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [selected]);

  const createBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !periodStart || !periodEnd) return;
    const res = await budgetsApi.create({ name: name.trim(), period_start: periodStart, period_end: periodEnd });
    setName('');
    await loadList();
    setSelected(res.data.id);
  };

  const saveLines = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selected == null) return;
    const lines = lineDrafts
      .filter((l) => l.amount_plan && String(l.amount_plan).trim() !== '')
      .map((l) => ({
        ledger_account_id: l.ledger_account_id ? parseInt(l.ledger_account_id, 10) : null,
        property_id: l.property_id ? parseInt(l.property_id, 10) : null,
        amount_plan: parseFloat(String(l.amount_plan).replace(',', '.')) || 0,
      }));
    await budgetsApi.putLines(selected, lines);
    const [d, c] = await Promise.all([budgetsApi.getById(selected), budgetsApi.vsActual(selected)]);
    setDetail(d.data);
    setComparison(c.data);
  };

  const removeBudget = async () => {
    if (selected == null || !confirm('Удалить бюджет?')) return;
    await budgetsApi.delete(selected);
    setSelected(null);
    await loadList();
  };

  if (loading) return <div className="card">Загрузка…</div>;

  return (
    <div>
      <div className="card">
        <h1 className="card-title">Бюджеты</h1>
        <p className="text-secondary" style={{ marginBottom: '1rem' }}>
          План по статьям учёта за период и сравнение с фактом (факт — проводки без признака «план»).
        </p>
        <form onSubmit={createBudget} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
          <div>
            <label className="form-label">Название</label>
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="form-label">Начало</label>
            <input type="date" className="form-input" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required />
          </div>
          <div>
            <label className="form-label">Конец</label>
            <input type="date" className="form-input" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary">Создать</button>
        </form>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 220 }}>
            <label className="form-label">Выберите бюджет</label>
            <select className="form-input" value={selected ?? ''} onChange={(e) => setSelected(e.target.value ? parseInt(e.target.value, 10) : null)}>
              <option value="">—</option>
              {list.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.period_start} — {b.period_end})
                </option>
              ))}
            </select>
          </div>
          {selected != null && (
            <button type="button" className="btn" onClick={removeBudget} style={{ alignSelf: 'flex-end' }}>
              Удалить бюджет
            </button>
          )}
        </div>
      </div>

      {selected != null && detail && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h2 className="card-title">Строки бюджета</h2>
          <form onSubmit={saveLines}>
            <table className="table">
              <thead>
                <tr>
                  <th>Счёт (статья)</th>
                  <th>Объект (ID, опц.)</th>
                  <th>План, ₽</th>
                </tr>
              </thead>
              <tbody>
                {lineDrafts.map((row, i) => (
                  <tr key={i}>
                    <td>
                      <select
                        className="form-input"
                        value={row.ledger_account_id}
                        onChange={(e) => {
                          const next = [...lineDrafts];
                          next[i].ledger_account_id = e.target.value;
                          setLineDrafts(next);
                        }}
                      >
                        <option value="">—</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} {a.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="form-input"
                        value={row.property_id}
                        onChange={(e) => {
                          const next = [...lineDrafts];
                          next[i].property_id = e.target.value;
                          setLineDrafts(next);
                        }}
                        placeholder="ID объекта"
                      />
                    </td>
                    <td>
                      <input
                        className="form-input"
                        value={row.amount_plan}
                        onChange={(e) => {
                          const next = [...lineDrafts];
                          next[i].amount_plan = e.target.value;
                          setLineDrafts(next);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="btn-group" style={{ marginTop: '0.75rem' }}>
              <button type="button" className="btn" onClick={() => setLineDrafts([...lineDrafts, { ledger_account_id: '', property_id: '', amount_plan: '' }])}>
                Добавить строку
              </button>
              <button type="submit" className="btn btn-primary">Сохранить строки</button>
            </div>
          </form>
        </div>
      )}

      {comparison && comparison.lines.length > 0 && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h2 className="card-title">План vs факт</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Счёт</th>
                <th>Объект</th>
                <th>План</th>
                <th>Факт</th>
                <th>Отклонение</th>
              </tr>
            </thead>
            <tbody>
              {comparison.lines.map((l) => (
                <tr key={l.id}>
                  <td>{l.ledger_account_id ?? '—'}</td>
                  <td>{l.property_id ?? '—'}</td>
                  <td>{(l.amount_plan ?? 0).toLocaleString('ru-RU')}</td>
                  <td>{(l.amount_actual ?? 0).toLocaleString('ru-RU')}</td>
                  <td>
                    {(l.variance ?? 0).toLocaleString('ru-RU')}
                    {l.variance_pct != null ? ` (${l.variance_pct}%)` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
