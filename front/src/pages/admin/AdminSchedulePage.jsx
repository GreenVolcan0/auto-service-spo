import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, employeesApi } from '../../api/endpoints.js';
import { AppointmentCard } from '../../components/AppointmentCard.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { ConfirmModal } from '../../components/Modal.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { SkeletonRows } from '../../components/Skeleton.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { useToast } from '../../components/Toast.jsx';
import { fmtDateTimeShort, fmtMoney, fmtRange } from '../../utils/format.js';
import { canBeCancelled, STATUS_FILTERS } from '../../utils/status.js';

const PAGE_SIZE = 50;

// Все записи всех сотрудников (GET /admin/schedule) с фильтрами по мастеру,
// статусу и датам. Администратор может отменить любую не отменённую запись.
export default function AdminSchedulePage() {
  const toast = useToast();
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState({ employee_id: '', status: '', date_from: '', date_to: '' });
  const [items, setItems] = useState(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelBusy, setCancelBusy] = useState(false);

  useEffect(() => {
    employeesApi
      .list()
      .then(setEmployees)
      .catch(() => setEmployees([]));
  }, []);

  const load = useCallback((f, nextOffset) => {
    setLoading(true);
    setError('');
    adminApi
      .schedule({
        employee_id: f.employee_id || undefined,
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
    setFilters({ employee_id: '', status: '', date_from: '', date_to: '' });
  };

  const onCancel = async () => {
    if (!cancelTarget) return;
    setCancelBusy(true);
    try {
      await adminApi.cancelAppointment(cancelTarget.id);
      toast(`Запись №${cancelTarget.id} отменена`, 'success');
      setCancelTarget(null);
      load(filters, offset);
    } catch (err) {
      toast(err.message, 'error');
      setCancelTarget(null);
    } finally {
      setCancelBusy(false);
    }
  };

  const renderCancel = (a) =>
    canBeCancelled(a.status) ? (
      <button type="button" className="btn btn--danger btn--sm" onClick={() => setCancelTarget(a)}>
        Отменить
      </button>
    ) : null;

  return (
    <>
      <div className="page-head">
        <h1 className="page-head__title">Записи клиентов</h1>
        <p className="page-head__sub">
          Расписания всех сотрудников{items !== null ? ` · в выборке: ${total}` : ''}
        </p>
      </div>

      <div className="admin-toolbar">
        <select
          className="select"
          value={filters.employee_id}
          onChange={setFilter('employee_id')}
          aria-label="Сотрудник"
        >
          <option value="">Все сотрудники</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name}
            </option>
          ))}
        </select>
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
          <div className="empty__title">Не удалось загрузить записи</div>
          <p className="empty__text">{error}</p>
        </div>
      )}

      {!error && loading && items === null && <SkeletonRows rows={5} />}

      {items && items.length === 0 && !loading && (
        <EmptyState title="Записей нет" text="По выбранным фильтрам ничего не найдено." />
      )}

      {items && items.length > 0 && (
        <>
          {/* Таблица — на широких экранах */}
          <div className="card admin-list__table table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Когда</th>
                  <th>Клиент</th>
                  <th>Мастер</th>
                  <th>Услуга</th>
                  <th className="table__num">Сумма</th>
                  <th>Статус</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {fmtDateTimeShort(a.start_time)}
                      <br />
                      <span className="muted">{fmtRange(a.start_time, a.end_time)}</span>
                    </td>
                    <td>{a.client.name}</td>
                    <td>{a.employee.name}</td>
                    <td>{a.service.name}</td>
                    <td className="table__num">{fmtMoney(a.total_cost)}</td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="table__actions">
                      <Link className="btn btn--ghost btn--sm" to={`/appointments/${a.id}`}>
                        Открыть
                      </Link>
                      {renderCancel(a)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Карточки — на мобильных вместо таблицы */}
          <div className="admin-list__cards">
            {items.map((a) => (
              <AppointmentCard key={a.id} appointment={a} showClient actions={renderCancel(a)} />
            ))}
          </div>

          <Pagination total={total} limit={PAGE_SIZE} offset={offset} onPage={setOffset} />
        </>
      )}

      <ConfirmModal
        open={Boolean(cancelTarget)}
        title="Отменить запись"
        text={
          cancelTarget
            ? `Запись №${cancelTarget.id} (${cancelTarget.service.name}) будет отменена, время мастера освободится.`
            : ''
        }
        confirmLabel="Отменить запись"
        danger
        busy={cancelBusy}
        onConfirm={onCancel}
        onClose={() => setCancelTarget(null)}
      />
    </>
  );
}
