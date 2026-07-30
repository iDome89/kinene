import { describe, expect, it } from 'vitest';
import {
  BODY_MAX,
  BODY_MIN,
  displayName,
  summarise,
  validateReview,
  type ReviewSubmission,
  type ReviewViolationCode,
} from '@/lib/reviews';

function submission(overrides: Partial<ReviewSubmission> = {}): ReviewSubmission {
  return {
    firstName: 'Marco',
    lastName: 'Rossi',
    email: 'marco@example.com',
    dogName: 'Ares',
    rating: 5,
    body: 'Struttura pulita e Valeria molto competente, il cane è tornato sereno.',
    acceptedPrivacy: true,
    ...overrides,
  };
}

const codes = (input: ReviewSubmission): ReviewViolationCode[] =>
  validateReview(input).map((violation) => violation.code);

describe('displayName', () => {
  it('publishes the full name', () => {
    expect(displayName('Marco', 'Rossi')).toBe('Marco Rossi');
  });

  it('keeps compound names intact', () => {
    expect(displayName('Anna Maria', 'De Luca')).toBe('Anna Maria De Luca');
  });

  it('collapses stray whitespace', () => {
    expect(displayName('  Marco  ', '  Rossi  ')).toBe('Marco Rossi');
    expect(displayName('Anna   Maria', 'De   Luca')).toBe('Anna Maria De Luca');
  });

  it('copes with a missing half rather than emitting a dangling space', () => {
    expect(displayName('Marco', '')).toBe('Marco');
    expect(displayName('', 'Rossi')).toBe('Rossi');
    expect(displayName('', '')).toBe('');
    expect(displayName('   ', '   ')).toBe('');
  });

  it('preserves accented and non-latin characters', () => {
    expect(displayName('Niccolò', 'Dall’Ara')).toBe('Niccolò Dall’Ara');
    expect(displayName('Zoë', 'Müller')).toBe('Zoë Müller');
  });
});

describe('validateReview', () => {
  it('accepts a complete submission', () => {
    expect(validateReview(submission())).toEqual([]);
  });

  it('requires a name and a surname', () => {
    expect(codes(submission({ firstName: '' }))).toContain('missing-first-name');
    expect(codes(submission({ lastName: '  ' }))).toContain('missing-last-name');
  });

  it('requires a plausible email', () => {
    for (const email of ['', 'marco', 'marco@', 'marco@example', '@example.com']) {
      expect(codes(submission({ email })), email).toContain('invalid-email');
    }
  });

  it('accepts only whole ratings from one to five', () => {
    for (const rating of [1, 2, 3, 4, 5]) {
      expect(codes(submission({ rating }))).not.toContain('invalid-rating');
    }
    for (const rating of [0, 6, -1, 4.5, Number.NaN]) {
      expect(codes(submission({ rating })), String(rating)).toContain('invalid-rating');
    }
  });

  it('rejects a review that is too short to be useful', () => {
    expect(codes(submission({ body: 'Bravi' }))).toContain('body-too-short');
    expect(codes(submission({ body: 'x'.repeat(BODY_MIN - 1) }))).toContain('body-too-short');
    expect(codes(submission({ body: 'x'.repeat(BODY_MIN) }))).not.toContain('body-too-short');
  });

  it('rejects a review that is too long', () => {
    expect(codes(submission({ body: 'x'.repeat(BODY_MAX + 1) }))).toContain('body-too-long');
    expect(codes(submission({ body: 'x'.repeat(BODY_MAX) }))).not.toContain('body-too-long');
  });

  it('measures length after trimming, so padding cannot fake it', () => {
    expect(codes(submission({ body: `   ${'x'.repeat(5)}   ` }))).toContain('body-too-short');
  });

  it('requires consent to publish', () => {
    expect(codes(submission({ acceptedPrivacy: false }))).toContain('consent-not-given');
  });

  it('reports every problem at once', () => {
    const found = codes(submission({ firstName: '', email: 'nope', rating: 9, body: '' }));
    expect(found).toEqual(
      expect.arrayContaining(['missing-first-name', 'invalid-email', 'invalid-rating', 'body-too-short']),
    );
  });
});

describe('summarise', () => {
  it('averages to one decimal', () => {
    expect(summarise([5, 4, 4])).toMatchObject({ count: 3, average: 4.3 });
    expect(summarise([5, 5, 5, 5])).toMatchObject({ count: 4, average: 5 });
  });

  it('counts each star band', () => {
    expect(summarise([5, 5, 4, 1]).distribution).toEqual([1, 0, 0, 1, 2]);
  });

  it('returns zeroes for no reviews rather than NaN', () => {
    const empty = summarise([]);
    expect(empty).toMatchObject({ count: 0, average: 0 });
    expect(empty.distribution).toEqual([0, 0, 0, 0, 0]);
    expect(Number.isNaN(empty.average)).toBe(false);
  });

  it('ignores values outside the scale instead of skewing the average', () => {
    expect(summarise([5, 5, 0, 9, 3.5])).toMatchObject({ count: 2, average: 5 });
  });
});
