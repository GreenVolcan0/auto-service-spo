import { describe, expect, it } from 'vitest';
import { fmtDuration, fmtMoney } from './format.js';

describe('fmtMoney', () => {
  it('форматирует целые суммы без копеек', () => {
    expect(fmtMoney(1500)).toMatch(/1\s*500/);
    expect(fmtMoney(1500)).toContain('₽');
  });

  it('показывает копейки для дробных значений', () => {
    expect(fmtMoney(1500.5)).toMatch(/500,50/);
  });

  it('нулевая стоимость — «0 ₽»', () => {
    expect(fmtMoney(0)).toMatch(/0/);
  });
});

describe('fmtDuration', () => {
  it('только минуты', () => {
    expect(fmtDuration(30)).toBe('30 мин');
  });

  it('ровно один час', () => {
    expect(fmtDuration(60)).toBe('1 ч');
  });

  it('часы и минуты', () => {
    expect(fmtDuration(90)).toBe('1 ч 30 мин');
  });

  it('два часа', () => {
    expect(fmtDuration(120)).toBe('2 ч');
  });
});
