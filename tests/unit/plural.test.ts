import { describe, expect, it } from 'vitest';
import { plural, pluralWord } from '@/lib/plural';
import { maxDurationLabel, serviceList } from '@/config/business';

describe('plural', () => {
  it('uses the singular for exactly one, which is the case that was wrong', () => {
    expect(plural(1, 'cane', 'cani')).toBe('1 cane');
  });

  it('uses the plural for zero and for many, as Italian does', () => {
    expect(plural(0, 'cane', 'cani')).toBe('0 cani');
    expect(plural(2, 'cane', 'cani')).toBe('2 cani');
    expect(plural(11, 'posto libero', 'posti liberi')).toBe('11 posti liberi');
  });

  it('exposes the bare word for sentences that place the number elsewhere', () => {
    expect(pluralWord(1, 'cane', 'cani')).toBe('cane');
    expect(pluralWord(3, 'cane', 'cani')).toBe('cani');
  });
});

describe('maxDurationLabel rebuilt on the helper', () => {
  it('still reads exactly as before for every service', () => {
    const labels = Object.fromEntries(serviceList.map((service) => [service.id, maxDurationLabel(service)]));
    expect(labels).toEqual({
      'asilo-diurno': '1 giorno',
      'asilo-notturno': '1 notte',
      pensione: '14 notti',
    });
  });
});
