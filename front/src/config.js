// Настройки интерфейса.

// Адрес API. В dev-режиме и в docker compose используется значение по умолчанию:
// браузер обращается напрямую к бэкенду на localhost:8000 (CORS уже разрешает
// домены localhost:3000 и localhost:5173).
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/+$/, '');

// Рабочие часы автосервиса (локальное время машины пользователя).
// API бэкенда не ограничивает время записи, поэтому окно записи задаётся на фронтенде.
export const WORK_START = 9;   // 09:00
export const WORK_END = 19;    // 19:00
export const SLOT_STEP = 30;   // шаг сетки слотов, минут
// На сколько дней вперёд можно записаться (ограничение календаря в форме записи).
export const BOOKING_HORIZON_DAYS = 14;

// Минимальный отступ от текущего момента до ближайшего доступного слота, минут.
export const MIN_LEAD_MINUTES = 10;

// Подписи ролей в интерфейсе (значения совпадают с бэкендом: client | employee | admin).
export const ROLE_LABELS = {
  client: 'Клиент',
  employee: 'Сотрудник',
  admin: 'Администратор',
};
