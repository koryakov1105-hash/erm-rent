import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  transactionsApi,
  unitsApi,
  propertiesApi,
  tenantPaymentsApi,
  tenantsApi,
  leasesApi,
  Transaction,
  Unit,
  Property,
  TenantPayment,
  Tenant,
  Lease,
  CalendarResponse,
  CalendarItem,
} from '../services/api';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, UTILITY_SUBCATEGORIES } from '../constants/categories';

function Finance() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenantPayments, setTenantPayments] = useState<TenantPayment[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  const [debtFilterProperty, setDebtFilterProperty] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [filterType, setFilterType] = useState<string>('');
  const [filterPlanned, setFilterPlanned] = useState<string>('');
  const [filterPropertyId, setFilterPropertyId] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [formData, setFormData] = useState({
    unit_id: '',
    property_id: '',
    type: 'income' as 'income' | 'expense',
    category: '',
    category_detail: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    payer: '',
    is_planned: false,
    is_tenant_payment: false,
    status: 'paid' as 'invoiced' | 'paid' | 'deferred',
    scheduled_pay_date: '',
  });
  const [calendar, setCalendar] = useState<CalendarResponse | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const loadUnits = async () => {
    try {
      const res = await unitsApi.getAll();
      setUnits(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('Error loading units:', e);
    }
  };

  const loadProperties = async () => {
    try {
      const res = await propertiesApi.getAll();
      setProperties(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('Error loading properties:', e);
    }
  };

  const loadTenantPayments = async () => {
    try {
      const res = await tenantPaymentsApi.getAll();
      setTenantPayments(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      console.error('Error loading tenant payments:', e);
      setTenantPayments([]);
    }
  };

  const loadTenants = async () => {
    try {
      const res = await tenantsApi.getAll();
      setTenants(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      console.error('Error loading tenants:', e);
      setTenants([]);
    }
  };

  const loadLeases = async () => {
    try {
      const res = await leasesApi.getAll('active');
      setLeases(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      console.error('Error loading leases:', e);
      setLeases([]);
    }
  };

  const loadTransactions = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params: any = {};
      if (filterType) params.type = filterType;
      if (filterPlanned === 'plan') params.is_planned = true;
      if (filterPlanned === 'actual') params.is_planned = false;
      if (filterPropertyId) params.property_id = parseInt(filterPropertyId);
      if (filterStartDate) params.start_date = filterStartDate;
      if (filterEndDate) params.end_date = filterEndDate;
      const res = await transactionsApi.getAll(params);
      setTransactions(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error loading transactions:', error);
      if (!silent) alert('Ошибка загрузки транзакций');
      setTransactions([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadUnits();
    loadProperties();
    loadTenantPayments();
    loadTenants();
    loadLeases();
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [filterType, filterPlanned, filterPropertyId, filterStartDate, filterEndDate]);

  const loadCalendar = async () => {
    const match = String(calendarMonth || '').match(/^(\d{4})-(\d{1,2})$/);
    const y = match ? parseInt(match[1], 10) : new Date().getFullYear();
    const m = match ? parseInt(match[2], 10) : new Date().getMonth() + 1;
    if (!m || m < 1 || m > 12) return;
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    try {
      const res = await transactionsApi.getCalendar({ start_date: startStr, end_date: endStr });
      setCalendar(res.data);
      return;
    } catch {
      // Fallback: эндпоинт /calendar может отсутствовать (404) — собираем календарь из списка транзакций
    }

    try {
      const res = await transactionsApi.getAll({ start_date: startStr, end_date: endStr });
      const list = Array.isArray(res.data) ? res.data : [];
      const byDate: Record<string, CalendarItem[]> = {};
      const add = (dateStr: string, t: Transaction, calendarType: 'planned_income' | 'planned_expense' | 'deferred') => {
        const d = dateStr ? (dateStr.includes('T') ? dateStr.split('T')[0] : dateStr) : '';
        if (!d || d < startStr || d > endStr) return;
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push({
          ...t,
          calendar_type: calendarType,
          display_date: d,
        });
      };
      list.forEach((t) => {
        if (t.is_planned === 1) add(t.date, t, t.type === 'income' ? 'planned_income' : 'planned_expense');
        if (String(t.status) === 'deferred' && t.scheduled_pay_date) add(t.scheduled_pay_date, t, 'deferred');
      });
      setCalendar({ by_date: byDate, dates: Object.keys(byDate).sort() });
    } catch (e) {
      console.error('Error loading calendar:', e);
      setCalendar({ by_date: {}, dates: [] });
    }
  };

  useEffect(() => {
    loadCalendar();
  }, [calendarMonth]);

  const handleOpenModal = (transaction?: Transaction) => {
    if (transaction) {
      setEditingTransaction(transaction);
      const dateStr = transaction.date ? (transaction.date.includes('T') ? transaction.date.split('T')[0] : transaction.date) : new Date().toISOString().split('T')[0];
      setFormData({
        unit_id: transaction.unit_id ? String(transaction.unit_id) : '',
        property_id: transaction.property_id ? String(transaction.property_id) : '',
        type: transaction.type,
        category: transaction.category || '',
        category_detail: transaction.category_detail || '',
        amount: String(transaction.amount),
        date: dateStr,
        description: transaction.description || '',
        payer: transaction.payer || '',
        is_planned: transaction.is_planned === 1,
        is_tenant_payment: transaction.is_tenant_payment === 1,
        status: (String(transaction.status) === 'deferred' ? 'deferred' : String(transaction.status) === 'invoiced' ? 'invoiced' : 'paid') as 'invoiced' | 'paid' | 'deferred',
        scheduled_pay_date: transaction.scheduled_pay_date ? (String(transaction.scheduled_pay_date).split('T')[0] || '') : '',
      });
    } else {
      setEditingTransaction(null);
      setFormData({
        unit_id: '',
        property_id: '',
        type: 'income',
        category: '',
        category_detail: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        payer: '',
        is_planned: false,
        is_tenant_payment: false,
        status: 'paid',
        scheduled_pay_date: '',
      });
    }
    setShowModal(true);
    document.body.classList.add('modal-open');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    document.body.classList.remove('modal-open');
    setEditingTransaction(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const paymentStatus = formData.status === 'invoiced' ? 'invoiced' : formData.status === 'deferred' ? 'deferred' : 'paid';
      const payload: Record<string, unknown> = {
        unit_id: formData.unit_id ? parseInt(formData.unit_id) : null,
        property_id: formData.property_id ? parseInt(formData.property_id) : null,
        type: formData.type,
        category: formData.category || undefined,
        category_detail: formData.category_detail || undefined,
        amount: parseFloat(formData.amount),
        date: formData.date,
        description: formData.description || undefined,
        payer: formData.payer || undefined,
        is_planned: formData.is_planned ? 1 : 0,
        is_tenant_payment: formData.is_tenant_payment ? 1 : 0,
        status: paymentStatus,
      };
      if (paymentStatus === 'deferred' && formData.scheduled_pay_date) {
        payload.scheduled_pay_date = formData.scheduled_pay_date;
      }
      if (editingTransaction) {
        await transactionsApi.update(editingTransaction.id, payload as Partial<Transaction>);
      } else {
        await transactionsApi.create(payload as Partial<Transaction>);
      }
      await loadTransactions(true);
      loadCalendar();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Ошибка сохранения транзакции');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить эту транзакцию?')) return;
    try {
      await transactionsApi.delete(id);
      await loadTransactions(true);
      loadCalendar();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Ошибка удаления транзакции');
    }
  };

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const balance = totalIncome - totalExpense;

  // Расчёт дебиторской задолженности
  type DebtRecord = {
    tenantId: number;
    tenantName: string;
    leaseId: number;
    unitId: number;
    unitNumber: string;
    propertyName: string;
    totalDebt: number;
    overdueMonths: number;
    oldestDebtDate: string;
    paymentCount: number;
  };

  const calculateDebts = (): DebtRecord[] => {
    if (!Array.isArray(tenantPayments) || !Array.isArray(tenants) || !Array.isArray(leases) || !Array.isArray(units) || !Array.isArray(properties)) {
      return [];
    }
    const now = new Date();
    const debtMap = new Map<string, DebtRecord>();

    tenantPayments
      .filter((tp) => tp && typeof tp === 'object' && (tp.is_paid === 0 || tp.status === 'overdue' || tp.status === 'expected' || tp.status === 'partially_paid'))
      .forEach((tp) => {
        if (!tp.tenant_id || !tp.lease_id || !tp.unit_id) return;
        const key = `${tp.tenant_id}-${tp.lease_id}`;
        const tenant = tenants.find((t) => t && t.id === tp.tenant_id);
        const lease = leases.find((l) => l && l.id === tp.lease_id);
        const unit = units.find((u) => u && u.id === tp.unit_id);
        const property = unit?.property_id ? properties.find((p) => p && p.id === unit.property_id) : undefined;

        if (!tenant || !lease || !unit) return;

        // Проверка наличия обязательных полей
        if (typeof tp.year !== 'number' || typeof tp.month !== 'number' || tp.month < 1 || tp.month > 12) return;
        if (typeof tp.planned_amount !== 'number' && typeof tp.actual_amount !== 'number') return;

        const paymentMonth = new Date(tp.year, tp.month - 1, 1);
        const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthsDiff = paymentMonth < currentMonth ? Math.max(0, (now.getFullYear() - tp.year) * 12 + (now.getMonth() - (tp.month - 1))) : 0;
        const debtAmount = tp.status === 'partially_paid' && typeof tp.actual_amount === 'number'
          ? Math.max(0, (tp.planned_amount || 0) - tp.actual_amount)
          : (typeof tp.actual_amount === 'number' ? tp.actual_amount : tp.planned_amount) || 0;

        if (debtAmount <= 0) return;

        if (!debtMap.has(key)) {
          debtMap.set(key, {
            tenantId: tp.tenant_id,
            tenantName: tenant.name,
            leaseId: tp.lease_id,
            unitId: tp.unit_id,
            unitNumber: unit.unit_number,
            propertyName: property?.name || '—',
            totalDebt: 0,
            overdueMonths: 0,
            oldestDebtDate: `${tp.year}-${String(tp.month).padStart(2, '0')}-01`,
            paymentCount: 0,
          });
        }

        const record = debtMap.get(key)!;
        record.totalDebt += debtAmount;
        record.paymentCount += 1;
        if (monthsDiff > record.overdueMonths) {
          record.overdueMonths = monthsDiff;
          record.oldestDebtDate = `${tp.year}-${String(tp.month).padStart(2, '0')}-01`;
        }
      });

    let debts = Array.from(debtMap.values());
    if (debtFilterProperty) {
      const propId = parseInt(debtFilterProperty);
      debts = debts.filter((d) => {
        const unit = units.find((u) => u.id === d.unitId);
        return unit?.property_id === propId;
      });
    }
    return debts.sort((a, b) => b.totalDebt - a.totalDebt);
  };

  const debts = calculateDebts();
  const totalDebt = debts.reduce((sum, d) => sum + d.totalDebt, 0);

  if (loading && transactions.length === 0) {
    return <div className="card">Загрузка...</div>;
  }

  const calendarDates = calendar?.dates || [];
  const byDate = calendar?.by_date || {};

  return (
    <div className="finance-page">
      <div className="card finance-card">
        <div className="card-header">
          <h2 className="card-title" style={{ margin: 0, fontSize: '1.25rem' }}>Платёжный календарь</h2>
        </div>
        <p className="finance-intro" style={{ marginBottom: '0.75rem' }}>
          План приходов и расходов по датам. Отображаются плановые платежи и отложенные (с датой «когда оплатить»).
        </p>
        <div className="finance-filters" style={{ marginBottom: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Месяц</label>
            <input
              type="month"
              className="form-input"
              value={calendarMonth}
              onChange={(e) => setCalendarMonth(e.target.value)}
            />
          </div>
        </div>
        {calendarDates.length === 0 ? (
          <p className="finance-intro-secondary">Нет плановых или отложенных платежей на выбранный период. Добавьте транзакции с типом «План» или статусом «Отложенный платёж».</p>
        ) : (
          <div className="finance-table-wrap">
            <table className="table finance-table calendar-payment-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '100px', width: '100px' }}>Дата</th>
                  <th style={{ minWidth: '140px', width: '140px', whiteSpace: 'nowrap' }}>Тип</th>
                  <th style={{ minWidth: '250px' }}>Категория / Описание</th>
                  <th style={{ minWidth: '130px', width: '130px', whiteSpace: 'nowrap' }}>Сумма</th>
                  <th style={{ minWidth: '150px' }}>Объект / Юнит</th>
                </tr>
              </thead>
              <tbody>
                {calendarDates.map((dateStr) => (
                  (byDate[dateStr] || []).map((item, idx) => (
                    <tr key={`${dateStr}-${item.id}-${item.calendar_type}-${idx}`}>
                      <td style={{ whiteSpace: 'nowrap' }}>{new Date(dateStr).toLocaleDateString('ru-RU')}</td>
                      <td style={{ whiteSpace: 'nowrap', paddingRight: '1rem' }}>
                        {item.calendar_type === 'planned_income' && <span className="status-badge status-rented">План приход</span>}
                        {item.calendar_type === 'planned_expense' && <span className="status-badge status-maintenance">План расход</span>}
                        {item.calendar_type === 'deferred' && <span className="status-badge" style={{ background: '#e8e0f0', color: '#4a148c' }}>Отложенный</span>}
                      </td>
                      <td className="finance-cell-category" style={{ paddingLeft: '1rem', paddingRight: '1rem', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                        {item.category_detail ? `${item.category} — ${item.category_detail}` : (item.category || item.description || '—')}
                      </td>
                      <td style={{ fontWeight: 500, color: item.type === 'income' ? '#2e7d32' : '#c62828', whiteSpace: 'nowrap', paddingLeft: '1rem' }}>
                        {item.type === 'income' ? '+' : '−'} {Math.abs(item.amount).toLocaleString('ru-RU')} ₽
                      </td>
                      <td style={{ paddingLeft: '1rem', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{item.property_name || item.unit_number || '—'}</td>
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Дебиторская задолженность */}
      <div className="card finance-card">
        <div className="card-header">
          <h2 className="card-title" style={{ margin: 0, fontSize: '1.25rem' }}>Дебиторская задолженность</h2>
        </div>
        <p className="finance-intro" style={{ marginBottom: '0.75rem' }}>
          Неоплаченные платежи от арендаторов. Отображаются только активные договоры с просроченными или ожидаемыми платежами.
        </p>
        <div className="finance-filters" style={{ marginBottom: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Объект</label>
            <select
              className="form-input finance-filter-input finance-filter-property"
              value={debtFilterProperty}
              onChange={(e) => setDebtFilterProperty(e.target.value)}
            >
              <option value="">Все объекты</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
        {debts.length === 0 ? (
          <p className="finance-intro-secondary">Нет дебиторской задолженности. Все платежи оплачены.</p>
        ) : (
          <>
            <div className="finance-summary" style={{ marginBottom: '1rem' }}>
              <div className="finance-summary-item" style={{ background: 'rgba(231, 76, 60, 0.1)', borderColor: 'rgba(231, 76, 60, 0.3)' }}>
                <span className="finance-summary-label">Общая задолженность</span>
                <span className="finance-summary-value" style={{ color: 'var(--color-error)', fontSize: '1.2rem', fontWeight: 700 }}>
                  {totalDebt.toLocaleString('ru-RU')} ₽
                </span>
              </div>
              <div className="finance-summary-item">
                <span className="finance-summary-label">Количество должников</span>
                <span className="finance-summary-value" style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                  {debts.length}
                </span>
              </div>
            </div>
            <div className="finance-table-wrap">
              <table className="table finance-table">
                <thead>
                  <tr>
                    <th>Арендатор</th>
                    <th>Объект / Юнит</th>
                    <th>Задолженность</th>
                    <th>Просрочка</th>
                    <th>Платежей</th>
                    <th>Старейший долг</th>
                  </tr>
                </thead>
                <tbody>
                  {debts.map((debt) => {
                    const overdueDays = Math.max(0, Math.floor((new Date().getTime() - new Date(debt.oldestDebtDate).getTime()) / (1000 * 60 * 60 * 24)));
                    const overdueText = debt.overdueMonths === 0 ? 'Нет просрочки' : debt.overdueMonths === 1 ? '1 месяц' : debt.overdueMonths < 12 ? `${debt.overdueMonths} месяца` : `${Math.floor(debt.overdueMonths / 12)} г. ${debt.overdueMonths % 12} мес.`;
                    return (
                      <tr key={`${debt.tenantId}-${debt.leaseId}`}>
                        <td style={{ fontWeight: 600 }}>
                          <Link to="/tenants" style={{ color: 'inherit', textDecoration: 'none' }} title="Перейти к арендаторам">
                            {debt.tenantName}
                          </Link>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.9rem' }}>
                            {(() => {
                              const unit = units.find(u => u.id === debt.unitId);
                              const propertyId = unit?.property_id;
                              return propertyId ? (
                                <Link to={`/properties/${propertyId}`} style={{ color: 'var(--color-accent)', textDecoration: 'none' }} title="Перейти к объекту">
                                  {debt.propertyName}
                                </Link>
                              ) : (
                                <span>{debt.propertyName}</span>
                              );
                            })()}
                            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>Юнит {debt.unitNumber}</div>
                          </div>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--color-error)', fontSize: '1rem' }}>
                          {debt.totalDebt.toLocaleString('ru-RU')} ₽
                        </td>
                        <td>
                          <span className={`status-badge ${debt.overdueMonths > 0 ? 'status-maintenance' : ''}`} style={debt.overdueMonths === 0 ? { background: 'rgba(39, 174, 96, 0.15)', color: 'var(--color-success)' } : undefined}>
                            {overdueText}
                          </span>
                          {debt.overdueMonths > 0 && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
                              {overdueDays} дн.
                            </div>
                          )}
                        </td>
                        <td>{debt.paymentCount}</td>
                        <td style={{ fontSize: '0.9rem' }}>
                          {new Date(debt.oldestDebtDate).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="card finance-card">
        <div className="card-header">
          <h1 className="card-title">Финансы</h1>
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            Добавить транзакцию
          </button>
        </div>

        <p className="finance-intro">
          Обязательные платежи и платежи от арендаторов отображаются на <Link to="/">главной странице</Link>. Здесь — все транзакции с фильтрами, добавление и редактирование.
        </p>
        <>
        <p className="finance-intro finance-intro-secondary">
          Существующие транзакции можно скорректировать или удалить по кнопкам в колонке «Действия».
        </p>

        <div className="finance-filters">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Тип</label>
            <select
              className="form-input finance-filter-input"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">Все</option>
              <option value="income">Доход</option>
              <option value="expense">Расход</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">План / Факт</label>
            <select
              className="form-input finance-filter-input"
              value={filterPlanned}
              onChange={(e) => setFilterPlanned(e.target.value)}
            >
              <option value="">Все</option>
              <option value="plan">План</option>
              <option value="actual">Факт</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Объект</label>
            <select
              className="form-input finance-filter-input finance-filter-property"
              value={filterPropertyId}
              onChange={(e) => setFilterPropertyId(e.target.value)}
            >
              <option value="">Все объекты</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">С</label>
            <input
              type="date"
              className="form-input"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">По</label>
            <input
              type="date"
              className="form-input"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="finance-summary">
          <div className="finance-summary-item finance-summary-income">
            <span className="finance-summary-label">Доходы</span>
            <span className="finance-summary-value">{totalIncome.toLocaleString('ru-RU')} ₽</span>
          </div>
          <div className="finance-summary-item finance-summary-expense">
            <span className="finance-summary-label">Расходы</span>
            <span className="finance-summary-value">{totalExpense.toLocaleString('ru-RU')} ₽</span>
          </div>
          <div className="finance-summary-item finance-summary-balance">
            <span className="finance-summary-label">Итого</span>
            <span className="finance-summary-value" style={{ color: balance >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
              {balance.toLocaleString('ru-RU')} ₽
            </span>
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="finance-empty">
            Нет транзакций по выбранным фильтрам. Добавьте запись вручную или они появятся при учёте платежей.
          </div>
        ) : (
          <div className="finance-table-wrap">
          <table className="table finance-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Тип</th>
                <th>Категория</th>
                <th>Сумма</th>
                <th>От кого / Кому</th>
                <th>Объект</th>
                <th>Юнит</th>
                <th>Статус</th>
                <th>Описание</th>
                <th>План/Факт</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td>{new Date(t.date).toLocaleDateString('ru-RU')}</td>
                  <td>
                    <span className={t.type === 'income' ? 'status-badge status-rented' : 'status-badge status-maintenance'}>
                      {t.type === 'income' ? 'Доход' : 'Расход'}
                    </span>
                  </td>
                  <td className="finance-cell-category">
                    {t.category_detail
                      ? `${t.category} — ${t.category_detail}`
                      : (t.category || '—')}
                  </td>
                  <td style={{ fontWeight: 500, color: t.type === 'income' ? '#2e7d32' : '#c62828' }}>
                    {t.type === 'income' ? '+' : '−'} {Math.abs(t.amount).toLocaleString('ru-RU')} ₽
                  </td>
                  <td className="finance-cell-payer">{t.payer || '—'}</td>
                  <td className="finance-cell-property">{t.property_name || '—'}</td>
                  <td className="finance-cell-unit">{t.unit_number || '—'}</td>
                  <td style={{ whiteSpace: 'normal', maxWidth: '140px' }}>
                    {String(t?.status) === 'deferred' ? (
                      <span className="status-badge" style={{ background: '#e8e0f0', color: '#4a148c', whiteSpace: 'normal', display: 'inline-block', wordBreak: 'break-word' }}>
                        Отложенный{t.scheduled_pay_date ? ` до ${new Date(t.scheduled_pay_date).toLocaleDateString('ru-RU')}` : ''}
                      </span>
                    ) : (
                      <span className={`status-badge ${String(t?.status) === 'invoiced' ? '' : 'status-rented'}`} style={String(t?.status) === 'invoiced' ? { background: '#fff3e0', color: '#e65100' } : undefined}>
                        {String(t?.status) === 'invoiced' ? 'Не оплачен' : 'Оплачен'}
                      </span>
                    )}
                  </td>
                  <td className="finance-cell-desc">{t.description || '—'}</td>
                  <td>
                    <span className={`status-badge ${t.is_planned === 1 ? 'status-rented' : ''}`} style={t.is_planned === 0 ? { background: '#e3f2fd', color: '#1565c0' } : undefined}>
                      {t.is_planned === 1 ? 'План' : 'Факт'}
                    </span>
                  </td>
                  <td>
                    <div className="btn-group">
                      <button
                        className="btn btn-primary"
                        onClick={() => handleOpenModal(t)}
                        title="Скорректировать транзакцию"
                      >
                        Редактировать
                      </button>
                      <button className="btn btn-danger" onClick={() => handleDelete(t.id)}>
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        </>
      </div>

      {showModal && (
        <div className="modal" onClick={handleCloseModal}>
          <div className="modal-content modal-content-scroll" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingTransaction ? 'Редактировать транзакцию' : 'Добавить транзакцию'}
              </h2>
              <button className="close-btn" onClick={handleCloseModal}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Тип *</label>
                <select
                  className="form-input"
                  value={formData.type}
                  onChange={(e) => {
                    const newType = e.target.value as 'income' | 'expense';
                    setFormData({ ...formData, type: newType, category: '' });
                  }}
                  required
                >
                  <option value="income">Доход</option>
                  <option value="expense">Расход</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">
                  Категория {formData.type === 'income' ? '(доходы)' : '(расходы)'}
                </label>
                <select
                  className="form-input"
                  value={formData.category}
                  onChange={(e) => {
                    const cat = e.target.value;
                    setFormData({
                      ...formData,
                      category: cat,
                      category_detail: cat === 'Коммунальные услуги' ? formData.category_detail : '',
                    });
                  }}
                >
                  <option value="">— Выберите категорию</option>
                  {(formData.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              {formData.type === 'expense' && formData.category === 'Коммунальные услуги' && (
                <div className="form-group">
                  <label className="form-label">Вид коммунальных услуг</label>
                  <select
                    className="form-input"
                    value={formData.category_detail}
                    onChange={(e) => setFormData({ ...formData, category_detail: e.target.value })}
                  >
                    <option value="">— Выберите вид</option>
                    {UTILITY_SUBCATEGORIES.map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Сумма (₽) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Дата *</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">От кого платёж</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.payer}
                  onChange={(e) => setFormData({ ...formData, payer: e.target.value })}
                  placeholder={formData.type === 'income' ? 'Имя плательщика или компания' : 'Получатель (компания, поставщик)'}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Объект</label>
                <select
                  className="form-input"
                  value={formData.property_id}
                  onChange={(e) => setFormData({ ...formData, property_id: e.target.value })}
                >
                  <option value="">— Не привязан (или выберите юнит)</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <span className="form-hint" style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                  Для расходов на весь объект (коммунальные услуги и т.п.)
                </span>
              </div>
              <div className="form-group">
                <label className="form-label">Юнит</label>
                <select
                  className="form-input"
                  value={formData.unit_id}
                  onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
                >
                  <option value="">— Не привязан</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.property_name || ''} — {u.unit_number} ({u.area} м²)
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Статус оплаты</label>
                <select
                  className="form-input"
                  value={formData.status}
                  onChange={(e) => setFormData({
                    ...formData,
                    status: e.target.value as 'invoiced' | 'paid' | 'deferred',
                    scheduled_pay_date: e.target.value === 'deferred' && !formData.scheduled_pay_date ? formData.date : formData.scheduled_pay_date,
                  })}
                >
                  <option value="invoiced">Счёт выставлен, не оплачен</option>
                  <option value="paid">Оплачен</option>
                  <option value="deferred">Отложенный платёж</option>
                </select>
              </div>
              {formData.status === 'deferred' && (
                <div className="form-group">
                  <label className="form-label">Когда оплатить *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.scheduled_pay_date || formData.date}
                    onChange={(e) => setFormData({ ...formData, scheduled_pay_date: e.target.value })}
                    required={formData.status === 'deferred'}
                  />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Описание</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_planned}
                    onChange={(e) => setFormData({ ...formData, is_planned: e.target.checked })}
                  />
                  <span className="form-label" style={{ marginBottom: 0 }}>Обязательный платеж</span>
                </label>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_tenant_payment}
                    onChange={(e) => setFormData({ ...formData, is_tenant_payment: e.target.checked })}
                  />
                  <span className="form-label" style={{ marginBottom: 0 }}>Платеж от арендатора</span>
                </label>
              </div>
              <div className="btn-group" style={{ justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" className="btn" onClick={handleCloseModal}>
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingTransaction ? 'Сохранить' : 'Добавить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Finance;
