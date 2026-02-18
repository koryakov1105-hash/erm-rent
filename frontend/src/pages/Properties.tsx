import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { propertiesApi, Property, PropertyDocument } from '../services/api';
import AddressSuggest from '../components/AddressSuggest';

const MAX_FILE_SIZE_MB = 8;
const MAX_FILE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function Properties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    total_area: '',
  });
  const [documentsModal, setDocumentsModal] = useState<Property | null>(null);
  const [documents, setDocuments] = useState<Omit<PropertyDocument, 'content'>[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    loadProperties();
  }, []);

  useEffect(() => {
    const state = location.state as { openDocumentsForPropertyId?: number; editPropertyId?: number } | null;
    if (!state || !properties.length) return;
    let handled = false;
    if (state.openDocumentsForPropertyId) {
      const prop = properties.find((p) => p.id === state.openDocumentsForPropertyId);
      if (prop) {
        openDocumentsModal(prop);
        handled = true;
      }
    }
    if (state.editPropertyId) {
      const prop = properties.find((p) => p.id === state.editPropertyId);
      if (prop) {
        handleOpenModal(prop);
        handled = true;
      }
    }
    if (handled) {
      navigate('/properties', { replace: true, state: {} });
    }
  }, [location.state, properties, navigate]);

  const loadProperties = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await propertiesApi.getAll();
      setProperties(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error loading properties:', error);
      if (!silent) alert('Ошибка загрузки объектов');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleOpenModal = (property?: Property) => {
    if (property) {
      setEditingProperty(property);
      setFormData({
        name: property.name,
        address: property.address || '',
        total_area: property.total_area?.toString() || '',
      });
    } else {
      setEditingProperty(null);
      setFormData({
        name: '',
        address: '',
        total_area: '',
      });
    }
    setShowModal(true);
    document.body.classList.add('modal-open');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    document.body.classList.remove('modal-open');
    setEditingProperty(null);
    setFormData({
      name: '',
      address: '',
      total_area: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProperty) {
        await propertiesApi.update(editingProperty.id, {
          ...formData,
          total_area: formData.total_area ? parseFloat(formData.total_area) : undefined,
        });
      } else {
        await propertiesApi.create({
          ...formData,
          total_area: formData.total_area ? parseFloat(formData.total_area) : undefined,
        });
      }
      await loadProperties(true);
      handleCloseModal();
    } catch (error) {
      console.error('Error saving property:', error);
      alert('Ошибка сохранения объекта');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот объект?')) {
      return;
    }
    try {
      await propertiesApi.delete(id);
      await loadProperties(true);
    } catch (error) {
      console.error('Error deleting property:', error);
      alert('Ошибка удаления объекта');
    }
  };

  const openDocumentsModal = async (property: Property) => {
    setDocumentsModal(property);
    setUploadError(null);
    document.body.classList.add('modal-open');
    try {
      setDocumentsLoading(true);
      const res = await propertiesApi.getDocuments(property.id);
      setDocuments(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      setDocuments([]);
    } finally {
      setDocumentsLoading(false);
    }
  };

  const closeDocumentsModal = () => {
    setDocumentsModal(null);
    setDocuments([]);
    setUploadError(null);
    document.body.classList.remove('modal-open');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'plan' | 'document') => {
    const file = e.target.files?.[0];
    if (!file || !documentsModal) return;
    if (file.size > MAX_FILE_BYTES) {
      setUploadError(`Файл не должен превышать ${MAX_FILE_SIZE_MB} МБ`);
      return;
    }
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const content = (reader.result as string).split(',')[1];
      if (!content) {
        setUploadError('Не удалось прочитать файл');
        return;
      }
      try {
        setUploading(true);
        await propertiesApi.uploadDocument(documentsModal.id, {
          name: file.name.replace(/\.[^.]+$/, '') || file.name,
          type,
          file_name: file.name,
          mime_type: file.type || undefined,
          content,
        });
        const res = await propertiesApi.getDocuments(documentsModal.id);
        setDocuments(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error(err);
        setUploadError('Ошибка загрузки файла');
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDownload = async (doc: Omit<PropertyDocument, 'content'>) => {
    if (!documentsModal) return;
    try {
      const res = await propertiesApi.getDocument(documentsModal.id, doc.id);
      const content = res.data?.content;
      if (!content) {
        alert('Файл не найден');
        return;
      }
      const blob = new Blob([Uint8Array.from(atob(content), c => c.charCodeAt(0))], { type: doc.mime_type || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Ошибка скачивания');
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    if (!documentsModal || !confirm('Удалить этот файл?')) return;
    try {
      await propertiesApi.deleteDocument(documentsModal.id, docId);
      setDocuments(docs => docs.filter(d => d.id !== docId));
    } catch (e) {
      console.error(e);
      alert('Ошибка удаления');
    }
  };

  const formatSize = (bytes?: number) => {
    if (bytes == null) return '—';
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  if (loading) {
    return <div className="card">Загрузка...</div>;
  }

  const searchLower = searchQuery.trim().toLowerCase();
  const filteredProperties = searchLower
    ? properties.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(searchLower)) ||
          (p.address && p.address.toLowerCase().includes(searchLower))
      )
    : properties;

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h1 className="card-title">Объекты недвижимости</h1>
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            Добавить объект
          </button>
        </div>

        {properties.length > 0 && (
          <div className="filters-row">
            <input
              type="search"
              className="form-input search-input"
              placeholder="Поиск по названию или адресу..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Поиск объектов"
            />
            {searchQuery.trim() && (
              <span className="filter-hint">
                Найдено: {filteredProperties.length} из {properties.length}
              </span>
            )}
          </div>
        )}

        {properties.length === 0 ? (
          <p>Нет объектов. Создайте первый объект.</p>
        ) : (
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ minWidth: '200px' }}>Название</th>
                  <th style={{ minWidth: '250px' }}>Адрес</th>
                  <th style={{ minWidth: '140px' }}>Общая площадь (м²)</th>
                  <th style={{ minWidth: '100px' }}>Юнитов</th>
                  <th style={{ minWidth: '100px' }}>Занято</th>
                  <th style={{ minWidth: '150px' }}>Доходность (₽/мес)</th>
                  <th style={{ minWidth: '200px' }}>Действия</th>
                </tr>
              </thead>
            <tbody>
              {filteredProperties.map((property) => (
                <tr key={property.id}>
                  <td>
                    <Link to={`/properties/${property.id}`} className="property-name-link">
                      {property.name}
                    </Link>
                  </td>
                  <td>{property.address || '-'}</td>
                  <td>{property.total_area?.toLocaleString('ru-RU') || '-'}</td>
                  <td>{property.units_count || 0}</td>
                  <td>{property.occupied_units || 0}</td>
                  <td>{property.monthly_revenue?.toLocaleString('ru-RU') || 0}</td>
                  <td>
                    <div className="btn-group">
                      <button
                        className="btn"
                        onClick={() => openDocumentsModal(property)}
                        title="Планировки и документы"
                      >
                        📎 Документы
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleOpenModal(property)}
                      >
                        Редактировать
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDelete(property.id)}
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
                {editingProperty ? 'Редактировать объект' : 'Добавить объект'}
              </h2>
              <button className="close-btn" onClick={handleCloseModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Название *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Адрес</label>
                <AddressSuggest
                  value={formData.address}
                  onChange={(address) => setFormData({ ...formData, address })}
                  placeholder="Начните вводить адрес — появятся подсказки по базе РФ"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Общая площадь (м²)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.total_area}
                  onChange={(e) => setFormData({ ...formData, total_area: e.target.value })}
                />
              </div>
              <div className="btn-group" style={{ justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" className="btn" onClick={handleCloseModal}>
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingProperty ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {documentsModal && (
        <div className="modal" onClick={closeDocumentsModal}>
          <div className="modal-content property-documents-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                Планировки и документы — {documentsModal.name}
              </h2>
              <button className="close-btn" onClick={closeDocumentsModal}>×</button>
            </div>

            <div className="property-documents-upload">
              <p className="text-secondary" style={{ marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                Загрузите планировки (схемы, чертежи) или документы по объекту недвижимости. Макс. {MAX_FILE_SIZE_MB} МБ на файл.
              </p>
              <div className="btn-group">
                <label className="btn btn-primary" style={{ marginBottom: 0 }}>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.dwg,.doc,.docx"
                    style={{ display: 'none' }}
                    disabled={uploading}
                    onChange={(e) => handleFileSelect(e, 'plan')}
                  />
                  {uploading ? 'Загрузка…' : '📐 Загрузить планировку'}
                </label>
                <label className="btn btn-primary" style={{ marginBottom: 0 }}>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                    style={{ display: 'none' }}
                    disabled={uploading}
                    onChange={(e) => handleFileSelect(e, 'document')}
                  />
                  {uploading ? 'Загрузка…' : '📄 Загрузить документ'}
                </label>
              </div>
              {uploadError && (
                <p style={{ color: 'var(--color-error)', fontSize: '0.9rem', marginTop: '0.5rem' }}>{uploadError}</p>
              )}
            </div>

            <div className="property-documents-list">
              <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--color-text)' }}>Загруженные файлы</h3>
              {documentsLoading ? (
                <p className="text-secondary">Загрузка…</p>
              ) : documents.length === 0 ? (
                <p className="text-secondary">Нет загруженных файлов. Добавьте планировку или документ выше.</p>
              ) : (
                <ul className="property-documents-items">
                  {documents.map((doc) => (
                    <li key={doc.id} className="property-document-item">
                      <span className="property-document-icon">{doc.type === 'plan' ? '📐' : '📄'}</span>
                      <div className="property-document-info">
                        <span className="property-document-name">{doc.name}</span>
                        <span className="property-document-meta">
                          {doc.file_name} · {formatSize(doc.size)} · {doc.type === 'plan' ? 'Планировка' : 'Документ'}
                        </span>
                      </div>
                      <div className="btn-group">
                        <button type="button" className="btn btn-sm" onClick={() => handleDownload(doc)} title="Скачать">
                          ⬇
                        </button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteDocument(doc.id)} title="Удалить">
                          🗑
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Properties;
