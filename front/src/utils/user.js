// Хелперы пользователя: подписи ролей и «домашняя» страница роли.

import { ROLE_LABELS } from '../config.js';

export function roleLabel(user) {
  return user ? ROLE_LABELS[user.role] || user.role : '';
}

// Куда попадает пользователь после входа в зависимости от роли.
export function roleHome(user) {
  if (!user) return '/';
  switch (user.role) {
    case 'employee':
      return '/schedule';
    case 'admin':
      return '/admin/schedule';
    default:
      return '/my';
  }
}

// Инициалы для круглого аватара в шапке: «Иван Петров» → «ИП».
export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.slice(0, 2).map((w) => (w[0] || '').toUpperCase()).join('');
}
