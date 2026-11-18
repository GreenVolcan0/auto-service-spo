// Форматирование денег, длительности и дат для интерфейса.
// Все функции чистые — покрыты vitest-тестами.

const moneyFmt = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

const moneyFmtPrecise = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Деньги приходят числом (бэкенд сериализует Decimal в float).
// Целые суммы показываем без копеек, дробные — с двумя знаками.
export function fmtMoney(value) {
  const n = Number(value) || 0;
  const isInt = Math.abs(n - Math.round(n)) < 1e-9;
  return isInt ? moneyFmt.format(n) : moneyFmtPrecise.format(n);
}

// Длительность услуги хранится в минутах: 90 → «1 ч 30 мин».
export function fmtDuration(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m === 0) return '0 мин';
  const h = Math.floor(m / 60);
  const rest = m % 60;
  const parts = [];
  if (h > 0) parts.push(`${h} ч`);
  if (rest > 0) parts.push(`${rest} мин`);
  return parts.join(' ');
}

export function parseDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Бэкенд возвращает время в UTC (ISO со смещением) — Date сам переводит
// его в локальную зону, поэтому форматируем готовый объект Date.
const dtFull = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
});
const dtShort = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});
const dLong = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric', month: 'long', year: 'numeric',
});
const tOnly = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit', minute: '2-digit',
});

export function fmtDateTime(iso) {
  const d = parseDate(iso);
  return d ? dtFull.format(d) : '—';
}

export function fmtDateTimeShort(iso) {
  const d = parseDate(iso);
  return d ? dtShort.format(d) : '—';
}

export function fmtDate(iso) {
  const d = parseDate(iso);
  return d ? dLong.format(d) : '—';
}

export function fmtTime(iso) {
  const d = parseDate(iso);
  return d ? tOnly.format(d) : '—';
}

// Интервал визита: «14:30–15:00»
export function fmtRange(isoStart, isoEnd) {
  const a = parseDate(isoStart);
  const b = parseDate(isoEnd);
  if (!a || !b) return '—';
  return `${tOnly.format(a)}–${tOnly.format(b)}`;
}
