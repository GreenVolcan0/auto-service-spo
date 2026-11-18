import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { initials, roleLabel } from '../utils/user.js';
import { IconLogout, IconMenu, IconWrench, IconX } from './icons.jsx';

// Пункты меню по роли (гость видит только главную — вход есть в шапке)
const NAV_BY_ROLE = {
  guest: [{ to: '/', label: 'Главная', end: true }],
  client: [
    { to: '/', label: 'Главная', end: true },
    { to: '/my', label: 'Мои заявки' },
    { to: '/appointments/new', label: 'Записаться' },
  ],
  employee: [{ to: '/schedule', label: 'Расписание' }],
  admin: [
    { to: '/admin/schedule', label: 'Записи' },
    { to: '/admin/employees', label: 'Сотрудники' },
    { to: '/admin/services', label: 'Услуги' },
    { to: '/admin/price-items', label: 'Прайс' },
  ],
};

export function Layout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // При переходе по ссылке мобильное меню закрывается
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const links = NAV_BY_ROLE[user ? user.role : 'guest'] || NAV_BY_ROLE.guest;

  const onLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <>
      <header className="header">
        <div className="container header__inner">
          <Link to="/" className="brand">
            <span className="brand__icon">
              <IconWrench />
            </span>
            Автосервис
          </Link>

          <nav className={`nav${menuOpen ? ' nav--open' : ''}`} aria-label="Основное меню">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`}
              >
                {l.label}
              </NavLink>
            ))}

            {user && (
              <div className="nav__user">
                <div className="nav__user-info">
                  <b>{user.name}</b>
                  <span>{roleLabel(user)}</span>
                </div>
                <div className="row">
                  <Link to="/profile" className="btn btn--ghost btn--sm">
                    Профиль
                  </Link>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={onLogout}>
                    Выйти
                  </button>
                </div>
              </div>
            )}
          </nav>

          <div className="header__side">
            {user ? (
              <>
                <Link to="/profile" className="user-chip" title="Мой профиль">
                  <span className="user-chip__avatar">{initials(user.name)}</span>
                  <span>
                    <span className="user-chip__name">{user.name}</span>
                    <span className="user-chip__role">{roleLabel(user)}</span>
                  </span>
                </Link>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={onLogout}
                  title="Выйти"
                  aria-label="Выйти"
                >
                  <IconLogout />
                </button>
              </>
            ) : (
              <>
                <Link to="/register" className="btn btn--ghost btn--sm">
                  Регистрация
                </Link>
                <Link to="/login" className="btn btn--primary btn--sm">
                  Войти
                </Link>
              </>
            )}

            <button
              type="button"
              className="icon-btn burger"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Меню"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <IconX /> : <IconMenu />}
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="container">
          <Outlet />
        </div>
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <span>Автосервис — запись на услуги</span>
          <span>
            Учебный проект. Документация API:{' '}
            <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer">
              /docs
            </a>
          </span>
        </div>
      </footer>
    </>
  );
}
