import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { appointmentsApi, catalogApi, employeesApi } from '../../api/endpoints.js';
import { EmptyState } from '../../components/EmptyState.jsx';
import { SkeletonCards } from '../../components/Skeleton.jsx';
import { useToast } from '../../components/Toast.jsx';
import { BOOKING_HORIZON_DAYS } from '../../config.js';
import { fmtDate, fmtDuration, fmtMoney } from '../../utils/format.js';
import { buildSlots, freeSlotCount } from '../../utils/slots.js';

// Форма записи клиента: услуга → мастер → дата и свободный слот → подтверждение.
// Занятость мастера берётся из GET /employees/{id}/busy, пересечения дополнительно
// проверяет бэкенд (409 «Сотрудник занят…»).
function toDateInputValue(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function NewAppointmentPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [services, setServices] = useState(null);
  const [employees, setEmployees] = useState(null);
  const [loadError, setLoadError] = useState('');

  const [serviceId, setServiceId] = useState(searchParams.get('service') || '');
  const [employeeId, setEmployeeId] = useState('');
  const [day, setDay] = useState('');

  const [busySlots, setBusySlots] = useState(null);
  const [busyLoading, setBusyLoading] = useState(false);
  const [slotStart, setSlotStart] = useState(null);

  const [submitBusy, setSubmitBusy] = useState(false);
  const [error, setError] = useState('');

  // Каталог услуг и список мастеров загружаются один раз
  useEffect(() => {
    let alive = true;
    catalogApi
      .services()
      .then((data) => alive && setServices(data))
      .catch((err) => alive && setLoadError(err.message));
    employeesApi
      .list()
      .then((data) => alive && setEmployees(data))
      .catch((err) => alive && setLoadError(err.message));
    return () => {
      alive = false;
    };
  }, []);

  const service = services ? services.find((s) => String(s.id) === String(serviceId)) : null;
  const employee = employees ? employees.find((e) => String(e.id) === String(employeeId)) : null;

  // Занятость выбранного мастера на выбранный день
  const loadBusy = useCallback(
    (empId, dayValue) => {
      if (!empId || !dayValue) {
        setBusySlots(null);
        return;
      }
      let alive = true;
      setBusyLoading(true);
      employeesApi
        .busy(empId, dayValue)
        .then((data) => alive && setBusySlots(data))
        .catch((err) => {
          if (alive) {
            setBusySlots(null);
            toast(err.message, 'error');
          }
        })
        .finally(() => alive && setBusyLoading(false));
      return () => {
        alive = false;
      };
    },
    [toast],
  );

  useEffect(() => {
    setSlotStart(null);
    return loadBusy(employeeId, day);
  }, [employeeId, day, loadBusy]);

  const slots = useMemo(() => {
    if (!day || !service || busySlots === null) return null;
    return buildSlots({
      day: new Date(`${day}T00:00:00`),
      durationMin: service.duration,
      busy: busySlots,
    });
  }, [day, service, busySlots]);

  const today = new Date();
  const maxDay = new Date(today.getTime() + BOOKING_HORIZON_DAYS * 24 * 60 * 60 * 1000);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!service || !employee || !day || !slotStart) {
      setError('Выберите услугу, мастера, дату и свободное время');
      return;
    }
    setSubmitBusy(true);
    setError('');
    try {
      const created = await appointmentsApi.create({
        service_id: service.id,
        employee_id: employee.id,
        start_time: slotStart.toISOString(),
      });
      toast('Заявка создана — мастер подтвердит её в личном кабинете', 'success');
      navigate(`/appointments/${created.id}`);
    } catch (err) {
      setError(err.message);
      if (err.status === 409) {
        // слот только что заняли — перезапрашиваем занятость
        loadBusy(employeeId, day);
        setSlotStart(null);
      }
    } finally {
      setSubmitBusy(false);
    }
  };

  if (loadError) {
    return <EmptyState title="Не удалось загрузить форму записи" text={loadError} />;
  }

  if (!services || !employees) {
    return <SkeletonCards count={3} />;
  }

  const freeCount = slots ? freeSlotCount(slots) : 0;

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="page-head">
        <h1 className="page-head__title">Запись на услугу</h1>
        <p className="page-head__sub">Три шага: услуга, мастер, время.</p>
      </div>

      {error && <div className="form-banner" role="alert">{error}</div>}

      {/* Шаг 1 — услуга */}
      <section className="wizard-section">
        <div className="wizard-step-head">
          <span className="wizard-step-head__num">1</span>
          <h2>Услуга</h2>
        </div>
        {services.length === 0 ? (
          <EmptyState title="Услуг пока нет" text="Загляните позже — каталог заполняется администратором." />
        ) : (
          <div className="option-list">
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`option-card${String(serviceId) === String(s.id) ? ' option-card--on' : ''}`}
                onClick={() => setServiceId(String(s.id))}
              >
                <span className="option-card__title">{s.name}</span>
                <span className="option-card__meta">
                  {fmtDuration(s.duration)} · {fmtMoney(s.price)}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Шаг 2 — мастер */}
      <section className="wizard-section">
        <div className="wizard-step-head">
          <span className="wizard-step-head__num">2</span>
          <h2>Мастер</h2>
        </div>
        {employees.length === 0 ? (
          <EmptyState title="Нет доступных мастеров" text="Администратор ещё не добавил сотрудников." />
        ) : (
          <div className="option-list">
            {employees.map((emp) => (
              <button
                key={emp.id}
                type="button"
                className={`option-card${String(employeeId) === String(emp.id) ? ' option-card--on' : ''}`}
                onClick={() => setEmployeeId(String(emp.id))}
              >
                <span className="option-card__title">{emp.name}</span>
                <span className="option-card__meta">Мастер</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Шаг 3 — дата и время */}
      <section className="wizard-section">
        <div className="wizard-step-head">
          <span className="wizard-step-head__num">3</span>
          <h2>Дата и время</h2>
        </div>

        <div className="card card--pad">
          <label className="field" style={{ maxWidth: 220 }}>
            <span className="field__label">Дата визита</span>
            <input
              className="input"
              type="date"
              value={day}
              min={toDateInputValue(today)}
              max={toDateInputValue(maxDay)}
              onChange={(e) => setDay(e.target.value)}
            />
            <span className="field__hint">Запись открыта на {BOOKING_HORIZON_DAYS} дней вперёд</span>
          </label>

          {(!employeeId || !serviceId) && (
            <p className="muted">Сначала выберите услугу и мастера — покажем свободные слоты.</p>
          )}

          {employeeId && serviceId && day && (
            <>
              {busyLoading && <SkeletonCards count={1} />}
              {!busyLoading && slots && slots.length === 0 && (
                <p className="muted">На этот день приёма нет — услуга не помещается в рабочие часы.</p>
              )}
              {!busyLoading && slots && slots.length > 0 && (
                <>
                  {freeCount === 0 ? (
                    <p className="muted">Все слоты на этот день заняты или уже прошли. Выберите другой день.</p>
                  ) : (
                    <div className="slots">
                      {slots.map((slot) => (
                        <button
                          key={slot.label}
                          type="button"
                          className={`slot${slotStart === slot.start ? ' slot--selected' : ''}`}
                          disabled={!slot.free}
                          title={
                            !slot.free
                              ? slot.reason === 'busy'
                                ? 'Мастер занят'
                                : 'Время прошло'
                              : 'Свободно'
                          }
                          onClick={() => setSlotStart(slot.start)}
                        >
                          {slot.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="field__hint" style={{ marginTop: 10 }}>
                    Рабочие часы: 09:00–19:00. Занятые интервалы подсвечены серым.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </section>

      {/* Подтверждение */}
      <section className="wizard-section">
        <div className="wizard-step-head">
          <span className="wizard-step-head__num">4</span>
          <h2>Подтверждение</h2>
        </div>
        <div className="summary-box">
          <dl>
            <dt>Услуга</dt>
            <dd>{service ? `${service.name}, ${fmtMoney(service.price)}` : '—'}</dd>
            <dt>Мастер</dt>
            <dd>{employee ? employee.name : '—'}</dd>
            <dt>Дата</dt>
            <dd>{day ? fmtDate(`${day}T00:00:00`) : '—'}</dd>
            <dt>Время</dt>
            <dd>
              {slotStart
                ? `${String(slotStart.getHours()).padStart(2, '0')}:${String(slotStart.getMinutes()).padStart(2, '0')}`
                : '—'}
            </dd>
          </dl>
          <button className="btn btn--primary" type="submit" disabled={submitBusy || !slotStart}>
            {submitBusy ? 'Отправляем…' : 'Отправить заявку'}
          </button>
        </div>
      </section>
    </form>
  );
}
