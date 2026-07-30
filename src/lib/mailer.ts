import { MAIL_FROM, NOTIFY_EMAIL, RESEND_API_KEY } from 'astro:env/server';
import {
  deliverBooking,
  deliverDecision,
  type BookingNotification,
  type Decision,
  type DecisionNotification,
} from './notify';

/* Thin astro:env wrapper so notify.ts stays importable from unit tests. */
const config = () => ({ apiKey: RESEND_API_KEY, from: MAIL_FROM, staffTo: NOTIFY_EMAIL });

export function notifyBooking(booking: BookingNotification): Promise<void> {
  return deliverBooking(booking, config());
}

export function notifyDecision(booking: DecisionNotification, decision: Decision): Promise<boolean> {
  return deliverDecision(booking, decision, config());
}
