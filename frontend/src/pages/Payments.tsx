import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { transactionsApi, Transaction } from '../services/api';

function Payments() {
  const [activeTab, setActiveTab] = useState<'mandatory' | 'tenant'>('mandatory');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadTransactions();
  }, [selectedMonth, selectedYear]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const response = await transactionsApi.getAll({ start_date: startDate, end_date: endDate });
      setTransactions(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error loading transactions:', error);
      alert('Ошибка загрузки платежей');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const mandatoryPayments = transactions.filter((t) => t.is_planned === 1);
  const tenantPayments = transactions.filter((t) => t.is_tenant_payment === 1);
  const list = activeTab === 'mandatory' ? mandatoryPayments : tenantPayments;

  if (loading) {
    return <div className="card">Загрузка...</div>;
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h1 className="card-title">Платежи</h1>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="form-input"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              style={{ width: '140px' }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {new Date(2000, month - 1).toLocaleString('ru-RU', { month: 'long' })}
                </option>
              ))}
            </select>
            <select
              className="form-input"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              style={{ width: '100px' }}
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <Link to="/finance" className="btn btn-primary">
              Добавить в разделе Финансы
            </Link>
          </div>
        </div>

        <p style={{ marginBottom: '1rem', color: '#666', fontSize: '0.95rem' }}>
          Здесь отображаются транзакции из раздела <Link to="/finance">Финансы</Link>: с отмеченным «Обязательный платеж» или «Платеж от арендатора».
        </p>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid #e0e0e0' }}>
          <button
            type="button"
            className={`btn ${activeTab === 'mandatory' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('mandatory')}
            style={{ borderBottom: activeTab === 'mandatory' ? '2px solid #3498db' : 'none' }}
          >
            Обязательные платежи
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'tenant' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('tenant')}
            style={{ borderBottom: activeTab === 'tenant' ? '2px solid #3498db' : 'none' }}
          >
            Платежи от арендаторов
          </button>
        </div>

        <div>
          {list.length === 0 ? (
            <p style={{ color: '#666' }}>
              {activeTab === 'mandatory'
                ? 'Нет обязательных платежей за выбранный период. Добавьте транзакцию в разделе Финансы и отметьте чекбокс «Обязательный платеж».'
                : 'Нет платежей от арендаторов за выбранный период. Добавьте транзакцию в разделе Финансы и отметьте чекбокс «Платеж от арендатора».'}
              {' '}
              <Link to="/finance">Перейти в Финансы</Link>
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Тип</th>
                  <th>Категория</th>
                  <th>Сумма</th>
                  <th>От кого / Кому</th>
                  <th>Юнит</th>
                  <th>Описание</th>
                  <th>План / Факт</th>
                </tr>
              </thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.id}>
                    <td>{new Date(t.date).toLocaleDateString('ru-RU')}</td>
                    <td>
                      <span className={t.type === 'income' ? 'status-badge status-rented' : 'status-badge status-maintenance'}>
                        {t.type === 'income' ? 'Доход' : 'Расход'}
                      </span>
                    </td>
                    <td>{t.category || '—'}</td>
                    <td style={{ fontWeight: 500, color: t.type === 'income' ? '#2e7d32' : '#c62828' }}>
                      {t.type === 'income' ? '+' : '−'} {Math.abs(t.amount).toLocaleString('ru-RU')} ₽
                    </td>
                    <td>{t.payer || '—'}</td>
                    <td>{t.unit_number || '—'}</td>
                    <td style={{ maxWidth: '220px' }}>{t.description || '—'}</td>
                    <td>
                      <span
                        className={`status-badge ${t.is_planned === 1 ? 'status-rented' : ''}`}
                        style={t.is_planned === 0 ? { background: '#e3f2fd', color: '#1565c0' } : undefined}
                      >
                        {t.is_planned === 1 ? 'План' : 'Факт'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default Payments;
