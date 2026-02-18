import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { transactionsApi, unitsApi, Transaction, Unit } from '../services/api';

type MonthData = { month: string; monthShort: string; income: number; expense: number; profit: number };

function Reports() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartMonths, setChartMonths] = useState(6);

  useEffect(() => {
    loadData();
  }, [chartMonths]);

  const loadData = async () => {
    try {
      setLoading(true);
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - chartMonths);
      const startStr = start.getFullYear() + '-' + String(start.getMonth() + 1).padStart(2, '0') + '-01';
      const endStr = end.getFullYear() + '-' + String(end.getMonth() + 1).padStart(2, '0') + '-' + String(new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate()).padStart(2, '0');
      const [txRes, unitsRes] = await Promise.all([
        transactionsApi.getAll({ start_date: startStr, end_date: endStr }),
        unitsApi.getAll(),
      ]);
      setTransactions(Array.isArray(txRes.data) ? txRes.data : []);
      setUnits(Array.isArray(unitsRes.data) ? unitsRes.data : []);
    } catch (e) {
      console.error(e);
      setTransactions([]);
      setUnits([]);
    } finally {
      setLoading(false);
    }
  };

  const monthLabels: MonthData[] = [];
  for (let i = chartMonths - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const inMonth = (t: Transaction) => {
      const dt = new Date(t.date);
      return dt >= monthStart && dt <= monthEnd;
    };
    const income = transactions.filter((t) => t.type === 'income' && inMonth(t)).reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter((t) => t.type === 'expense' && inMonth(t)).reduce((s, t) => s + t.amount, 0);
    monthLabels.push({
      month: key,
      monthShort: d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }),
      income,
      expense,
      profit: income - expense,
    });
  }

  const maxVal = Math.max(1, ...monthLabels.flatMap((m) => [m.income, m.expense]));

  const unitForecasts = units.map((u) => {
    const plannedRent = u.monthly_rent || 0;
    const unitExpenses = transactions
      .filter((t) => t.unit_id === u.id && t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    const avgExpense = chartMonths > 0 ? unitExpenses / chartMonths : 0;
    const forecastProfit = plannedRent - avgExpense;
    return {
      unit: u,
      plannedRent,
      plannedExpense: avgExpense,
      forecastProfit,
    };
  });

  if (loading) {
    return <div className="card">Загрузка…</div>;
  }

  return (
    <div className="reports-page">
      <div className="card">
        <div className="card-header">
          <h1 className="card-title">Отчёты и аналитика</h1>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Период:</label>
            <select
              className="form-input"
              value={chartMonths}
              onChange={(e) => setChartMonths(Number(e.target.value))}
              style={{ width: '120px' }}
            >
              <option value={3}>3 мес.</option>
              <option value={6}>6 мес.</option>
              <option value={12}>12 мес.</option>
            </select>
          </div>
        </div>

        <section className="report-section">
          <h2 className="report-section-title">График платежей (план/факт по месяцам)</h2>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Доходы и расходы по данным из раздела <Link to="/finance">Финансы</Link>.
          </p>
          <div className="chart-container" style={{ minHeight: '260px' }}>
            <div className="chart-bars">
              {monthLabels.map((m) => (
                <div key={m.month} className="chart-bar-group">
                  <div className="chart-bar-labels">{m.monthShort}</div>
                  <div className="chart-bar-row">
                    <div
                      className="chart-bar chart-bar-income"
                      style={{ width: `${maxVal ? (m.income / maxVal) * 100 : 0}%` }}
                      title={`Доход: ${m.income.toLocaleString('ru-RU')} ₽`}
                    />
                    <div
                      className="chart-bar chart-bar-expense"
                      style={{ width: `${maxVal ? (m.expense / maxVal) * 100 : 0}%` }}
                      title={`Расход: ${m.expense.toLocaleString('ru-RU')} ₽`}
                    />
                  </div>
                  <div className="chart-bar-legend">
                    <span className="chart-legend-income">+{m.income.toLocaleString('ru-RU')} ₽</span>
                    <span className="chart-legend-expense">−{m.expense.toLocaleString('ru-RU')} ₽</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="chart-legend-block">
              <span className="chart-legend-item"><i className="chart-legend-dot chart-bar-income" /> Доходы</span>
              <span className="chart-legend-item"><i className="chart-legend-dot chart-bar-expense" /> Расходы</span>
            </div>
          </div>
        </section>

        <section className="report-section">
          <h2 className="report-section-title">Прогноз по юнитам</h2>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Плановая арендная плата и оценка расходов по юниту (на основе учтённых транзакций за период).
          </p>
          {unitForecasts.length === 0 ? (
            <p>Нет юнитов. <Link to="/units">Добавьте юниты</Link> в разделе Юниты.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Юнит</th>
                  <th>Объект</th>
                  <th>Плановая аренда (₽/мес)</th>
                  <th>Плановые расходы (₽/мес)</th>
                  <th>Прогноз прибыли (₽/мес)</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {unitForecasts.map(({ unit, plannedRent, plannedExpense, forecastProfit }) => (
                  <tr key={unit.id}>
                    <td>{unit.unit_number}</td>
                    <td>{unit.property_name || '—'}</td>
                    <td>{plannedRent.toLocaleString('ru-RU')}</td>
                    <td>{plannedExpense.toLocaleString('ru-RU')}</td>
                    <td style={{ fontWeight: 600, color: forecastProfit >= 0 ? '#2e7d32' : '#c62828' }}>
                      {forecastProfit >= 0 ? '+' : ''}{forecastProfit.toLocaleString('ru-RU')}
                    </td>
                    <td>
                      <span className={`status-badge status-${unit.status}`}>
                        {unit.status === 'vacant' ? 'Свободен' : unit.status === 'rented' ? 'Арендован' : 'На ремонте'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

export default Reports;
