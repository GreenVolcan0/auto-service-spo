import { fmtDateTime } from '../utils/format.js';

// Лента статусов заявки. В API пять статусов:
// new → accepted → completed → paid (штатный путь, ведёт сотрудник);
// из new/accepted администратор может отменить (cancelled — терминальный).
// Показываем пройденные шаги и текущий; будущие не рисуем.
// Даты промежуточных переходов не фиксируются на бэкенде, поэтому у них даты нет.
export function Timeline({ appointment }) {
  const { status, created_at } = appointment;

  const path = ['Создана', 'Принята', 'Выполнена', 'Оплачена'];
  // Сколько шагов пути уже пройдено; у new создана, но ещё не подтверждена.
  const reached = { new: 0, accepted: 1, completed: 2, paid: 3 }[status] ?? 0;

  const steps = [{ key: 'created', label: path[0], date: created_at, state: 'done' }];
  for (let i = 1; i < reached; i += 1) {
    steps.push({ key: path[i], label: path[i], date: null, state: 'done' });
  }

  if (status === 'cancelled') {
    steps.push({ key: 'cancelled', label: 'Отменена', date: null, state: 'current timeline__step--danger' });
  } else {
    const current = reached === 0 ? 'Ожидает подтверждения' : path[reached];
    steps.push({ key: `current-${current}`, label: current, date: null, state: 'current' });
  }

  return (
    <div className="timeline">
      {steps.map((step) => (
        <div key={step.key} className={`timeline__step ${step.state}`.trim()}>
          <span className="timeline__dot" />
          <span className="timeline__label">{step.label}</span>
          {step.date && <span className="timeline__date">{fmtDateTime(step.date)}</span>}
        </div>
      ))}
    </div>
  );
}
