import { useEffect, useState } from 'react';
import { leasesApi, unitsApi, tenantsApi, invoicesApi, Lease, Unit, Tenant, InvoiceRequest } from '../services/api';

function Leases() {
  const [leases, setLeases] = useState<any[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedLease, setSelectedLease] = useState<any>(null);
  const [invoicePeriod, setInvoicePeriod] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [editingLease, setEditingLease] = useState<Lease | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [formData, setFormData] = useState({
    unit_id: '',
    tenant_id: '',
    start_date: '',
    end_date: '',
    monthly_rent: '',
    deposit: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadLeases();
  }, [filterStatus]);

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [unitsRes, tenantsRes, leasesRes] = await Promise.all([
        unitsApi.getAll(),
        tenantsApi.getAll(),
        filterStatus ? leasesApi.getAll(filterStatus) : leasesApi.getAll(),
      ]);
      setUnits(Array.isArray(unitsRes.data) ? unitsRes.data : []);
      setTenants(Array.isArray(tenantsRes.data) ? tenantsRes.data : []);
      setLeases(Array.isArray(leasesRes.data) ? leasesRes.data : []);
    } catch (error) {
      console.error('Error loading data:', error);
      if (!silent) alert('Ошибка загрузки данных');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadLeases = async (silent = false) => {
    try {
      const res = await (filterStatus ? leasesApi.getAll(filterStatus) : leasesApi.getAll());
      setLeases(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error loading leases:', error);
      if (!silent) alert('Ошибка загрузки договоров');
    }
  };

  const handleOpenModal = (lease?: any) => {
    if (lease) {
      setEditingLease(lease);
      setFormData({
        unit_id: lease.unit_id.toString(),
        tenant_id: lease.tenant_id.toString(),
        start_date: lease.start_date,
        end_date: lease.end_date || '',
        monthly_rent: lease.monthly_rent.toString(),
        deposit: lease.deposit?.toString() || '',
      });
    } else {
      setEditingLease(null);
      setFormData({
        unit_id: '',
        tenant_id: '',
        start_date: '',
        end_date: '',
        monthly_rent: '',
        deposit: '',
      });
    }
    setShowModal(true);
    document.body.classList.add('modal-open');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    document.body.classList.remove('modal-open');
    setEditingLease(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingLease) {
        await leasesApi.update(editingLease.id, {
          ...formData,
          unit_id: parseInt(formData.unit_id),
          tenant_id: parseInt(formData.tenant_id),
          monthly_rent: parseFloat(formData.monthly_rent),
          deposit: formData.deposit ? parseFloat(formData.deposit) : undefined,
        });
      } else {
        await leasesApi.create({
          ...formData,
          unit_id: parseInt(formData.unit_id),
          tenant_id: parseInt(formData.tenant_id),
          monthly_rent: parseFloat(formData.monthly_rent),
          deposit: formData.deposit ? parseFloat(formData.deposit) : undefined,
        });
      }
      await loadLeases(true);
      await loadData(true);
      handleCloseModal();
    } catch (error) {
      console.error('Error saving lease:', error);
      alert('Ошибка сохранения договора');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот договор?')) {
      return;
    }
    try {
      await leasesApi.delete(id);
      await loadLeases(true);
      await loadData(true);
    } catch (error) {
      console.error('Error deleting lease:', error);
      alert('Ошибка удаления договора');
    }
  };

  const handleTerminate = async (id: number) => {
    if (!confirm('Вы уверены, что хотите расторгнуть этот договор?')) {
      return;
    }
    try {
      await leasesApi.update(id, { status: 'terminated' });
      await loadLeases(true);
      await loadData(true);
    } catch (error) {
      console.error('Error terminating lease:', error);
      alert('Ошибка расторжения договора');
    }
  };

  if (loading) {
    return <div className="card">Загрузка...</div>;
  }

  const availableUnits = units.filter((u) => u.status === 'vacant' || editingLease?.unit_id === u.id);

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h1 className="card-title">Договоры аренды</h1>
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            Создать договор
          </button>
        </div>

        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label className="form-label">Фильтр по статусу</label>
          <select
            className="form-input"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ maxWidth: '300px' }}
          >
            <option value="">Все договоры</option>
            <option value="active">Активные</option>
            <option value="completed">Завершенные</option>
            <option value="terminated">Расторгнутые</option>
          </select>
        </div>

        {leases.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p style={{ marginBottom: '1rem', color: '#666' }}>
              Пока нет ни одного договора аренды.
            </p>
            <p style={{ marginBottom: '1.5rem', fontSize: '0.95rem', color: '#888' }}>
              Чтобы создать договор, нужны: <strong>объект</strong>, <strong>юнит</strong> (со статусом «Свободен») и <strong>арендатор</strong>.
              Добавьте их в разделах «Объекты», «Юниты» и «Арендаторы», затем нажмите кнопку ниже.
            </p>
            <button className="btn btn-primary" onClick={() => handleOpenModal()}>
              Создать первый договор
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ minWidth: '120px' }}>Юнит</th>
                  <th style={{ minWidth: '150px' }}>Объект</th>
                  <th style={{ minWidth: '150px' }}>Арендатор</th>
                  <th style={{ minWidth: '120px' }}>Дата начала</th>
                  <th style={{ minWidth: '120px' }}>Дата окончания</th>
                  <th style={{ minWidth: '140px' }}>Арендная плата</th>
                  <th style={{ minWidth: '120px' }}>Статус</th>
                  <th style={{ minWidth: '280px' }}>Действия</th>
                </tr>
              </thead>
            <tbody>
              {leases.map((lease: any) => (
                <tr key={lease.id}>
                  <td>{lease.unit_number || '-'}</td>
                  <td>{lease.property_name || '-'}</td>
                  <td>{lease.tenant_name || '-'}</td>
                  <td>{new Date(lease.start_date).toLocaleDateString('ru-RU')}</td>
                  <td>{lease.end_date ? new Date(lease.end_date).toLocaleDateString('ru-RU') : '-'}</td>
                  <td>{lease.monthly_rent.toLocaleString('ru-RU')} ₽/мес</td>
                  <td>
                    <span className={`status-badge status-${lease.status === 'active' ? 'rented' : 'vacant'}`}>
                      {lease.status === 'active' ? 'Активен' : 
                       lease.status === 'completed' ? 'Завершен' : 'Расторгнут'}
                    </span>
                  </td>
                  <td>
                    <div className="btn-group">
                      <button
                        className="btn btn-primary"
                        onClick={() => handleOpenModal(lease)}
                      >
                        Редактировать
                      </button>
                      {lease.status === 'active' && (
                        <>
                          <button
                            className="btn btn-primary"
                            onClick={() => {
                              setSelectedLease(lease);
                              const now = new Date();
                              const monthNames = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 
                                                'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
                              setInvoicePeriod(`${monthNames[now.getMonth()]} ${now.getFullYear()}`);
                              setShowInvoiceModal(true);
                              document.body.classList.add('modal-open');
                            }}
                            style={{ background: '#27AE60', borderColor: '#27AE60' }}
                          >
                            Сформировать счет
                          </button>
                          <button
                            className="btn btn-danger"
                            onClick={() => handleTerminate(lease.id)}
                          >
                            Расторгнуть
                          </button>
                        </>
                      )}
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDelete(lease.id)}
                      >
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
      </div>

      {showModal && (
        <div className="modal" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingLease ? 'Редактировать договор' : 'Создать договор'}
              </h2>
              <button className="close-btn" onClick={handleCloseModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Юнит *</label>
                <select
                  className="form-input"
                  value={formData.unit_id}
                  onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
                  required
                >
                  <option value="">Выберите юнит</option>
                  {availableUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.property_name} - {unit.unit_number} ({unit.area} м²)
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Арендатор *</label>
                <select
                  className="form-input"
                  value={formData.tenant_id}
                  onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                  required
                >
                  <option value="">Выберите арендатора</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Дата начала *</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Дата окончания</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Арендная плата (₽/мес) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.monthly_rent}
                  onChange={(e) => setFormData({ ...formData, monthly_rent: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Залог (₽)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.deposit}
                  onChange={(e) => setFormData({ ...formData, deposit: e.target.value })}
                />
              </div>
              <div className="btn-group" style={{ justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" className="btn" onClick={handleCloseModal}>
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingLease ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно для формирования счета */}
      {showInvoiceModal && selectedLease && (
        <div className="modal" onClick={() => {
          setShowInvoiceModal(false);
          document.body.classList.remove('modal-open');
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Сформировать счет на оплату</h2>
              <button className="close-btn" onClick={() => {
                setShowInvoiceModal(false);
                document.body.classList.remove('modal-open');
              }}>×</button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label">Договор</label>
                <div style={{ padding: '0.75rem', background: '#f5f7fa', borderRadius: '6px', marginBottom: '1rem' }}>
                  <strong>{selectedLease.tenant_name}</strong><br />
                  {selectedLease.property_name} - {selectedLease.unit_number}<br />
                  Арендная плата: {selectedLease.monthly_rent.toLocaleString('ru-RU')} ₽/мес
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Период оплаты</label>
                <input
                  type="text"
                  className="form-input"
                  value={invoicePeriod}
                  onChange={(e) => setInvoicePeriod(e.target.value)}
                  placeholder="Например: январь 2026"
                />
                <small style={{ color: '#666', fontSize: '0.85rem' }}>
                  Оставьте пустым для текущего месяца
                </small>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                  />
                  Отправить счет на email арендатора
                </label>
                {selectedLease.tenant_email ? (
                  <small style={{ color: '#666', fontSize: '0.85rem', marginLeft: '1.5rem' }}>
                    Email: {selectedLease.tenant_email}
                  </small>
                ) : (
                  <small style={{ color: '#c62828', fontSize: '0.85rem', marginLeft: '1.5rem' }}>
                    У арендатора не указан email
                  </small>
                )}
              </div>
              <div className="btn-group" style={{ marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setShowInvoiceModal(false);
                    document.body.classList.remove('modal-open');
                  }}
                  disabled={invoiceLoading}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    if (!selectedLease) return;
                    setInvoiceLoading(true);
                    try {
                      const request: InvoiceRequest = {
                        leaseId: selectedLease.id,
                        period: invoicePeriod || undefined,
                        sendEmail: sendEmail && !!selectedLease.tenant_email,
                      };
                      const res = await invoicesApi.generate(request);
                      
                      if (res.data.success) {
                        // Открываем счет в новом окне
                        const newWindow = window.open('', '_blank');
                        if (newWindow) {
                          newWindow.document.write(res.data.invoice.html);
                          newWindow.document.close();
                        }
                        
                        // Скачиваем PDF
                        const pdfBlob = new Blob(
                          [Uint8Array.from(atob(res.data.invoice.pdf), c => c.charCodeAt(0))],
                          { type: 'application/pdf' }
                        );
                        const url = URL.createObjectURL(pdfBlob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `invoice-${res.data.invoice.number}.pdf`;
                        link.click();
                        URL.revokeObjectURL(url);
                        
                        let message = 'Счет успешно сформирован';
                        if (res.data.emailSent) {
                          message += ' и отправлен на email арендатора';
                        } else if (sendEmail && res.data.emailError) {
                          message += `. Ошибка отправки email: ${res.data.emailError}`;
                        }
                        alert(message);
                        setShowInvoiceModal(false);
                        document.body.classList.remove('modal-open');
                      }
                    } catch (error: any) {
                      console.error('Error generating invoice:', error);
                      alert(error.response?.data?.error || 'Ошибка формирования счета');
                    } finally {
                      setInvoiceLoading(false);
                    }
                  }}
                  disabled={invoiceLoading || (sendEmail && !selectedLease.tenant_email)}
                  style={{ background: '#27AE60', borderColor: '#27AE60' }}
                >
                  {invoiceLoading ? 'Формирование...' : 'Сформировать и отправить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Leases;
