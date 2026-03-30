import { useEffect, useState } from 'react';
import { paymentRequestsApi, PaymentRequest, PaymentRequestStatus, propertiesApi, Property } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function PaymentRequestsPage() {
  const { user } = useAuth();
  const [list, setList] = useState<PaymentRequest[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [comment, setComment] = useState('');

  const canApprove = user?.role === 'admin' || user?.role === 'finance';

  const load = async () => {
    const [pr, prop] = await Promise.all([paymentRequestsApi.getAll(), propertiesApi.getAll()]);
    setList(Array.isArray(pr.data) ? pr.data : []);
    setProperties(Array.isArray(prop.data) ? prop.data : []);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await paymentRequestsApi.create({
      title: title.trim(),
      amount: parseFloat(amount.replace(',', '.')),
      due_date: dueDate,
      property_id: propertyId ? parseInt(propertyId, 10) : undefined,
      comment: comment || undefined,
    });
    setTitle('');
    setAmount('');
    setDueDate('');
    setPropertyId('');
    setComment('');
    await load();
  };

  const setStatus = async (id: number, status: PaymentRequestStatus) => {
    await paymentRequestsApi.patch(id, { status });
    await load();
  };

  if (loading) return <div className="card">Загрузка…</div>;

  return (
    <div>
      <div className="card">
        <h1 className="card-title">Заявки на оплату</h1>
        <p className="text-secondary" style={{ marginBottom: '1rem' }}>
          Черновик → отправка → утверждение (роли admin/finance). Учёт НДС в транзакциях: поля ставки и суммы без НДС в форме проводки в разделе Финансы.
        </p>
        <form onSubmit={submitCreate} style={{ display: 'grid', gap: '0.75rem', maxWidth: 480 }}>
          <div>
            <label className="form-label">Назначение</label>
            <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <label className="form-label">Сумма, ₽</label>
            <input className="form-input" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div>
            <label className="form-label">Оплатить до</label>
            <input type="date" className="form-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
          </div>
          <div>
            <label className="form-label">Объект</label>
            <select className="form-input" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
              <option value="">—</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Комментарий</label>
            <input className="form-input" value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary">Создать черновик</button>
        </form>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h2 className="card-title">Список</h2>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Назначение</th>
              <th>Сумма</th>
              <th>Срок</th>
              <th>Статус</th>
              <th /></tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.title}</td>
                <td>{r.amount.toLocaleString('ru-RU')}</td>
                <td>{r.due_date}</td>
                <td><span className="status-badge">{r.status}</span></td>
                <td>
                  <div className="btn-group" style={{ flexWrap: 'wrap' }}>
                    {r.status === 'draft' && (
                      <>
                        <button type="button" className="btn" onClick={() => setStatus(r.id, 'submitted')}>Отправить</button>
                        <button type="button" className="btn" onClick={() => paymentRequestsApi.delete(r.id).then(load)}>Удалить</button>
                      </>
                    )}
                    {r.status === 'submitted' && canApprove && (
                      <>
                        <button type="button" className="btn btn-primary" onClick={() => setStatus(r.id, 'approved')}>Утвердить</button>
                        <button type="button" className="btn" onClick={() => setStatus(r.id, 'rejected')}>Отклонить</button>
                      </>
                    )}
                    {r.status === 'approved' && (
                      <button type="button" className="btn" onClick={() => setStatus(r.id, 'paid')}>Отметить оплаченной</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="text-secondary">Заявок пока нет.</p>}
      </div>
    </div>
  );
}
