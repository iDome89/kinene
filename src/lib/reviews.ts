export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const BODY_MIN = 20;
export const BODY_MAX = 1200;

export type ReviewViolationCode =
  | 'missing-first-name'
  | 'missing-last-name'
  | 'invalid-email'
  | 'invalid-rating'
  | 'body-too-short'
  | 'body-too-long'
  | 'consent-not-given';

export interface ReviewViolation {
  readonly code: ReviewViolationCode;
  readonly field: string;
  readonly message: string;
}

export interface ReviewSubmission {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly dogName: string;
  readonly rating: number;
  readonly body: string;
  readonly acceptedPrivacy: boolean;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* Single place that decides how a reviewer is credited publicly. */
export function displayName(firstName: string, lastName: string): string {
  const first = firstName.trim().replace(/\s+/g, ' ');
  const surname = lastName.trim().replace(/\s+/g, ' ');

  if (first.length === 0) return surname;
  if (surname.length === 0) return first;

  return `${first} ${surname}`;
}

export function validateReview(submission: ReviewSubmission): ReviewViolation[] {
  const violations: ReviewViolation[] = [];
  const body = submission.body.trim();

  if (submission.firstName.trim().length === 0) {
    violations.push({ code: 'missing-first-name', field: 'firstName', message: 'Indica il tuo nome.' });
  }

  if (submission.lastName.trim().length === 0) {
    violations.push({
      code: 'missing-last-name',
      field: 'lastName',
      message: 'Indica il tuo cognome.',
    });
  }

  if (!EMAIL.test(submission.email.trim())) {
    violations.push({
      code: 'invalid-email',
      field: 'email',
      message: 'Indica un indirizzo email valido. Non viene pubblicato.',
    });
  }

  if (
    !Number.isInteger(submission.rating) ||
    submission.rating < RATING_MIN ||
    submission.rating > RATING_MAX
  ) {
    violations.push({
      code: 'invalid-rating',
      field: 'rating',
      message: `Assegna un voto da ${RATING_MIN} a ${RATING_MAX}.`,
    });
  }

  if (body.length < BODY_MIN) {
    violations.push({
      code: 'body-too-short',
      field: 'body',
      message: `Scrivi almeno ${BODY_MIN} caratteri.`,
    });
  } else if (body.length > BODY_MAX) {
    violations.push({
      code: 'body-too-long',
      field: 'body',
      message: `Il testo non può superare ${BODY_MAX} caratteri.`,
    });
  }

  if (!submission.acceptedPrivacy) {
    violations.push({
      code: 'consent-not-given',
      field: 'acceptedPrivacy',
      message: 'Devi acconsentire alla pubblicazione della recensione per procedere.',
    });
  }

  return violations;
}

export interface RatingSummary {
  readonly count: number;
  readonly average: number;
  readonly distribution: readonly number[];
}

export function summarise(ratings: readonly number[]): RatingSummary {
  const distribution = new Array<number>(RATING_MAX).fill(0);
  let total = 0;

  for (const rating of ratings) {
    if (!Number.isInteger(rating) || rating < RATING_MIN || rating > RATING_MAX) continue;
    distribution[rating - 1] = (distribution[rating - 1] ?? 0) + 1;
    total += rating;
  }

  const count = distribution.reduce((sum, value) => sum + value, 0);
  /* One decimal is what review widgets show, and avoids 4.333333 in the schema. */
  const average = count === 0 ? 0 : Math.round((total / count) * 10) / 10;

  return { count, average, distribution };
}
