// Построение сетки слотов для записи к сотруднику.
//
// API бэкенда не задаёт рабочие часы — он только возвращает занятые
// интервалы (GET /employees/{id}/busy) и отклоняет пересечения (409).
// Окно записи (WORK_START..WORK_END) и шаг сетки задаются в src/config.js.

import { WORK_START, WORK_END, SLOT_STEP, MIN_LEAD_MINUTES } from '../config.js';

// Пересечение полуинтервалов [aStart, aEnd) и [bStart, bEnd).
// Интервалы «встык» (конец одного = начало другого) не пересекаются —
// та же логика проверки на бэкенде.
export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function atHours(day, hours, minutes = 0) {
  const d = new Date(day);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function label(d) {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Строит слоты записи на день.
 * @param {Date}   day         любая дата внутри нужного дня (локальное время)
 * @param {number} durationMin длительность услуги в минутах
 * @param {Array}  busy        занятые интервалы [{start_time, end_time}] в ISO
 * @param {Date}   now         «текущий момент» (для тестов передаётся явно)
 * @returns {Array<{start: Date, end: Date, label: string, free: boolean, reason: 'past'|'busy'|null}>}
 */
export function buildSlots({
  day,
  durationMin,
  busy = [],
  now = new Date(),
  workStart = WORK_START,
  workEnd = WORK_END,
  stepMin = SLOT_STEP,
  minLeadMinutes = MIN_LEAD_MINUTES,
}) {
  const duration = Math.max(1, Math.round(Number(durationMin) || 0));
  const step = Math.max(1, stepMin);
  // слот не может начинаться слишком близко к текущему моменту
  const earliest = now.getTime() + minLeadMinutes * 60000;
  const windowStart = atHours(day, workStart);
  const windowEnd = atHours(day, workEnd);

  const busyIntervals = busy.map((b) => ({
    start: new Date(b.start_time),
    end: new Date(b.end_time),
  }));

  const slots = [];
  for (
    let start = windowStart;
    start.getTime() + duration * 60000 <= windowEnd.getTime();
    start = new Date(start.getTime() + step * 60000)
  ) {
    const end = new Date(start.getTime() + duration * 60000);
    const busyHit = busyIntervals.some((b) => overlaps(start, end, b.start, b.end));
    const past = start.getTime() < earliest;
    slots.push({
      start,
      end,
      label: label(start),
      free: !busyHit && !past,
      reason: past ? 'past' : busyHit ? 'busy' : null,
    });
  }
  return slots;
}

// Количество свободных слотов — для подсказки «на этот день всё занято».
export function freeSlotCount(slots) {
  return slots.filter((s) => s.free).length;
}
