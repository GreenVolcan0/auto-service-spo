// Статусы заявки. Значения совпадают с бэкендом (app/enums.py):
// new → accepted → completed → paid (штатный путь);
// из new/accepted администратор может отменить (cancelled — терминальный).
export const STATUS_META = {
  new: { label: 'Новая', badge: 'badge--new' },
  accepted: { label: 'Принята', badge: 'badge--accepted' },
  completed: { label: 'Выполнена', badge: 'badge--completed' },
  paid: { label: 'Оплачена', badge: 'badge--paid' },
  cancelled: { label: 'Отменена', badge: 'badge--cancelled' },
};

export function statusMeta(status) {
  return STATUS_META[status] || { label: status || '—', badge: '' };
}

// Фильтры списков заявок; пустая строка означает «все статусы».
export const STATUS_FILTERS = [
  { value: '', label: 'Все' },
  { value: 'new', label: 'Новые' },
  { value: 'accepted', label: 'Принятые' },
  { value: 'completed', label: 'Выполненные' },
  { value: 'paid', label: 'Оплаченные' },
  { value: 'cancelled', label: 'Отменённые' },
];

// Отменить можно только запись, по которой ещё не началась работа:
// выполненную и оплаченную отмена не касается (бэкенд отвечает 409).
const CANCELLABLE_STATUSES = ['new', 'accepted'];

export function canBeCancelled(status) {
  return CANCELLABLE_STATUSES.includes(status);
}
