import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { appointmentsApi } from '../../api/endpoints.js';
import { AppointmentCard } from '../../components/AppointmentCard.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { SkeletonCards } from '../../components/Skeleton.jsx';
import { STATUS_FILTERS } from '../../utils/status.js';

const PAGE_SIZE = 20;

// Заявки текущего клиента (GET /appointments/my) с фильтром по статусу
// и догрузкой следующих страниц («Показать ещё»).
export default function MyAppointmentsPage() {
  const [status, setStatus] = useState('');
  const [items, setItems] = useState(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    (nextStatus, nextOffset) => {
      setLoading(true);
      setError('');
      appointmentsApi
        .my({ status: nextStatus || undefined, limit: PAGE_SIZE, offset: nextOffset })
        .then((data) => {
          setTotal(data.total);
          setItems((prev) => {
            if (nextOffset === 0) return data.items;
            // догрузка: приклеиваем следующую страницу
            return [...(prev || []), ...data.items];
          });
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    },
    [],
  );

  useEffect(() => {
    load(status, offset);
  }, [load, status, offset]);

  const onStatus = (value) => {
    setOffset(0);
    setStatus(value);
  };

  const hasMore = items !== null && items.length < total;

  return (
    <>
      <div className="page-head">
        <h1 className="page-head__title">Мои заявки</h1>
        <p className="page-head__sub">Записи на услуги и их статусы.</p>
      </div>

      <div className="chips" style={{ marginBottom: 16 }}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={`chip${status === f.value ? ' chip--on' : ''}`}
            onClick={() => onStatus(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="empty" role="alert">
          <div className="empty__title">Не удалось загрузить заявки</div>
          <p className="empty__text">{error}</p>
        </div>
      )}

      {!error && loading && items === null && <SkeletonCards count={3} />}

      {items && items.length === 0 && !loading && (
        <EmptyState
          title="Заявок пока нет"
          text="Выберите услугу, мастера и удобное время — это займёт минуту."
          action={
            <Link className="btn btn--primary" to="/appointments/new">
              Записаться
            </Link>
          }
        />
      )}

      {items && items.length > 0 && (
        <div className="stack">
          {items.map((a) => (
            <AppointmentCard key={a.id} appointment={a} />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="row" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={loading}
          >
            {loading ? 'Загружаем…' : 'Показать ещё'}
          </button>
        </div>
      )}
    </>
  );
}
