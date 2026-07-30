import nodemailer from 'nodemailer';
import { NOTIFY_EMAIL, SMTP_HOST, SMTP_PASS, SMTP_PORT, SMTP_USER } from 'astro:env/server';
import { business, services, type ServiceId } from '@/config/business';
import { formatDayIt } from './dates';
import { formatEuro } from './pricing';
import type { EmergencyContact } from './rules';

export interface BookingNotification {
  readonly reference: string;
  readonly service: ServiceId;
  readonly startDay: number;
  readonly endDay: number;
  readonly priceCents: number;
  readonly dogName: string;
  readonly ownerName: string;
  readonly ownerEmail: string;
  readonly ownerPhone: string;
  readonly emergencyContacts: readonly EmergencyContact[];
  readonly notes: string;
}

function transport() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    secure: Number(SMTP_PORT ?? 587) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

function staffBody(booking: BookingNotification): string {
  const definition = services[booking.service];
  const contacts = booking.emergencyContacts
    .map((contact, index) => `  ${index + 1}. ${contact.firstName} ${contact.lastName} — ${contact.phone}`)
    .join('\n');

  return [
    `Nuova richiesta di prenotazione: ${booking.reference}`,
    '',
    `Servizio:  ${definition.name}`,
    `Consegna:  ${formatDayIt(booking.startDay)} (${definition.checkInFrom}—${definition.checkInTo})`,
    `Ritiro:    ${formatDayIt(booking.endDay)} (${definition.checkOutFrom}—${definition.checkOutTo})`,
    `Totale:    ${formatEuro(booking.priceCents)}`,
    '',
    `Cane:      ${booking.dogName}`,
    `Proprietario: ${booking.ownerName}`,
    `Telefono:  ${booking.ownerPhone}`,
    `Email:     ${booking.ownerEmail}`,
    '',
    'Contatti di emergenza:',
    contacts || '  (nessuno)',
    '',
    booking.notes ? `Note: ${booking.notes}` : '',
    '',
    'La richiesta è in attesa: confermala o rifiutala dall’area di gestione.',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

function ownerBody(booking: BookingNotification): string {
  const definition = services[booking.service];

  return [
    `Ciao ${booking.ownerName},`,
    '',
    `abbiamo ricevuto la tua richiesta per ${booking.dogName}. Non è ancora una conferma:`,
    'verifichiamo la disponibilità e ti rispondiamo, di norma entro 24 ore.',
    '',
    `Riferimento: ${booking.reference}`,
    `Servizio:    ${definition.name}`,
    `Consegna:    ${formatDayIt(booking.startDay)} (${definition.checkInFrom}—${definition.checkInTo})`,
    `Ritiro:      ${formatDayIt(booking.endDay)} (${definition.checkOutFrom}—${definition.checkOutTo})`,
    `Totale stimato: ${formatEuro(booking.priceCents)}, da saldare il giorno del check-in.`,
    '',
    'Ricorda che prima del primo soggiorno è obbligatorio il test d’ingresso, che è gratuito.',
    '',
    `${business.tradeName} — ${business.contact.personName}`,
    `${business.contact.phoneDisplay}`,
  ].join('\n');
}

/*
  Notifications must never cost a booking: the request is already committed when
  this runs, so every failure is logged and swallowed.
*/
export async function notifyBooking(booking: BookingNotification): Promise<void> {
  const mailer = transport();
  const staffTo = NOTIFY_EMAIL || business.contact.email;

  if (!mailer || !staffTo) {
    console.warn(
      `[notify] SMTP non configurato: ${booking.reference} salvata ma nessuna email inviata. ` +
        'Imposta SMTP_HOST, SMTP_USER, SMTP_PASS e NOTIFY_EMAIL.',
    );
    return;
  }

  const from = `"${business.tradeName}" <${SMTP_USER}>`;

  await Promise.allSettled([
    mailer.sendMail({
      from,
      to: staffTo,
      replyTo: booking.ownerEmail,
      subject: `Nuova richiesta ${booking.reference} — ${booking.dogName}`,
      text: staffBody(booking),
    }),
    mailer.sendMail({
      from,
      to: booking.ownerEmail,
      replyTo: staffTo,
      subject: `Richiesta ricevuta — ${booking.reference}`,
      text: ownerBody(booking),
    }),
  ]).then((results) => {
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error(`[notify] invio fallito per ${booking.reference}:`, result.reason);
      }
    }
  });
}
