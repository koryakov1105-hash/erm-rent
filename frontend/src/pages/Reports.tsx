import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  transactionsApi,
  unitsApi,
  reportsApi,
  downloadReportFile,
  Transaction,
  Unit,
  CashFlowSection,
  ProfitLossLine,
} from '../services/api';

type MonthData = { month: string; monthShort: string; income: number; expense: number; profit: number };

function Reports() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartMonths, setChartMonths] = useState(6);
  const [reportStart, setReportStart] = useState('');
  const [reportEnd, setReportEnd] = useState('');
  const [cashFlow, setCashFlow] = useState<{ sections: CashFlowSection[]; total_net_cash_flow: number } | null>(null);
  const [pl, setPl] = useState<{
    lines: ProfitLossLine[];
    net_income: number;
  } | null>(null);
  const [balance, setBalance] = useState<{ assets: { line: string; amount: number }[]; note?: string } | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

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
      setReportStart(startStr);
      setReportEnd(endStr);
      const [txRes, unitsRes, cfRes, plRes, balRes] = await Promise.all([
        transactionsApi.getAll({ start_date: startStr, end_date: endStr }),
        unitsApi.getAll(),
        reportsApi.getCashFlow({ start_date: startStr, end_date: endStr }).catch(() => ({ data: null })),
        reportsApi.getProfitLoss({ start_date: startStr, end_date: endStr }).catch(() => ({ data: null })),
        reportsApi.getBalanceSimple({ end_date: endStr }).catch(() => ({ data: null })),
      ]);
      setTransactions(Array.isArray(txRes.data) ? txRes.data : []);
      setUnits(Array.isArray(unitsRes.data) ? unitsRes.data : []);
      const cf = cfRes.data as { sections?: CashFlowSection[]; total_net_cash_flow?: number } | null;
      setCashFlow(cf && cf.sections ? { sections: cf.sections, total_net_cash_flow: cf.total_net_cash_flow ?? 0 } : null);
      const p = plRes.data as { lines?: ProfitLossLine[]; net_income?: number } | null;
      setPl(p && p.lines ? { lines: p.lines, net_income: p.net_income ?? 0 } : null);
      setBalance((balRes.data as typeof balance) || null);
    } catch (e) {
      console.error(e);
      setTransactions([]);
      setUnits([]);
      setCashFlow(null);
      setPl(null);
      setBalance(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'xlsx' | 'pdf', type: 'cash_flow' | 'profit_loss') => {
    if (!reportStart || !reportEnd) return;
    try {
      setExporting(`${type}-${format}`);
      await downloadReportFile(format, type, { start_date: reportStart, end_date: reportEnd });
    } catch (e: any) {
      alert(e?.message || 'Ошибка выгрузки');
    } finally {
      setExporting(null);
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

        {reportStart && reportEnd && (
          <section className="report-section">
            <h2 className="report-section-title">Управленческие отчёты (факт)</h2>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Период совпадает с графиком ниже: {reportStart} — {reportEnd}. Классификация по счетам учёта (раздел «Финансы» / поле счёта у проводки).
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              <button type="button" className="btn" disabled={!!exporting} onClick={() => handleExport('xlsx', 'cash_flow')}>
                {exporting === 'cash_flow-xlsx' ? '…' : 'ДДС → Excel'}
              </button>
              <button type="button" className="btn" disabled={!!exporting} onClick={() => handleExport('pdf', 'cash_flow')}>
                {exporting === 'cash_flow-pdf' ? '…' : 'ДДС → PDF'}
              </button>
              <button type="button" className="btn" disabled={!!exporting} onClick={() => handleExport('xlsx', 'profit_loss')}>
                {exporting === 'profit_loss-xlsx' ? '…' : 'ОПиУ → Excel'}
              </button>
              <button type="button" className="btn" disabled={!!exporting} onClick={() => handleExport('pdf', 'profit_loss')}>
                {exporting === 'profit_loss-pdf' ? '…' : 'ОПиУ → PDF'}
              </button>
            </div>
            {cashFlow && (
              <>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Движение денежных средств (упрощённо)</h3>
                <table className="table" style={{ marginBottom: '1.25rem' }}>
                  <thead>
                    <tr>
                      <th>Деятельность</th>
                      <th>Приток</th>
                      <th>Отток</th>
                      <th>Чистый</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashFlow.sections.map((s) => (
                      <tr key={s.activity}>
                        <td>{s.label}</td>
                        <td>{s.inflow.toLocaleString('ru-RU')}</td>
                        <td>{s.outflow.toLocaleString('ru-RU')}</td>
                        <td>{s.net.toLocaleString('ru-RU')}</td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight: 700 }}>
                      <td>Итого</td>
                      <td colSpan={2} />
                      <td>{cashFlow.total_net_cash_flow.toLocaleString('ru-RU')}</td>
                    </tr>
                  </tbody>
                </table>
              </>
            )}
            {pl && (
              <>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Прибыль и убыток (управленческий)</h3>
                <table className="table" style={{ marginBottom: '1.25rem' }}>
                  <thead>
                    <tr>
                      <th>Статья</th>
                      <th>Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pl.lines.map((l) => (
                      <tr key={l.key}>
                        <td>{l.label}</td>
                        <td>{l.amount.toLocaleString('ru-RU')}</td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight: 700 }}>
                      <td>Чистая прибыль</td>
                      <td>{pl.net_income.toLocaleString('ru-RU')}</td>
                    </tr>
                  </tbody>
                </table>
              </>
            )}
            {balance?.assets?.length ? (
              <>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Упрощённый баланс</h3>
                <table className="table">
                  <tbody>
                    {balance.assets.map((a) => (
                      <tr key={a.line}>
                        <td>{a.line}</td>
                        <td>{a.amount.toLocaleString('ru-RU')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {balance.note && <p className="text-secondary" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>{balance.note}</p>}
              </>
            ) : null}
          </section>
        )}

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
