import { describe, expect, it } from 'vitest';
import { buildSlots, overlaps } from './slots.js';

// День тестов — 10 июня 2030 (будущее), «сейчас» — 02:00 того же дня,
// чтобы ни один слот не попал в «прошлое».
const DAY = new Date(2030, 5, 10);
const NOW = new Date(2030, 5, 10, 2, 0);

function isoLocal(hours, minutes) {
  return new Date(2030, 5, 10, hours, minutes).toISOString();
}

describe('buildSlots', () => {
  it('строит сетку от начала рабочего дня с заданным шагом', () => {
    const slots = buildSlots({ day: DAY, durationMin: 30, busy: [], now: NOW });
    expect(slots[0].label).toBe('09:00');
    expect(slots[1].label).toBe('09:30');
    // последний слот: конец (старт + 30 мин) не позже 19:00
    expect(slots[slots.length - 1].label).toBe('18:30');
    expect(slots.every((s) => s.free)).toBe(true);
  });

  it('не выпускает слоты за пределы рабочего дня при длинной услуге', () => {
    const slots = buildSlots({ day: DAY, durationMin: 90, busy: [], now: NOW });
    // 17:30 + 90 мин = 19:00 — последний возможный старт
    expect(slots[slots.length - 1].label).toBe('17:30');
  });

  it('помечает занятые интервалы (включая частичное пересечение)', () => {
    const slots = buildSlots({
      day: DAY,
      durationMin: 30,
      busy: [{ start_time: isoLocal(10, 0), end_time: isoLocal(11, 0) }],
      now: NOW,
    });
    const busyLabels = slots.filter((s) => !s.free).map((s) => s.label);
    expect(busyLabels).toEqual(['10:00', '10:30']);
    expect(slots.find((s) => s.label === '09:30').free).toBe(true);
    expect(slots.find((s) => s.label === '11:00').free).toBe(true);
  });

  it('исключает слоты слишком близко к текущему моменту', () => {
    const now = new Date(2030, 5, 10, 12, 0); // «сейчас» 12:00, минимальный отступ 10 мин
    const slots = buildSlots({ day: DAY, durationMin: 30, busy: [], now });
    const past = slots.filter((s) => s.reason === 'past').map((s) => s.label);
    // всё, что начинается раньше 12:10 — недоступно
    expect(past).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00']);
    expect(slots.find((s) => s.label === '12:30').free).toBe(true);
  });

  it('слот, который не влезает до конца рабочего дня, не строится', () => {
    const slots = buildSlots({ day: DAY, durationMin: 120, busy: [], now: NOW });
    const labels = slots.map((s) => s.label);
    expect(labels).not.toContain('18:00'); // 18:00 + 120 мин > 19:00
    expect(labels[labels.length - 1]).toBe('17:00');
  });
});

describe('overlaps', () => {
  it('интервалы встык не пересекаются', () => {
    const a1 = new Date(2030, 5, 10, 10);
    const a2 = new Date(2030, 5, 10, 11);
    const b1 = new Date(2030, 5, 10, 11);
    const b2 = new Date(2030, 5, 10, 12);
    expect(overlaps(a1, a2, b1, b2)).toBe(false);
  });

  it('частичное пересечение обнаруживается', () => {
    const a1 = new Date(2030, 5, 10, 10);
    const a2 = new Date(2030, 5, 10, 11);
    const b1 = new Date(2030, 5, 10, 10, 30);
    const b2 = new Date(2030, 5, 10, 11, 30);
    expect(overlaps(a1, a2, b1, b2)).toBe(true);
  });
});
