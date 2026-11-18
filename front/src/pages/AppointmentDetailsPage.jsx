import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { adminApi, appointmentsApi, catalogApi } from '../api/endpoints.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { AppointmentCard } from '../components/AppointmentCard.jsx';
import { ConfirmModal, Modal } from '../components/Modal.jsx';
import { SkeletonCards } from '../components/Skeleton.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { Timeline } from '../components/Timeline.jsx';
import { useToast } from '../components/Toast.jsx';
import { fmtDate, fmtDateTime, fmtDuration, fmtMoney, fmtRange } from '../utils/format.js';
import { canBeCancelled } from '../utils/status.js';

// Карточка заявки — общий экран для клиента, сотрудника и администратора.
// Бэкенд сам определяет, кому показывать запись (владелец, назначенный мастер, админ).
export default function AppointmentDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();

  const [appointment, setAppointment] = useState(null);
  const [loadError, setError] = useState('');

  // --- действия сотрудника ---
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeBusy, setCompleteBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const [priceItems, setPriceItems] = useState([]);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseItemId, setExpenseItemId] = useState('');
  const [expenseQty, setExpenseQty] = useState(1);
  const [expenseBusy, setExpenseBusy] = useState(false);
  const [expenseError, setExpenseError] = useState('');

  // --- действие администратора ---
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);

  const load = useCallback(() => {
    let alive = true;
    appointmentsApi
      .get(id)
      .then((data) => alive && setAppointment(data))
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    setAppointment(null);
    setError('');
    return load();
  }, [load]);

  // Позиции прайса нужны сотруднику для формы «добавить расход»
  useEffect(() => {
    if (user.role !== 'employee') return undefined;
    catalogApi
      .priceItems()
      .then(setPriceItems)
      .catch(() => setPriceItems([]));
    return undefined;
  }, [user.role]);

  const isEmployee = user.role === 'employee';
  const isAdmin = user.role === 'admin';
  const canAccept = isEmployee && appointment && appointment.status === 'new';
  const canComplete = isEmployee && appointment && appointment.status === 'accepted';
  const canPay = isEmployee && appointment && appointment.status === 'completed';
  const canAddExpense = canComplete;
  const canCancel = isAdmin && appointment && canBeCancelled(appointment.status);

  const onAccept = async () => {
    setAcceptBusy(true);
    try {
      const updated = await appointmentsApi.accept(id);
      setAppointment(updated);
      toast('Заявка принята', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setAcceptBusy(false);
    }
  };

  const openExpense = () => {
    setExpenseItemId(priceItems.length > 0 ? String(priceItems[0].id) : '');
    setExpenseQty(1);
    setExpenseError('');
    setExpenseOpen(true);
  };

  const onAddExpense = async (e) => {
    e.preventDefault();
    const qty = Number(expenseQty);
    if (!expenseItemId) {
      setExpenseError('Выберите позицию прайса');
      return;
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > 1000) {
      setExpenseError('Количество — целое число от 1 до 1000');
      return;
    }
    setExpenseBusy(true);
    setExpenseError('');
    try {
      const updated = await appointmentsApi.addExpense(id, {
        price_item_id: Number(expenseItemId),
        quantity: qty,
      });
      setAppointment(updated);
      setExpenseOpen(false);
      toast('Расход добавлен', 'success');
    } catch (err) {
      setExpenseError(err.message);
    } finally {
      setExpenseBusy(false);
    }
  };

  const onComplete = async () => {
    setCompleteBusy(true);
    try {
      const updated = await appointmentsApi.complete(id);
      setAppointment(updated);
      setCompleteOpen(false);
      toast('Запись отмечена выполненной', 'success');
    } catch (err) {
      toast(err.message, 'error');
      setCompleteOpen(false);
    } finally {
      setCompleteBusy(false);
    }
  };

  const onPay = async () => {
    setPayBusy(true);
    try {
      const updated = await appointmentsApi.pay(id);
      setAppointment(updated);
      setPayOpen(false);
      toast('Оплата отмечена', 'success');
    } catch (err) {
      toast(err.message, 'error');
      setPayOpen(false);
    } finally {
      setPayBusy(false);
    }
  };

  const onCancel = async () => {
    setCancelBusy(true);
    try {
      const updated = await adminApi.cancelAppointment(id);
      setAppointment(updated);
      setCancelOpen(false);
      toast('Запись отменена', 'success');
    } catch (err) {
      toast(err.message, 'error');
      setCancelOpen(false);
    } finally {
      setCancelBusy(false);
    }
  };

  if (loadError) {
    return (
      <div className="empty" role="alert">
        <div className="empty__title">Не удалось открыть заявку</div>
        <p className="empty__text">{loadError}</p>
      </div>
    );
  }

  if (!appointment) {
    return <SkeletonCards count={2} />;
  }

  const a = appointment;

  return (
    <>
      <div className="page-head flex-between">
        <div>
          <h1 className="page-head__title">Заявка №{a.id}</h1>
          <p className="page-head__sub">Создана {fmtDateTime(a.created_at)}</p>
        </div>
        <StatusBadge status={a.status} />
      </div>

      <div className="stack">
        <div className="card card--pad">
          <Timeline appointment={a} />
          <div className="detail-grid" style={{ marginTop: 14 }}>
            <div className="detail-grid__item">
              <div className="detail-grid__label">Услуга</div>
              <div className="detail-grid__value">
                {a.service.name} · {fmtDuration(a.service.duration)}
              </div>
            </div>
            <div className="detail-grid__item">
              <div className="detail-grid__label">Дата визита</div>
              <div className="detail-grid__value">{fmtDate(a.start_time)}</div>
            </div>
            <div className="detail-grid__item">
              <div className="detail-grid__label">Время</div>
              <div className="detail-grid__value">{fmtRange(a.start_time, a.end_time)}</div>
            </div>
            <div className="detail-grid__item">
              <div className="detail-grid__label">Мастер</div>
              <div className="detail-grid__value">{a.employee.name}</div>
            </div>
            <div className="detail-grid__item">
              <div className="detail-grid__label">Клиент</div>
              <div className="detail-grid__value">{a.client.name}</div>
            </div>
          </div>
        </div>

        <div className="card card--pad">
          <h2>Стоимость</h2>
          <table className="costs">
            <tbody>
              <tr>
                <td>
                  Услуга «{a.service.name}»
                </td>
                <td className="num">{fmtMoney(a.service.price)}</td>
              </tr>
              {a.extra_expenses.map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.price_item.name} × {e.quantity}
                  </td>
                  <td className="num">{fmtMoney(e.total)}</td>
                </tr>
              ))}
              <tr className="costs__total">
                <td>Итого</td>
                <td className="num">{fmtMoney(a.total_cost)}</td>
              </tr>
            </tbody>
          </table>

          {canAddExpense && (
            <div className="row" style={{ marginTop: 14 }}>
              <button type="button" className="btn btn--outline btn--sm" onClick={openExpense}>
                Добавить расход
              </button>
              <span className="muted" style={{ fontSize: 13 }}>
                Расходы добавляются только к принятой заявке — после отметки «Выполнена» сумма фиксируется.
              </span>
            </div>
          )}
        </div>

        {(canAccept || canComplete || canPay || canCancel) && (
          <div className="row">
            {canAccept && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={onAccept}
                disabled={acceptBusy}
              >
                {acceptBusy ? 'Принимаем…' : 'Принять заявку'}
              </button>
            )}
            {canComplete && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setCompleteOpen(true)}
              >
                Отметить выполненной
              </button>
            )}
            {canPay && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setPayOpen(true)}
              >
                Отметить оплату
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => setCancelOpen(true)}
              >
                Отменить запись
              </button>
            )}
          </div>
        )}
      </div>

      <Modal
        open={expenseOpen}
        title={`Расход к заявке №${a.id}`}
        onClose={() => setExpenseOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setExpenseOpen(false)}
              disabled={expenseBusy}
            >
              Отмена
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={onAddExpense}
              disabled={expenseBusy || priceItems.length === 0}
            >
              {expenseBusy ? 'Добавляем…' : 'Добавить'}
            </button>
          </>
        }
      >
        {priceItems.length === 0 ? (
          <p>В прайсе нет позиций для доп. расходов. Попросите администратора добавить их.</p>
        ) : (
          <form onSubmit={onAddExpense}>
            <label className="field">
              <span className="field__label">Позиция прайса</span>
              <select
                className="select"
                value={expenseItemId}
                onChange={(e) => setExpenseItemId(e.target.value)}
              >
                {priceItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {fmtMoney(item.price)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Количество</span>
              <input
                className="input"
                type="number"
                min="1"
                max="1000"
                step="1"
                value={expenseQty}
                onChange={(e) => setExpenseQty(e.target.value)}
              />
            </label>
            {expenseError && <div className="field__error" role="alert">{expenseError}</div>}
          </form>
        )}
      </Modal>

      <ConfirmModal
        open={completeOpen}
        title="Отметить выполненной"
        text={`Запись №${a.id} (${a.service.name}) будет отмечена выполненной. Итоговая сумма ${fmtMoney(a.total_cost)} зафиксируется — добавить расходы больше не получится.`}
        confirmLabel="Отметить выполненной"
        busy={completeBusy}
        onConfirm={onComplete}
        onClose={() => setCompleteOpen(false)}
      />

      <ConfirmModal
        open={payOpen}
        title="Отметить оплату"
        text={`Клиент оплатил ${fmtMoney(a.total_cost)} по записи №${a.id}? Статус сменится на «Оплачена».`}
        confirmLabel="Отметить оплату"
        busy={payBusy}
        onConfirm={onPay}
        onClose={() => setPayOpen(false)}
      />

      <ConfirmModal
        open={cancelOpen}
        title="Отменить запись"
        text={`Запись №${a.id} (${a.service.name}, ${fmtDate(a.start_time)}) будет отменена, время мастера освободится. Клиент увидит статус «Отменена».`}
        confirmLabel="Отменить запись"
        danger
        busy={cancelBusy}
        onConfirm={onCancel}
        onClose={() => setCancelOpen(false)}
      />
    </>
  );
}
