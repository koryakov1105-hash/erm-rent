import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { propertiesApi, unitsApi, Property, Unit, UNIT_CATEGORIES, UNIT_CATEGORY_OTHER } from '../services/api';

function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const propertyId = id ? parseInt(id, 10) : NaN;
  const [property, setProperty] = useState<Property | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [formData, setFormData] = useState({
    unit_number: '',
    area: '',
    price_per_sqm: '',
    status: 'vacant' as 'vacant' | 'rented' | 'maintenance',
    category: '',
    category_other: '',
  });

  useEffect(() => {
    if (!id || isNaN(propertyId)) return;
    loadProperty();
    loadUnits();
  }, [id, propertyId]);

  const loadProperty = async () => {
    try {
      setLoading(true);
      const res = await propertiesApi.getById(propertyId);
      setProperty(res.data && typeof res.data === 'object' ? res.data : null);
    } catch (e) {
      console.error(e);
      setProperty(null);
    } finally {
      setLoading(false);
    }
  };

  const loadUnits = async () => {
    try {
      const res = await unitsApi.getAll(propertyId);
      setUnits(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      setUnits([]);
    }
  };

  const handleOpenUnitModal = (unit?: Unit) => {
    if (unit) {
      setEditingUnit(unit);
      const cat = unit.category || '';
      const isPreset = UNIT_CATEGORIES.includes(cat as typeof UNIT_CATEGORIES[number]);
      setFormData({
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
        unit_number: '',
        area: '',
        price_per_sqm: '',
        status: 'vacant',
        category: '',
        category_other: '',
      });
    }
    setShowUnitModal(true);
    document.body.classList.add('modal-open');
  };

  const handleCloseUnitModal = () => {
    setShowUnitModal(false);
    document.body.classList.remove('modal-open');
    setEditingUnit(null);
    setFormData({
      unit_number: '',
      area: '',
      price_per_sqm: '',
      status: 'vacant',
      category: '',
      category_other: '',
    });
  };

  const handleSubmitUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property) return;
    try {
      const categoryValue = formData.category === UNIT_CATEGORY_OTHER
        ? formData.category_other.trim()
        : formData.category;
      const payload = {
        property_id: property.id,
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
      handleCloseUnitModal();
      await loadUnits();
      await loadProperty();
    } catch (err) {
      console.error(err);
      alert('Ошибка сохранения юнита');
    }
  };

  const handleDeleteUnit = async (unitId: number) => {
    if (!confirm('Удалить этот юнит?')) return;
    try {
      await unitsApi.delete(unitId);
      await loadUnits();
      await loadProperty();
    } catch (e) {
      console.error(e);
      alert('Ошибка удаления юнита');
    }
  };

  if (loading && !property) {
    return <div className="card">Загрузка…</div>;
  }
  if (!property) {
    return (
      <div className="card">
        <p>Объект не найден.</p>
        <Link to="/properties" className="btn btn-primary">К списку объектов</Link>
      </div>
    );
  }

  const occupiedCount = units.filter((u) => u.status === 'rented').length;
  const monthlyRevenue = units.reduce((sum, u) => sum + (u.monthly_rent || 0), 0);

  return (
    <div>
      <div className="card property-detail-header">
        <div className="card-header">
          <div>
            <h1 className="card-title" style={{ marginBottom: '0.25rem' }}>{property.name}</h1>
            {property.address && (
              <p className="text-secondary" style={{ margin: 0, fontSize: '0.95rem' }}>{property.address}</p>
            )}
          </div>
          <div className="btn-group">
            <Link to="/properties" className="btn">← К объектам</Link>
            <Link to="/properties" state={{ openDocumentsForPropertyId: property.id }} className="btn">
              📎 Документы
            </Link>
            <Link to="/properties" state={{ editPropertyId: property.id }} className="btn btn-primary">
              Редактировать объект
            </Link>
          </div>
        </div>
        <div className="property-detail-stats">
          <span>Юнитов: <strong>{units.length}</strong></span>
          <span>Занято: <strong>{occupiedCount}</strong></span>
          <span>Доходность: <strong>{monthlyRevenue.toLocaleString('ru-RU')} ₽/мес</strong></span>
          {property.total_area != null && (
            <span>Общая площадь: <strong>{property.total_area} м²</strong></span>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Юниты объекта</h2>
          <button type="button" className="btn btn-primary" onClick={() => handleOpenUnitModal()}>
            + Добавить юнит
          </button>
        </div>
        {units.length === 0 ? (
          <p className="text-secondary">
            В этом объекте пока нет юнитов. Нажмите «Добавить юнит», чтобы создать помещение.
          </p>
        ) : (
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ minWidth: '120px' }}>Номер</th>
                  <th style={{ minWidth: '120px' }}>Категория</th>
                  <th style={{ minWidth: '100px' }}>Площадь (м²)</th>
                  <th style={{ minWidth: '120px' }}>Цена за м²</th>
                  <th style={{ minWidth: '150px' }}>Арендная плата (₽/мес)</th>
                  <th style={{ minWidth: '150px' }}>Арендатор</th>
                  <th style={{ minWidth: '120px' }}>Статус</th>
                  <th style={{ minWidth: '200px' }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {units.map((unit) => (
                  <tr key={unit.id}>
                    <td>{unit.unit_number}</td>
                    <td>{unit.category || '—'}</td>
                    <td>{unit.area}</td>
                    <td>{unit.price_per_sqm.toLocaleString('ru-RU')} ₽</td>
                    <td>{unit.monthly_rent?.toLocaleString('ru-RU') ?? '—'} ₽</td>
                    <td>{unit.tenant_name ?? '—'}</td>
                    <td>
                      <span className={`status-badge status-${unit.status}`}>
                        {unit.status === 'vacant' ? 'Свободен' : unit.status === 'rented' ? 'Арендован' : 'На ремонте'}
                      </span>
                    </td>
                    <td>
                      <div className="btn-group">
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => handleOpenUnitModal(unit)}
                        >
                          Редактировать
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => handleDeleteUnit(unit.id)}
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

      {showUnitModal && (
        <div className="modal" onClick={handleCloseUnitModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingUnit ? 'Редактировать юнит' : 'Добавить юнит в объект «' + property.name + '»'}
              </h2>
              <button type="button" className="close-btn" onClick={handleCloseUnitModal}>×</button>
            </div>
            <form onSubmit={handleSubmitUnit}>
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
                  placeholder="Например: 101, А-1"
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
                <button type="button" className="btn" onClick={handleCloseUnitModal}>Отмена</button>
                <button type="submit" className="btn btn-primary">
                  {editingUnit ? 'Сохранить' : 'Добавить юнит'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PropertyDetail;
