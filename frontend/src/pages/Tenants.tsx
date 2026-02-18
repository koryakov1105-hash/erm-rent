import { useEffect, useState } from 'react';
import { tenantsApi, Tenant } from '../services/api';

function Tenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    tax_id: '',
  });

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await tenantsApi.getAll();
      setTenants(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error loading tenants:', error);
      if (!silent) alert('Ошибка загрузки арендаторов');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleOpenModal = (tenant?: Tenant) => {
    if (tenant) {
      setEditingTenant(tenant);
      setFormData({
        name: tenant.name,
        contact_person: tenant.contact_person || '',
        phone: tenant.phone || '',
        email: tenant.email || '',
        tax_id: tenant.tax_id || '',
      });
    } else {
      setEditingTenant(null);
      setFormData({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        tax_id: '',
      });
    }
    setShowModal(true);
    document.body.classList.add('modal-open');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    document.body.classList.remove('modal-open');
    setEditingTenant(null);
    setFormData({
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      tax_id: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTenant) {
        await tenantsApi.update(editingTenant.id, formData);
      } else {
        await tenantsApi.create(formData);
      }
      await loadTenants(true);
      handleCloseModal();
    } catch (error) {
      console.error('Error saving tenant:', error);
      alert('Ошибка сохранения арендатора');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить этого арендатора?')) {
      return;
    }
    try {
      await tenantsApi.delete(id);
      await loadTenants(true);
    } catch (error) {
      console.error('Error deleting tenant:', error);
      alert('Ошибка удаления арендатора');
    }
  };

  if (loading) {
    return <div className="card">Загрузка...</div>;
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h1 className="card-title">Арендаторы</h1>
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            Добавить арендатора
          </button>
        </div>

        {tenants.length === 0 ? (
          <p>Нет арендаторов. Создайте первого арендатора.</p>
        ) : (
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ minWidth: '200px' }}>Название</th>
                  <th style={{ minWidth: '150px' }}>Контактное лицо</th>
                  <th style={{ minWidth: '130px' }}>Телефон</th>
                  <th style={{ minWidth: '180px' }}>Email</th>
                  <th style={{ minWidth: '120px' }}>ИНН</th>
                  <th style={{ minWidth: '200px' }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td>{tenant.name}</td>
                    <td>{tenant.contact_person || '-'}</td>
                    <td>{tenant.phone || '-'}</td>
                    <td>{tenant.email || '-'}</td>
                    <td>{tenant.tax_id || '-'}</td>
                    <td>
                      <div className="btn-group">
                        <button
                          className="btn btn-primary"
                          onClick={() => handleOpenModal(tenant)}
                        >
                          Редактировать
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => handleDelete(tenant.id)}
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
                {editingTenant ? 'Редактировать арендатора' : 'Добавить арендатора'}
              </h2>
              <button className="close-btn" onClick={handleCloseModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Название компании / ФИО *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Контактное лицо</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Телефон</label>
                <input
                  type="tel"
                  className="form-input"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">ИНН</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.tax_id}
                  onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                />
              </div>
              <div className="btn-group" style={{ justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" className="btn" onClick={handleCloseModal}>
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingTenant ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Tenants;
