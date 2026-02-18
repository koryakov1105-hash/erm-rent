import { Link, useLocation } from 'react-router-dom';

const PATH_LABELS: Record<string, string> = {
  '': 'Главная',
  properties: 'Объекты',
  units: 'Юниты',
  tenants: 'Арендаторы',
  leases: 'Договоры',
  finance: 'Финансы',
  profile: 'Профиль пользователя',
  settings: 'Профиль пользователя',
};

export default function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter(Boolean);

  if (pathnames.length === 0) return null; // Главная — без крошек

  const items = pathnames.map((segment, i) => {
    const path = '/' + pathnames.slice(0, i + 1).join('/');
    const prev = pathnames[i - 1];
    let label = PATH_LABELS[segment];
    if (label === undefined && /^\d+$/.test(segment)) {
      label = prev === 'properties' ? 'Детали объекта' : prev === 'units' ? 'Детали' : segment;
    }
    if (label === undefined) label = segment;
    return { path, label };
  });

  return (
    <nav className="breadcrumbs" aria-label="Навигация">
      <Link to="/">Главная</Link>
      {items.map((item, i) => (
        <span key={item.path}>
          <span className="breadcrumbs-sep">/</span>
          {i === items.length - 1 ? (
            <span className="breadcrumbs-current">{item.label}</span>
          ) : (
            <Link to={item.path}>{item.label}</Link>
          )}
        </span>
      ))}
    </nav>
  );
}
