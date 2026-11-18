import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { roleHome, roleLabel } from '../utils/user.js';
import { ROLE_LABELS } from '../config.js';

// Защита маршрутов по ролям. roles === undefined — доступ любому авторизованному.
export function RequireRole({ roles, children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    // Гостя отправляем на вход, запоминая страницу, куда он хотел попасть
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    const allowed = roles.map((r) => ROLE_LABELS[r] || r).join(', ');
    return (
      <div className="empty" role="alert">
        <div className="empty__title">Нет доступа</div>
        <p className="empty__text">
          Этот раздел доступен только для роли: {allowed}. Ваша роль — {roleLabel(user)}.
        </p>
        <Link className="btn btn--primary" to={roleHome(user)}>
          Вернуться в кабинет
        </Link>
      </div>
    );
  }

  return children;
}

// Страницы входа и регистрации не нужны авторизованному пользователю.
export function GuestOnly({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to={roleHome(user)} replace />;
  return children;
}
