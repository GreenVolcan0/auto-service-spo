import { Link } from 'react-router-dom';
import { StatusBadge } from './StatusBadge.jsx';
import { fmtDateTimeShort, fmtMoney, fmtRange } from '../utils/format.js';

// Компактная карточка заявки для списков (клиент, сотрудник, админ).
// actions — необязательные кнопки, которые рождает страница (принять, отменить…).
export function AppointmentCard({ appointment, showClient = false, actions }) {
  const a = appointment;
  return (
    <article className="card apt-card">
      <div className="apt-card__head">
        <span className="apt-card__id">Заявка №{a.id}</span>
        <StatusBadge status={a.status} />
      </div>

      <div className="apt-card__service">{a.service ? a.service.name : '—'}</div>

      <div className="apt-card__meta">
        <span>
          <b>{fmtDateTimeShort(a.start_time)}</b> · {fmtRange(a.start_time, a.end_time)}
        </span>
        <span>
          Мастер: <b>{a.employee ? a.employee.name : '—'}</b>
        </span>
        {showClient && (
          <span>
            Клиент: <b>{a.client ? a.client.name : '—'}</b>
          </span>
        )}
        <span>
          Стоимость: <b>{fmtMoney(a.total_cost)}</b>
        </span>
      </div>

      <div className="apt-card__actions">
        {actions}
        <Link className="btn btn--ghost btn--sm" to={`/appointments/${a.id}`}>
          Открыть
        </Link>
      </div>
    </article>
  );
}
