import { MAIL_FROM, NOTIFY_EMAIL, RESEND_API_KEY } from 'astro:env/server';
import { deliverBooking, type BookingNotification } from './notify';

/* Thin astro:env wrapper so notify.ts stays importable from unit tests. */
const config = () => ({ apiKey: RESEND_API_KEY, from: MAIL_FROM, staffTo: NOTIFY_EMAIL });

export function notifyBooking(booking: BookingNotification): Promise<void> {
  return deliverBooking(booking, config());
}
