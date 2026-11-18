// Эндпоинты API (см. back/README.md). Все запросы идут с префиксом /api.

import { request } from './client.js';

function qs(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, value);
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export const authApi = {
  // Возвращает {access_token, token_type, user}
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  register: (name, email, password) =>
    request('/auth/register', { method: 'POST', body: { name, email, password }, auth: false }),
};

export const usersApi = {
  me: () => request('/users/me'),
  updateMe: (data) => request('/users/me', { method: 'PATCH', body: data }),
  changePassword: (oldPassword, newPassword) =>
    request('/users/me/password', { method: 'POST', body: { old_password: oldPassword, new_password: newPassword } }),
};

// Каталог: услуги и позиции прайса для доп. расходов
export const catalogApi = {
  priceList: () => request('/price-list', { auth: false }),
  services: () => request('/services', { auth: false }),
  priceItems: () => request('/price-items', { auth: false }),
  createService: (data) => request('/services', { method: 'POST', body: data }),
  updateService: (id, data) => request(`/services/${id}`, { method: 'PATCH', body: data }),
  deleteService: (id) => request(`/services/${id}`, { method: 'DELETE' }),
  createPriceItem: (data) => request('/price-items', { method: 'POST', body: data }),
  updatePriceItem: (id, data) => request(`/price-items/${id}`, { method: 'PATCH', body: data }),
  deletePriceItem: (id) => request(`/price-items/${id}`, { method: 'DELETE' }),
};

export const employeesApi = {
  list: () => request('/employees'),
  // day: 'YYYY-MM-DD' — занятые интервалы сотрудника на день
  busy: (employeeId, day) => request(`/employees/${employeeId}/busy?day=${day}`),
};

export const appointmentsApi = {
  create: (data) => request('/appointments', { method: 'POST', body: data }),
  // Ответы вида {items, total, limit, offset}
  my: (params) => request('/appointments/my' + qs(params)),
  schedule: (params) => request('/appointments/schedule' + qs(params)),
  get: (id) => request(`/appointments/${id}`),
  accept: (id) => request(`/appointments/${id}/accept`, { method: 'POST' }),
  // accepted → completed: итоговая сумма фиксируется, расходы больше не добавить
  complete: (id) => request(`/appointments/${id}/complete`, { method: 'POST' }),
  // completed → paid: клиент оплатил итоговую сумму
  pay: (id) => request(`/appointments/${id}/pay`, { method: 'POST' }),
  addExpense: (id, data) => request(`/appointments/${id}/expenses`, { method: 'POST', body: data }),
};

export const adminApi = {
  employees: (params) => request('/admin/employees' + qs(params)),
  createEmployee: (data) => request('/admin/employees', { method: 'POST', body: data }),
  updateEmployee: (id, data) => request(`/admin/employees/${id}`, { method: 'PATCH', body: data }),
  deleteEmployee: (id) => request(`/admin/employees/${id}`, { method: 'DELETE' }),
  schedule: (params) => request('/admin/schedule' + qs(params)),
  cancelAppointment: (id) => request(`/admin/appointments/${id}/cancel`, { method: 'POST' }),
};
