import { describe, expect, it } from 'vitest';
import { roleHome } from './user.js';
import { statusMeta, STATUS_FILTERS, canBeCancelled } from './status.js';

describe('roleHome', () => {
  it('клиент попадает к своим заявкам', () => {
    expect(roleHome({ role: 'client' })).toBe('/my');
  });

  it('сотрудник — в расписание', () => {
    expect(roleHome({ role: 'employee' })).toBe('/schedule');
  });

  it('администратор — в раздел записей', () => {
    expect(roleHome({ role: 'admin' })).toBe('/admin/schedule');
  });

  it('гость — на главную', () => {
    expect(roleHome(null)).toBe('/');
  });
});

describe('statusMeta', () => {
  it('возвращает подписи для всех статусов бэкенда', () => {
    expect(statusMeta('new').label).toBe('Новая');
    expect(statusMeta('accepted').label).toBe('Принята');
    expect(statusMeta('completed').label).toBe('Выполнена');
    expect(statusMeta('paid').label).toBe('Оплачена');
    expect(statusMeta('cancelled').label).toBe('Отменена');
  });

  it('каждому статусу назначен свой бейдж', () => {
    const badges = ['new', 'accepted', 'completed', 'paid', 'cancelled'].map(
      (s) => statusMeta(s).badge,
    );
    expect(new Set(badges).size).toBe(badges.length);
  });

  it('неизвестный статус не ломает интерфейс', () => {
    expect(statusMeta('weird').label).toBe('weird');
    expect(statusMeta(undefined).label).toBe('—');
  });
});

describe('STATUS_FILTERS', () => {
  it('первый фильтр — «все статусы», всего шесть фильтров', () => {
    expect(STATUS_FILTERS[0]).toEqual({ value: '', label: 'Все' });
    expect(STATUS_FILTERS).toHaveLength(6);
    expect(STATUS_FILTERS.map((f) => f.value)).toEqual([
      '',
      'new',
      'accepted',
      'completed',
      'paid',
      'cancelled',
    ]);
  });
});

describe('canBeCancelled', () => {
  it('админ отменяет только new и accepted', () => {
    expect(canBeCancelled('new')).toBe(true);
    expect(canBeCancelled('accepted')).toBe(true);
    expect(canBeCancelled('completed')).toBe(false);
    expect(canBeCancelled('paid')).toBe(false);
    expect(canBeCancelled('cancelled')).toBe(false);
  });
});
