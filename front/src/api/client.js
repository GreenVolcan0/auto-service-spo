// Тонкая обёртка над fetch: базовый адрес, JWT-токен, единый разбор ошибок.
//
// Контракт бэкенда: ошибки приходят как {"detail": "..."} (строка) либо как
// массив объектов валидации pydantic; при 401 токен недействителен.

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/+$/, '');

const TOKEN_KEY = 'as_token';

let token = localStorage.getItem(TOKEN_KEY);

export function setToken(value) {
  token = value || null;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getToken() {
  return token;
}

// Колбэк, который срабатывает при 401 — его устанавливает AuthContext,
// чтобы разлогинить пользователя в любом уголке приложения.
let unauthorizedHandler = null;

export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

function extractDetail(data, status) {
  const detail = data && data.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    // Ошибки валидации pydantic: склеиваем человекочитаемые сообщения
    return detail.map((e) => (e.msg || '').replace(/^Value error,\s*/, '')).join('; ');
  }
  return `Ошибка сервера (${status})`;
}

export async function request(path, { method = 'GET', body, auth = true, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch {
    // Сеть недоступна / бэкенд не запущен
    throw new ApiError('Не удалось связаться с сервером. Проверьте, что API запущен.', 0);
  }

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {
    // тело пустое или не JSON — не страшно
  }

  if (!res.ok) {
    if (res.status === 401 && auth && unauthorizedHandler) {
      unauthorizedHandler();
    }
    throw new ApiError(extractDetail(data, res.status), res.status, data ? data.detail : undefined);
  }

  return data;
}
