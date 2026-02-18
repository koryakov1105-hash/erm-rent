import { useEffect, useState } from 'react';
import { unitsApi, propertiesApi, Unit, Property, UNIT_CATEGORIES, UNIT_CATEGORY_OTHER } from '../services/api';

function Units() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [filterPropertyId, setFilterPropertyId] = useState<number | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'vacant' | 'rented' | 'maintenance' | ''>('');
  const [formData, setFormData] = useState({
    property_id: '',
    unit_number: '',
    area: '',
    price_per_sqm: '',
    status: 'vacant' as 'vacant' | 'rented' | 'maintenance',
    category: '',
    category_other: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadUnits();
  }, [filterPropertyId]);

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
      console.error('Error loading data:', error);
      alert('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const loadUnits = async (silent = false, propertyIdOverride?: number | '') => {
    try {
      const filter = propertyIdOverride !== undefined ? propertyIdOverride : filterPropertyId;
      const propertyId = filter ? Number(filter) : undefined;
      const response = await unitsApi.getAll(propertyId);
      const list = Array.isArray(response.data) ? response.data : [];
      setUnits(list);
    } catch (error) {
      console.error('Error loading units:', error);
      if (!silent) alert('Ошибка загрузки юнитов');
    }
  };

  const handleOpenModal = (unit?: Unit) => {
    if (unit) {
      setEditingUnit(unit);
      const cat = unit.category || '';
      const isPreset = UNIT_CATEGORIES.includes(cat as typeof UNIT_CATEGORIES[number]);
      setFormData({
        property_id: unit.property_id.toString(),
        unit_number: unit.unit_number,
        area: unit.area.toString(),
        price_per_sqm: unit.price_per_sqm.toString(),
        status: unit.status,
        category: isPreset ? cat : UNIT_CATEGORY_OTHER,
        category_other: isPreset ? '' : cat,
      });
    } else {
      setEditingUnit(null);
      setFormData({
        property_id: filterPropertyId.toString() || '',
        unit_number: '',
        area: '',
        price_per_sqm: '',
        status: 'vacant',
        category: '',
        category_other: '',
      });
    }
    setShowModal(true);
    document.body.classList.add('modal-open');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    document.body.classList.remove('modal-open');
    setEditingUnit(null);
    setFormData({
      property_id: '',
      unit_number: '',
      area: '',
      price_per_sqm: '',
      status: 'vacant',
      category: '',
      category_other: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const categoryValue = formData.category === UNIT_CATEGORY_OTHER
        ? formData.category_other.trim()
        : formData.category;
      const payload = {
        property_id: parseInt(formData.property_id),
        unit_number: formData.unit_number,
        area: parseFloat(formData.area),
        price_per_sqm: parseFloat(formData.price_per_sqm),
        status: formData.status,
        ...(categoryValue && { category: categoryValue }),
      };
      if (editingUnit) {
        await unitsApi.update(editingUnit.id, payload);
      } else {
        await unitsApi.create(payload);
      }
      setSearchQuery('');
      setFilterStatus('');
      await loadUnits(true, filterPropertyId);
      handleCloseModal();
    } catch (error) {
      console.error('Error saving unit:', error);
      alert('Ошибка сохранения юнита');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот юнит?')) {
      return;
    }
    try {
      await unitsApi.delete(id);
      await loadUnits(true);
    } catch (error) {
      console.error('Error deleting unit:', error);
      alert('Ошибка удаления юнита');
    }
  };

  if (loading) {
    return <div className="card">Загрузка...</div>;
  }

  const searchLower = searchQuery.trim().toLowerCase();
  const filteredUnits = units.filter((u) => {
    if (filterPropertyId && u.property_id !== Number(filterPropertyId)) return false;
    if (filterStatus && u.status !== filterStatus) return false;
    if (searchLower) {
      const matchNumber = (u.unit_number || '').toLowerCase().includes(searchLower);
      const matchProperty = (u.property_name || '').toLowerCase().includes(searchLower);
      const matchTenant = (u.tenant_name || '').toLowerCase().includes(searchLower);
      const matchCategory = (u.category || '').toLowerCase().includes(searchLower);
      if (!matchNumber && !matchProperty && !matchTenant && !matchCategory) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h1 className="card-title">Юниты</h1>
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            Добавить юнит
          </button>
        </div>

        <div className="filters-row filters-row-units">
          <input
            type="search"
            className="form-input search-input"
            placeholder="Поиск по номеру, объекту, категории или арендатору..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Поиск юнитов"
          />
          <select
            className="form-input filter-select"
            value={filterPropertyId}
            onChange={(e) => setFilterPropertyId(e.target.value ? Number(e.target.value) : '')}
            aria-label="Фильтр по объекту"
          >
            <option value="">Все объекты</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
          <select
            className="form-input filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            aria-label="Фильтр по статусу"
          >
            <option value="">Все статусы</option>
            <option value="vacant">Свободен</option>
            <option value="rented">Арендован</option>
            <option value="maintenance">На ремонте</option>
          </select>
          {(searchQuery.trim() || filterStatus) && (
            <span className="filter-hint">
              Показано: {filteredUnits.length} из {units.length}
            </span>
          )}
        </div>

        {filteredUnits.length === 0 ? (
          <p>Нет юнитов. Создайте первый юнит.</p>
        ) : (
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ minWidth: '120px' }}>Номер</th>
                  <th style={{ minWidth: '120px' }}>Категория</th>
                  <th style={{ minWidth: '150px' }}>Объект</th>
                  <th style={{ minWidth: '100px' }}>Площадь (м²)</th>
                  <th style={{ minWidth: '120px' }}>Цена за м²</th>
                  <th style={{ minWidth: '150px' }}>Арендная плата (₽/мес)</th>
                  <th style={{ minWidth: '150px' }}>Арендатор</th>
                  <th style={{ minWidth: '120px' }}>Статус</th>
                  <th style={{ minWidth: '200px' }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredUnits.map((unit) => (
                  <tr key={unit.id}>
                    <td>{unit.unit_number}</td>
                    <td>{unit.category || '—'}</td>
                    <td>{unit.property_name || '-'}</td>
                    <td>{unit.area}</td>
                    <td>{unit.price_per_sqm.toLocaleString('ru-RU')} ₽</td>
                    <td>{unit.monthly_rent?.toLocaleString('ru-RU') || 0} ₽</td>
                    <td>{unit.tenant_name || 'Свободен'}</td>
                    <td>
                      <span className={`status-badge status-${unit.status}`}>
                        {unit.status === 'vacant' ? 'Свободен' : 
                         unit.status === 'rented' ? 'Арендован' : 'На ремонте'}
                      </span>
                    </td>
                    <td>
                      <div className="btn-group">
                        <button
                          className="btn btn-primary"
                          onClick={() => handleOpenModal(unit)}
                        >
                          Редактировать
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => handleDelete(unit.id)}
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
                {editingUnit ? 'Редактировать юнит' : 'Добавить юнит'}
              </h2>
              <button className="close-btn" onClick={handleCloseModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Объект *</label>
                <select
                  className="form-input"
                  value={formData.property_id}
                  onChange={(e) => setFormData({ ...formData, property_id: e.target.value })}
                  required
                >
                  <option value="">Выберите объект</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Категория помещения</label>
                <select
                  className="form-input"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="">— не выбрано —</option>
                  {UNIT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value={UNIT_CATEGORY_OTHER}>Другое (указать)</option>
                </select>
                {formData.category === UNIT_CATEGORY_OTHER && (
                  <input
                    type="text"
                    className="form-input"
                    style={{ marginTop: '0.5rem' }}
                    value={formData.category_other}
                    onChange={(e) => setFormData({ ...formData, category_other: e.target.value })}
                    placeholder="Введите категорию"
                  />
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Номер юнита *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.unit_number}
                  onChange={(e) => setFormData({ ...formData, unit_number: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Площадь (м²) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Цена за м² (₽) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.price_per_sqm}
                  onChange={(e) => setFormData({ ...formData, price_per_sqm: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Статус</label>
                <select
                  className="form-input"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'vacant' | 'rented' | 'maintenance' })}
                >
                  <option value="vacant">Свободен</option>
                  <option value="rented">Арендован</option>
                  <option value="maintenance">На ремонте</option>
                </select>
              </div>
              <div className="btn-group" style={{ justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" className="btn" onClick={handleCloseModal}>
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingUnit ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Units;
