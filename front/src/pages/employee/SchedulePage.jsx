import { useCallback, useEffect, useState } from 'react';
import { appointmentsApi } from '../../api/endpoints.js';
import { AppointmentCard } from '../../components/AppointmentCard.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { SkeletonCards } from '../../components/Skeleton.jsx';
import { useToast } from '../../components/Toast.jsx';
import { STATUS_FILTERS } from '../../utils/status.js';

const PAGE_SIZE = 50;

// Расписание текущего сотрудника (GET /appointments/schedule) с фильтрами
// по статусу и датам. Из списка можно вести запись по цепочке:
// принять (new) → выполнить (accepted) → отметить оплату (completed).
export default function SchedulePage() {
  const toast = useToast();
  const [filters, setFilters] = useState({ status: '', date_from: '', date_to: '' });
  const [items, setItems] = useState(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Какая кнопка на какой карточке сейчас крутится: { id, kind: 'accept'|'complete'|'pay' }
  const [busyAction, setBusyAction] = useState(null);

  const load = useCallback((f, nextOffset) => {
    setLoading(true);
    setError('');
    appointmentsApi
      .schedule({
        status: f.status || undefined,
        date_from: f.date_from || undefined,
        date_to: f.date_to || undefined,
        limit: PAGE_SIZE,
        offset: nextOffset,
      })
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(filters, offset);
  }, [load, filters, offset]);

  const setFilter = (key) => (e) => {
    setOffset(0);
    setFilters((f) => ({ ...f, [key]: e.target.value }));
  };

  const resetFilters = () => {
    setOffset(0);
    setFilters({ status: '', date_from: '', date_to: '' });
  };

  const runAction = async (id, kind) => {
    setBusyAction({ id, kind });
    try {
      if (kind === 'accept') await appointmentsApi.accept(id);
      if (kind === 'complete') await appointmentsApi.complete(id);
      if (kind === 'pay') await appointmentsApi.pay(id);
      toast(
        kind === 'accept' ? 'Заявка принята' :
        kind === 'complete' ? 'Запись отмечена выполненной' : 'Оплата отмечена',
        'success',
      );
      load(filters, offset);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1 className="page-head__title">Моё расписание</h1>
        <p className="page-head__sub">
          {items === null ? 'Загрузка…' : `Записей в выборке: ${total}`}
        </p>
      </div>

      <div className="admin-toolbar">
        <select className="select" value={filters.status} onChange={setFilter('status')} aria-label="Статус">
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              Статус: {f.label}
            </option>
          ))}
        </select>
        <input
          className="input"
          type="date"
          value={filters.date_from}
          onChange={setFilter('date_from')}
          aria-label="Дата с"
        />
        <input
          className="input"
          type="date"
          value={filters.date_to}
          onChange={setFilter('date_to')}
          aria-label="Дата по"
        />
        <button type="button" className="btn btn--ghost btn--sm" onClick={resetFilters}>
          Сбросить
        </button>
      </div>

      {error && (
        <div className="empty" role="alert">
          <div className="empty__title">Не удалось загрузить расписание</div>
          <p className="empty__text">{error}</p>
        </div>
      )}

      {!error && loading && items === null && <SkeletonCards count={3} />}

      {items && items.length === 0 && !loading && (
        <EmptyState
          title="Записей нет"
          text="По выбранным фильтрам ничего не найдено. Новые заявки клиентов появятся здесь."
        />
      )}

      {items && items.length > 0 && (
        <div className="stack">
          {items.map((a) => {
            const busy = busyAction && busyAction.id === a.id;
            const action =
              a.status === 'new' ? (
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => runAction(a.id, 'accept')}
                  disabled={busy}
                >
                  {busy ? 'Принимаем…' : 'Принять'}
                </button>
              ) : a.status === 'accepted' ? (
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => runAction(a.id, 'complete')}
                  disabled={busy}
                >
                  {busy ? 'Сохраняем…' : 'Выполнено'}
                </button>
              ) : a.status === 'completed' ? (
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => runAction(a.id, 'pay')}
                  disabled={busy}
                >
                  {busy ? 'Сохраняем…' : 'Оплачено'}
                </button>
              ) : null;

            return (
              <AppointmentCard key={a.id} appointment={a} showClient actions={action} />
            );
          })}
        </div>
      )}

      <Pagination total={total} limit={PAGE_SIZE} offset={offset} onPage={setOffset} />
    </>
  );
}
