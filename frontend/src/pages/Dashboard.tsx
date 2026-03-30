import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { propertiesApi, unitsApi, tenantPaymentsApi, transactionsApi, leasesApi, insightsApi, Property, Unit, Transaction } from '../services/api';

type MonthData = { month: string; monthShort: string; income: number; expense: number; profit: number };

const DASHBOARD_WIDGET_ORDER_KEY = 'dashboard-widget-order';
const DASHBOARD_LAYOUT_KEY = 'dashboard-layout';
const DASHBOARD_WIDGET_SIZES_KEY = 'dashboard-widget-sizes';
const DEFAULT_WIDGET_ORDER = [
  'overview',
  'risks',
  'notifications',
  'quick-actions',
  'mandatory-payments',
  'tenant-payments',
  'metrics',
  'properties',
  'units',
  'analytics',
];
/** Виджеты, которые по умолчанию в сетке занимают 2 колонки (широкие) */
const WIDGET_SPAN_2 = new Set(['overview', 'risks', 'notifications', 'mandatory-payments', 'tenant-payments', 'analytics']);

type WidgetSize = { colSpan: number; rowSpan: number };
function getDefaultWidgetSize(id: string): WidgetSize {
  return { colSpan: WIDGET_SPAN_2.has(id) ? 2 : 1, rowSpan: 1 };
}
function loadWidgetSizes(): Record<string, WidgetSize> {
  try {
    const raw = localStorage.getItem(DASHBOARD_WIDGET_SIZES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const obj = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    const result: Record<string, WidgetSize> = {};
    for (const id of DEFAULT_WIDGET_ORDER) {
      const s = obj[id];
      const def = getDefaultWidgetSize(id);
      result[id] = {
        colSpan: Math.min(3, Math.max(1, typeof s?.colSpan === 'number' ? s.colSpan : def.colSpan)),
        rowSpan: Math.min(3, Math.max(1, typeof s?.rowSpan === 'number' ? s.rowSpan : def.rowSpan)),
      };
    }
    return result;
  } catch {
    return {};
  }
}
function saveWidgetSizes(sizes: Record<string, WidgetSize>) {
  try {
    localStorage.setItem(DASHBOARD_WIDGET_SIZES_KEY, JSON.stringify(sizes));
  } catch (e) {
    console.warn('Could not save widget sizes', e);
  }
}

function loadWidgetOrder(): string[] {
  try {
    const raw = localStorage.getItem(DASHBOARD_WIDGET_ORDER_KEY);
    if (!raw) return [...DEFAULT_WIDGET_ORDER];
    const parsed = JSON.parse(raw);
    const order = Array.isArray(parsed) ? parsed : [];
    // Сохраняем порядок из localStorage, оставляем только известные id
    const orderFromStorage = order.filter((id: string) => typeof id === 'string' && DEFAULT_WIDGET_ORDER.includes(id));
    // В конец добавляем виджеты, которых не было в сохранённых данных (новые в коде)
    const added = DEFAULT_WIDGET_ORDER.filter((id) => !order.includes(id));
    const result = [...orderFromStorage, ...added];
    return result.length > 0 ? result : [...DEFAULT_WIDGET_ORDER];
  } catch {
    return [...DEFAULT_WIDGET_ORDER];
  }
}

function saveWidgetOrder(order: string[]) {
  try {
    localStorage.setItem(DASHBOARD_WIDGET_ORDER_KEY, JSON.stringify(order));
  } catch (e) {
    console.warn('Could not save widget order', e);
  }
}

type LayoutMode = 'list' | 'grid';
function loadLayoutMode(): LayoutMode {
  try {
    const v = localStorage.getItem(DASHBOARD_LAYOUT_KEY);
    if (v === 'list' || v === 'grid') return v;
    return 'grid';
  } catch {
    return 'grid';
  }
}
function saveLayoutMode(mode: LayoutMode) {
  try {
    localStorage.setItem(DASHBOARD_LAYOUT_KEY, mode);
  } catch (e) {
    console.warn('Could not save layout mode', e);
  }
}

function Dashboard() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'planned' | 'actual'>('planned');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [actualRevenue, setActualRevenue] = useState(0);
  const [plannedPaymentsCount, setPlannedPaymentsCount] = useState(0);
  const [plannedPaymentsSum, setPlannedPaymentsSum] = useState(0);
  const [leasesEndingSoon, setLeasesEndingSoon] = useState<any[]>([]);
  const [insightAlerts, setInsightAlerts] = useState<{ level: string; message: string }[]>([]);
  const [deviations, setDeviations] = useState<Record<string, number | null> | null>(null);
  const [chartMonths, setChartMonths] = useState(6);
  const [payMonth, setPayMonth] = useState(new Date().getMonth() + 1);
  const [payYear, setPayYear] = useState(new Date().getFullYear());
  const [paymentsTransactions, setPaymentsTransactions] = useState<Transaction[]>([]);
  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => loadWidgetOrder());
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => loadLayoutMode());
  const [widgetSizes, setWidgetSizes] = useState<Record<string, WidgetSize>>(loadWidgetSizes);
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState<string | null>(null);
  const widgetRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const gridListRef = useRef<HTMLDivElement | null>(null);
  const [resizingWidgetId, setResizingWidgetId] = useState<string | null>(null);
  const resizeRef = useRef<{
    widgetId: string;
    startX: number;
    startY: number;
    startColSpan: number;
    startRowSpan: number;
    axis: 'col' | 'row' | 'both';
    columnWidth: number;
    rowHeight: number;
    maxCols: number;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadPayments();
  }, [payMonth, payYear]);

  const loadPayments = async () => {
    try {
      const startDate = `${payYear}-${String(payMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(payYear, payMonth, 0).getDate();
      const endDate = `${payYear}-${String(payMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const res = await transactionsApi.getAll({ start_date: startDate, end_date: endDate });
      setPaymentsTransactions(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('Error loading payments:', e);
      setPaymentsTransactions([]);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    insightsApi
      .get()
      .then((res) => {
        setInsightAlerts(Array.isArray(res.data?.alerts) ? res.data.alerts.slice(0, 12) : []);
        setDeviations(res.data?.deviations && typeof res.data.deviations === 'object' ? res.data.deviations : null);
      })
      .catch(() => {
        setInsightAlerts([]);
        setDeviations(null);
      });
  }, []);

  useEffect(() => {
    if (viewMode === 'actual') {
      loadActualData();
    }
  }, [viewMode, selectedMonth, selectedYear]);

  useEffect(() => {
    loadAnalytics();
  }, [chartMonths]);

  const loadAnalytics = async () => {
    try {
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - chartMonths);
      const startStr = start.getFullYear() + '-' + String(start.getMonth() + 1).padStart(2, '0') + '-01';
      const endStr = end.getFullYear() + '-' + String(end.getMonth() + 1).padStart(2, '0') + '-' + String(new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate()).padStart(2, '0');
      const txRes = await transactionsApi.getAll({ start_date: startStr, end_date: endStr });
      setTransactions(Array.isArray(txRes.data) ? txRes.data : []);
    } catch (e) {
      console.error(e);
      setTransactions([]);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [propertiesRes, unitsRes] = await Promise.all([
        propertiesApi.getAll(),
        unitsApi.getAll(),
      ]);
      setProperties(Array.isArray(propertiesRes.data) ? propertiesRes.data : []);
      setUnits(Array.isArray(unitsRes.data) ? unitsRes.data : []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setProperties([]);
      setUnits([]);
    } finally {
      setLoading(false);
    }
  };

  const loadNotifications = async () => {
    try {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const startStr = firstDay.toISOString().split('T')[0];
      const endStr = lastDay.toISOString().split('T')[0];
      const [txRes, leasesRes] = await Promise.all([
        transactionsApi.getAll({ start_date: startStr, end_date: endStr }),
        leasesApi.getAll('active'),
      ]);
      const txs = Array.isArray(txRes.data) ? txRes.data : [];
      const planned = txs.filter((t: any) => t.is_planned === 1);
      setPlannedPaymentsCount(planned.length);
      setPlannedPaymentsSum(planned.reduce((s: number, t: any) => s + (t.amount || 0), 0));
      const in60Days = new Date();
      in60Days.setDate(in60Days.getDate() + 60);
      const leasesList = Array.isArray(leasesRes.data) ? leasesRes.data : [];
      const ending = leasesList.filter((l: any) => l.end_date && new Date(l.end_date) <= in60Days);
      setLeasesEndingSoon(ending);
    } catch (e) {
      console.error('Error loading notifications:', e);
      setPlannedPaymentsCount(0);
      setPlannedPaymentsSum(0);
      setLeasesEndingSoon([]);
    }
  };

  const loadActualData = async () => {
    try {
      const response = await tenantPaymentsApi.getAll(selectedMonth, selectedYear);
      const list = Array.isArray(response?.data) ? response.data : [];
      const paidPayments = list.filter((p: any) => p.is_paid === 1);
      const totalActual = paidPayments.reduce((sum: number, p: any) => sum + (p.actual_amount || 0), 0);
      setActualRevenue(totalActual);
    } catch (error) {
      console.error('Error loading actual data:', error);
      setActualRevenue(0);
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedWidgetId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    const el = widgetRefs.current[id];
    if (el) {
      e.dataTransfer.setDragImage(el, 24, 16);
    }
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedWidgetId && draggedWidgetId !== id) setDragOverWidgetId(id);
  };

  const handleDragLeave = (e: React.DragEvent, widgetId: string) => {
    const el = widgetRefs.current[widgetId];
    const related = e.relatedTarget as Node | null;
    if (el && related && el.contains(related)) return;
    setDragOverWidgetId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverWidgetId(null);
    if (!draggedWidgetId || draggedWidgetId === targetId) return;
    const fromIndex = widgetOrder.indexOf(draggedWidgetId);
    const toIndex = widgetOrder.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...widgetOrder];
    next.splice(fromIndex, 1);
    next.splice(toIndex, 0, draggedWidgetId);
    setWidgetOrder(next);
    saveWidgetOrder(next);
  };

  const handleDragEnd = () => {
    setDraggedWidgetId(null);
    setDragOverWidgetId(null);
  };

  const getWidgetSize = (id: string): WidgetSize => widgetSizes[id] ?? getDefaultWidgetSize(id);

  const handleResizeStart = (e: React.MouseEvent, widgetId: string, axis: 'col' | 'row' | 'both') => {
    e.preventDefault();
    e.stopPropagation();
    const size = getWidgetSize(widgetId);
    const gridEl = gridListRef.current;
    const gap = 16;
    const width = gridEl?.offsetWidth ?? 0;
    const maxCols = width >= 1200 ? 3 : width >= 640 ? 2 : 1;
    const columnWidth = width > 0 ? (width - gap * (maxCols - 1)) / maxCols : 200;
    const rowHeight = 140;
    resizeRef.current = {
      widgetId,
      startX: e.clientX,
      startY: e.clientY,
      startColSpan: Math.min(size.colSpan, maxCols),
      startRowSpan: size.rowSpan,
      axis,
      columnWidth,
      rowHeight,
      maxCols,
    };
    setResizingWidgetId(widgetId);
    document.body.style.cursor = axis === 'col' ? 'col-resize' : axis === 'row' ? 'row-resize' : 'nwse-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = resizeRef.current;
      if (!r) return;
      const dx = e.clientX - r.startX;
      const dy = e.clientY - r.startY;
      let colSpan = r.startColSpan;
      let rowSpan = r.startRowSpan;
      if (r.axis === 'col' || r.axis === 'both') {
        colSpan = Math.round(r.startColSpan + dx / r.columnWidth);
        colSpan = Math.max(1, Math.min(r.maxCols, colSpan));
      }
      if (r.axis === 'row' || r.axis === 'both') {
        rowSpan = Math.round(r.startRowSpan + dy / r.rowHeight);
        rowSpan = Math.max(1, Math.min(3, rowSpan));
      }
      setWidgetSizes((prev) => {
        const next = { ...prev, [r.widgetId]: { colSpan, rowSpan } };
        saveWidgetSizes(next);
        return next;
      });
    };
    const onUp = () => {
      if (resizeRef.current) {
        resizeRef.current = null;
        setResizingWidgetId(null);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  if (loading) {
    return <div className="card">Загрузка...</div>;
  }

  const totalUnits = units.length;
  const occupiedUnits = units.filter(u => u.status === 'rented').length;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
  const totalMonthlyRevenue = properties.reduce((sum, p) => sum + (p.monthly_revenue || 0), 0);
  const averageRevenuePerSqm = units.length > 0
    ? units.reduce((sum, u) => sum + (u.price_per_sqm || 0), 0) / units.length
    : 0;

  const displayRevenue = viewMode === 'planned' ? totalMonthlyRevenue : actualRevenue;
  const revenueLabel = viewMode === 'planned' ? 'Плановая доходность' : 'Фактическая доходность';

  const isEmpty = properties.length === 0 && units.length === 0;

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

  // Доход и расход за текущий месяц (по тем же данным, что в разделе Финансы)
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const inCurrentMonth = (t: Transaction) => {
    const dt = new Date(t.date);
    return dt >= currentMonthStart && dt <= currentMonthEnd;
  };
  const incomeThisMonth = transactions.filter((t) => t.type === 'income' && inCurrentMonth(t)).reduce((s, t) => s + t.amount, 0);
  const expenseThisMonth = transactions.filter((t) => t.type === 'expense' && inCurrentMonth(t)).reduce((s, t) => s + t.amount, 0);

  const unitForecasts = units.map((u) => {
    const plannedRent = u.monthly_rent || 0;
    const unitExpenses = transactions
      .filter((t) => t.unit_id === u.id && t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    const avgExpense = chartMonths > 0 ? unitExpenses / chartMonths : 0;
    const forecastProfit = plannedRent - avgExpense;
    return { unit: u, plannedRent, plannedExpense: avgExpense, forecastProfit };
  });

  return (
    <div>
      {isEmpty && (
        <div className="card onboarding-block">
          <h2 className="card-title">Начните с добавления объекта</h2>
          <p className="text-secondary" style={{ marginBottom: '1.25rem' }}>
            Добавьте объект недвижимости, затем юниты (помещения), арендаторов и договоры. После этого можно вносить платежи в разделе «Финансы».
          </p>
          <div className="btn-group">
            <Link to="/properties" className="btn btn-primary">Добавить объект</Link>
            <Link to="/units" className="btn">Добавить юнит</Link>
            <Link to="/tenants" className="btn">Добавить арендатора</Link>
          </div>
        </div>
      )}

      <div className="dashboard-layout-control" style={{ marginTop: '1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span className="form-label" style={{ marginBottom: 0 }}>Раскладка виджетов:</span>
        <div className="btn-group">
          <button
            type="button"
            className={`btn ${layoutMode === 'grid' ? 'btn-primary' : ''}`}
            onClick={() => { setLayoutMode('grid'); saveLayoutMode('grid'); }}
          >
            Компактная сетка
          </button>
          <button
            type="button"
            className={`btn ${layoutMode === 'list' ? 'btn-primary' : ''}`}
            onClick={() => { setLayoutMode('list'); saveLayoutMode('list'); }}
          >
            Список сверху вниз
          </button>
        </div>
        <span className="text-secondary" style={{ fontSize: '0.85rem' }}>Перетаскивайте виджеты за значок ⋮⋮ для изменения порядка.</span>
      </div>

      <div
        ref={gridListRef}
        className={`dashboard-widgets-list ${layoutMode === 'grid' ? 'dashboard-widgets-list--grid' : 'dashboard-widgets-list--list'}`}
      >
        {widgetOrder.map((id) => {
          const isOver = dragOverWidgetId === id;
          const isDragging = draggedWidgetId === id;
          const size = getWidgetSize(id);
          const gridStyle = layoutMode === 'grid' ? { gridColumn: `span ${size.colSpan}`, gridRow: `span ${size.rowSpan}` } : undefined;
          return (
            <div
              key={id}
              ref={(el) => { widgetRefs.current[id] = el; }}
              className={`dashboard-widget ${isDragging ? 'dashboard-widget-dragging' : ''} ${isOver ? 'dashboard-widget-drag-over' : ''} ${resizingWidgetId === id ? 'dashboard-widget--resizing' : ''}`}
              data-widget-id={id}
              style={gridStyle}
              onDragOver={(e) => handleDragOver(e, id)}
              onDragLeave={(e) => handleDragLeave(e, id)}
              onDrop={(e) => handleDrop(e, id)}
              onDragEnd={handleDragEnd}
            >
              <div
                className="dashboard-widget-handle"
                draggable
                onDragStart={(e) => handleDragStart(e, id)}
                title="Перетащите для изменения порядка"
              >
                ⋮⋮
              </div>
              {layoutMode === 'grid' && (
                <>
                  <div
                    className="dashboard-widget-resize dashboard-widget-resize--right"
                    onMouseDown={(e) => handleResizeStart(e, id, 'col')}
                    title="Потяните для изменения ширины"
                  />
                  <div
                    className="dashboard-widget-resize dashboard-widget-resize--bottom"
                    onMouseDown={(e) => handleResizeStart(e, id, 'row')}
                    title="Потяните для изменения высоты"
                  />
                  <div
                    className="dashboard-widget-resize dashboard-widget-resize--corner"
                    onMouseDown={(e) => handleResizeStart(e, id, 'both')}
                    title="Потяните для изменения размера"
                  />
                </>
              )}
              {id === 'overview' && (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Обзор и аналитика</h2>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {viewMode === 'actual' && (
              <>
                <select
                  className="form-input"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  style={{ width: '120px' }}
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
              </>
            )}
            <div className="toggle-group">
              <button
                className={`btn ${viewMode === 'planned' ? 'btn-primary' : ''}`}
                onClick={() => setViewMode('planned')}
              >
                План
              </button>
              <button
                className={`btn ${viewMode === 'actual' ? 'btn-primary' : ''}`}
                onClick={() => setViewMode('actual')}
              >
                Факт
              </button>
            </div>
          </div>
        </div>
      </div>
              )}
              {id === 'risks' && (
      <div className="card">
        <h2 className="card-title">Риски и отклонения план/факт</h2>
        {insightAlerts.length > 0 ? (
          <ul className="notifications-list" style={{ marginBottom: '1rem' }}>
            {insightAlerts.map((a, idx) => (
              <li key={idx}>
                <span className={`notif-dot ${a.level === 'danger' ? 'notif-warn' : a.level === 'warning' ? 'notif-plan' : 'notif-info'}`} />
                {a.message}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-secondary" style={{ marginBottom: '1rem' }}>Нет критических сигналов по текущим данным.</p>
        )}
        {deviations && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem', fontSize: '0.9rem' }}>
            <div className="card" style={{ padding: '0.75rem', margin: 0 }}>
              <div className="text-secondary">План доход</div>
              <strong>{(deviations.planned_income ?? 0).toLocaleString('ru-RU')} ₽</strong>
            </div>
            <div className="card" style={{ padding: '0.75rem', margin: 0 }}>
              <div className="text-secondary">Факт доход</div>
              <strong>{(deviations.actual_income ?? 0).toLocaleString('ru-RU')} ₽</strong>
            </div>
            <div className="card" style={{ padding: '0.75rem', margin: 0 }}>
              <div className="text-secondary">План расход</div>
              <strong>{(deviations.planned_expense ?? 0).toLocaleString('ru-RU')} ₽</strong>
            </div>
            <div className="card" style={{ padding: '0.75rem', margin: 0 }}>
              <div className="text-secondary">Факт расход</div>
              <strong>{(deviations.actual_expense ?? 0).toLocaleString('ru-RU')} ₽</strong>
            </div>
            {deviations.income_gap_pct != null && (
              <div className="card" style={{ padding: '0.75rem', margin: 0 }}>
                <div className="text-secondary">Отклонение дохода</div>
                <strong>{deviations.income_gap_pct}%</strong>
              </div>
            )}
          </div>
        )}
        <p style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
          <Link to="/reports">Отчёты ДДС и ОПиУ</Link>
          {' · '}
          <Link to="/finance">Платёжный календарь</Link>
        </p>
      </div>
              )}
              {id === 'notifications' && (
      <div className="card notifications-widget">
        <h2 className="card-title">Уведомления о платежах</h2>
        <ul className="notifications-list">
          <li>
            <span className="notif-dot notif-info" />
            <strong>Период внесения фактических платежей:</strong> с 1 по 30 число каждого месяца. Вносите фактические суммы в разделе <Link to="/finance">Финансы</Link>.
          </li>
          {plannedPaymentsCount > 0 && (
            <li>
              <span className="notif-dot notif-plan" />
              <strong>Плановые платежи в этом месяце:</strong> {plannedPaymentsCount} на сумму {plannedPaymentsSum.toLocaleString('ru-RU')} ₽. См. блок «Обязательные платежи» ниже.
            </li>
          )}
          {leasesEndingSoon.length > 0 && (
            <li>
              <span className="notif-dot notif-warn" />
              <strong>Договоры заканчиваются в ближайшие 60 дней:</strong> {leasesEndingSoon.length}. <Link to="/leases">Проверить договоры</Link>.
            </li>
          )}
          {plannedPaymentsCount === 0 && leasesEndingSoon.length === 0 && (
            <li>
              <span className="notif-dot notif-ok" />
              Нет срочных напоминаний. Не забудьте вносить фактические платежи с 1 по 30 число.
            </li>
          )}
        </ul>
      </div>
              )}
              {id === 'quick-actions' && (
      <div className="card quick-actions">
        <h2 className="card-title">Быстрые действия</h2>
        <div className="btn-group">
          <Link to="/properties" className="btn btn-primary">Добавить объект</Link>
          <Link to="/units" className="btn btn-primary">Добавить юнит</Link>
          <Link to="/leases" className="btn btn-primary">Создать договор</Link>
          <Link to="/finance" className="btn btn-primary">Внести платёж (Финансы)</Link>
        </div>
      </div>
              )}
              {id === 'mandatory-payments' && (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Обязательные платежи</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="form-input"
              value={payMonth}
              onChange={(e) => setPayMonth(parseInt(e.target.value))}
              style={{ width: '140px' }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('ru-RU', { month: 'long' })}</option>
              ))}
            </select>
            <select
              className="form-input"
              value={payYear}
              onChange={(e) => setPayYear(parseInt(e.target.value))}
              style={{ width: '100px' }}
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <Link to="/finance" className="btn btn-primary">Все транзакции</Link>
          </div>
        </div>
        <p className="text-secondary" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
          Плановые обязательные платежи за выбранный месяц. Добавление и правка — в разделе <Link to="/finance">Финансы</Link>.
        </p>
        {paymentsTransactions.filter((t) => t.is_planned === 1).length === 0 ? (
          <p className="text-secondary">Нет обязательных платежей за выбранный период. Добавьте транзакцию в разделе Финансы и отметьте «Обязательный платеж».</p>
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
              {paymentsTransactions.filter((t) => t.is_planned === 1).map((t) => (
                <tr key={t.id}>
                  <td>{new Date(t.date).toLocaleDateString('ru-RU')}</td>
                  <td>
                    <span className={t.type === 'income' ? 'status-badge status-rented' : 'status-badge status-maintenance'}>
                      {t.type === 'income' ? 'Доход' : 'Расход'}
                    </span>
                  </td>
                  <td>{t.category || '—'}</td>
                  <td style={{ fontWeight: 500, color: t.type === 'income' ? 'var(--color-success)' : 'var(--color-error)' }}>
                    {t.type === 'income' ? '+' : '−'} {Math.abs(t.amount).toLocaleString('ru-RU')} ₽
                  </td>
                  <td>{t.payer || '—'}</td>
                  <td>{t.unit_number || '—'}</td>
                  <td style={{ maxWidth: '220px' }}>{t.description || '—'}</td>
                  <td>
                    <span className={`status-badge ${t.is_planned === 1 ? 'status-rented' : ''}`} style={t.is_planned === 0 ? { background: '#e3f2fd', color: '#1565c0' } : undefined}>
                      {t.is_planned === 1 ? 'План' : 'Факт'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
              )}
              {id === 'tenant-payments' && (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Платежи от арендаторов</h2>
          <Link to="/finance" className="btn btn-primary">Все транзакции</Link>
        </div>
        <p className="text-secondary" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
          Платежи от арендаторов за выбранный период (месяц и год — в блоке «Обязательные платежи» выше). Добавление и правка — в разделе <Link to="/finance">Финансы</Link>.
        </p>
        {paymentsTransactions.filter((t) => t.is_tenant_payment === 1).length === 0 ? (
          <p className="text-secondary">Нет платежей от арендаторов за период. Добавьте транзакцию в разделе Финансы и отметьте «Платеж от арендатора».</p>
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
              {paymentsTransactions.filter((t) => t.is_tenant_payment === 1).map((t) => (
                <tr key={t.id}>
                  <td>{new Date(t.date).toLocaleDateString('ru-RU')}</td>
                  <td>
                    <span className={t.type === 'income' ? 'status-badge status-rented' : 'status-badge status-maintenance'}>
                      {t.type === 'income' ? 'Доход' : 'Расход'}
                    </span>
                  </td>
                  <td>{t.category || '—'}</td>
                  <td style={{ fontWeight: 500, color: t.type === 'income' ? 'var(--color-success)' : 'var(--color-error)' }}>
                    {t.type === 'income' ? '+' : '−'} {Math.abs(t.amount).toLocaleString('ru-RU')} ₽
                  </td>
                  <td>{t.payer || '—'}</td>
                  <td>{t.unit_number || '—'}</td>
                  <td style={{ maxWidth: '220px' }}>{t.description || '—'}</td>
                  <td>
                    <span className={`status-badge ${t.is_planned === 1 ? 'status-rented' : ''}`} style={t.is_planned === 0 ? { background: '#e3f2fd', color: '#1565c0' } : undefined}>
                      {t.is_planned === 1 ? 'План' : 'Факт'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
              )}
              {id === 'metrics' && (
      <div className="metrics-grid">
        <div className="metric-card accent">
          <div className="metric-card-header">
            <div>
              <div className="metric-label">{revenueLabel}</div>
              <div className="metric-value">{displayRevenue.toLocaleString('ru-RU')} ₽</div>
            </div>
            <div className="metric-icon">💰</div>
          </div>
          {viewMode === 'actual' && totalMonthlyRevenue > 0 && (
            <div className={`metric-change ${actualRevenue >= totalMonthlyRevenue ? 'positive' : 'negative'}`}>
              <span>{actualRevenue >= totalMonthlyRevenue ? '↑' : '↓'}</span>
              <span>
                {actualRevenue >= totalMonthlyRevenue ? '+' : ''}
                {((actualRevenue - totalMonthlyRevenue) / totalMonthlyRevenue * 100).toFixed(1)}% чем план
              </span>
            </div>
          )}
          {viewMode === 'planned' && (
            <div className="metric-change positive">
              <span>↑</span>
              <span>Плановая доходность</span>
            </div>
          )}
        </div>

        <div className="metric-card dark">
          <div className="metric-card-header">
            <div>
              <div className="metric-label">Доход за месяц</div>
              <div className="metric-value" style={{ color: 'var(--color-success)' }}>
                {incomeThisMonth.toLocaleString('ru-RU')} ₽
              </div>
            </div>
            <div className="metric-icon">💰</div>
          </div>
          <div className="metric-change positive">
            <span>↑</span>
            <span>Этот месяц (из раздела Финансы)</span>
          </div>
        </div>

        <div className="metric-card dark">
          <div className="metric-card-header">
            <div>
              <div className="metric-label">Общие расходы</div>
              <div className="metric-value">
                {expenseThisMonth.toLocaleString('ru-RU')} ₽
              </div>
            </div>
            <div className="metric-icon">📊</div>
          </div>
          <div className="metric-change positive">
            <span>↑</span>
            <span>Этот месяц (из раздела Финансы)</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-card-header">
            <div>
              <div className="metric-label">Количество объектов</div>
              <div className="metric-value">{properties.length}</div>
            </div>
            <div className="metric-icon">🏢</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-card-header">
            <div>
              <div className="metric-label">Количество юнитов</div>
              <div className="metric-value">{totalUnits}</div>
            </div>
            <div className="metric-icon">🏠</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-card-header">
            <div>
              <div className="metric-label">Процент занятости</div>
              <div className="metric-value">{occupancyRate}%</div>
            </div>
            <div className="metric-icon">📈</div>
          </div>
          <div className={`metric-change ${occupancyRate >= 80 ? 'positive' : occupancyRate >= 50 ? '' : 'negative'}`}>
            <span>{occupancyRate >= 80 ? '↑' : occupancyRate >= 50 ? '→' : '↓'}</span>
            <span>{occupiedUnits} из {totalUnits}</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-card-header">
            <div>
              <div className="metric-label">Средняя стоимость за м²</div>
              <div className="metric-value">{Math.round(averageRevenuePerSqm).toLocaleString('ru-RU')} ₽</div>
            </div>
            <div className="metric-icon">💵</div>
          </div>
        </div>
      </div>
              )}
              {id === 'properties' && (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Объекты</h2>
          <Link to="/properties" className="btn btn-primary">
            Управление объектами
          </Link>
        </div>
        {properties.length === 0 ? (
          <p>Нет объектов. <Link to="/properties">Создайте первый объект</Link></p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Адрес</th>
                <th>Юнитов</th>
                <th>Занято</th>
                <th>Доходность (₽/мес)</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((property) => (
                <tr key={property.id}>
                  <td>
                    <Link to={`/properties/${property.id}`}>{property.name}</Link>
                  </td>
                  <td>{property.address || '-'}</td>
                  <td>{property.units_count || 0}</td>
                  <td>{property.occupied_units || 0}</td>
                  <td>{property.monthly_revenue?.toLocaleString('ru-RU') || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
              )}
              {id === 'units' && (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Юниты</h2>
          <Link to="/units" className="btn btn-primary">
            Управление юнитами
          </Link>
        </div>
        {units.length === 0 ? (
          <p>Нет юнитов. <Link to="/units">Создайте первый юнит</Link></p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Номер</th>
                <th>Объект</th>
                <th>Площадь (м²)</th>
                <th>Цена за м²</th>
                <th>Арендная плата</th>
                <th>Арендатор</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {units.slice(0, 10).map((unit) => (
                <tr key={unit.id}>
                  <td>{unit.unit_number ?? '-'}</td>
                  <td>{unit.property_name || '-'}</td>
                  <td>{unit.area ?? '-'}</td>
                  <td>{(unit.price_per_sqm ?? 0).toLocaleString('ru-RU')} ₽</td>
                  <td>{(unit.monthly_rent ?? 0).toLocaleString('ru-RU')} ₽/мес</td>
                  <td>{unit.tenant_name || 'Свободен'}</td>
                  <td>
                    <span className={`status-badge status-${unit.status}`}>
                      {unit.status === 'vacant' ? 'Свободен' : 
                       unit.status === 'rented' ? 'Арендован' : 'На ремонте'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
              )}
              {id === 'analytics' && (
      <div className="card reports-page">
        <div className="card-header">
          <h2 className="card-title">Аналитика</h2>
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
          <h3 className="report-section-title">График платежей по месяцам</h3>
          <p className="text-secondary" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
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
          <h3 className="report-section-title">Прогноз по юнитам</h3>
          <p className="text-secondary" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
            Плановая арендная плата и оценка расходов по юниту за выбранный период.
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
                    <td style={{ fontWeight: 600, color: forecastProfit >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Dashboard;
