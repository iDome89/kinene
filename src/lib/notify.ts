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

export interface Message {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly replyTo?: string;
}

const ENDPOINT = 'https://api.resend.com/emails';

export async function sendMessage(message: Message, apiKey: string, from: string): Promise<string> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      ...(message.replyTo ? { reply_to: message.replyTo } : {}),
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { id?: string; message?: string; name?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? `Resend ha risposto ${response.status}`);
  }
  return payload?.id ?? 'unknown';
}

export function staffMessage(booking: BookingNotification): Message {
  const definition = services[booking.service];
  const contacts = booking.emergencyContacts
    .map((contact, index) => `  ${index + 1}. ${contact.firstName} ${contact.lastName} — ${contact.phone}`)
    .join('\n');

  return {
    to: '',
    replyTo: booking.ownerEmail,
    subject: `Nuova richiesta ${booking.reference} — ${booking.dogName}`,
    text: [
      `Nuova richiesta di prenotazione: ${booking.reference}`,
      '',
      `Servizio:  ${definition.name}`,
      `Consegna:  ${formatDayIt(booking.startDay)} (${definition.checkInFrom}—${definition.checkInTo})`,
      `Ritiro:    ${formatDayIt(booking.endDay)} (${definition.checkOutFrom}—${definition.checkOutTo})`,
      `Totale:    ${formatEuro(booking.priceCents)}`,
      '',
      `Cane:         ${booking.dogName}`,
      `Proprietario: ${booking.ownerName}`,
      `Telefono:     ${booking.ownerPhone}`,
      `Email:        ${booking.ownerEmail}`,
      '',
      'Contatti di emergenza:',
      contacts || '  (nessuno)',
      ...(booking.notes ? ['', `Note: ${booking.notes}`] : []),
      '',
      'La richiesta è in attesa: confermala o rifiutala dall’area di gestione.',
    ].join('\n'),
  };
}

export function ownerMessage(booking: BookingNotification): Message {
  const definition = services[booking.service];

  return {
    to: booking.ownerEmail,
    subject: `Richiesta ricevuta — ${booking.reference}`,
    text: [
      `Ciao ${booking.ownerName},`,
      '',
      `abbiamo ricevuto la tua richiesta per ${booking.dogName}. Non è ancora una conferma:`,
      'verifichiamo la disponibilità e ti rispondiamo, di norma entro 24 ore.',
      '',
      `Riferimento:    ${booking.reference}`,
      `Servizio:       ${definition.name}`,
      `Consegna:       ${formatDayIt(booking.startDay)} (${definition.checkInFrom}—${definition.checkInTo})`,
      `Ritiro:         ${formatDayIt(booking.endDay)} (${definition.checkOutFrom}—${definition.checkOutTo})`,
      `Totale stimato: ${formatEuro(booking.priceCents)}, da saldare il giorno del check-in.`,
      '',
      'Ricorda che prima del primo soggiorno è obbligatorio il test d’ingresso, che è gratuito.',
      '',
      `${business.tradeName} — ${business.contact.personName}`,
      business.contact.phoneDisplay,
    ].join('\n'),
  };
}

export interface MailConfig {
  readonly apiKey: string | undefined;
  readonly from: string | undefined;
  readonly staffTo: string | undefined;
}

/*
  Notifications must never cost a booking: the request is already committed when
  this runs, so every failure is logged and swallowed.
*/
export async function deliverBooking(booking: BookingNotification, config: MailConfig): Promise<void> {
  const staffTo = config.staffTo || business.contact.email;

  if (!config.apiKey || !config.from || !staffTo) {
    console.warn(
      `[notify] Resend non configurato: ${booking.reference} salvata ma nessuna email inviata. ` +
        'Imposta RESEND_API_KEY, MAIL_FROM e NOTIFY_EMAIL.',
    );
    return;
  }

  const outbound: Message[] = [{ ...staffMessage(booking), to: staffTo }, ownerMessage(booking)];

  const results = await Promise.allSettled(
    outbound.map((message) => sendMessage(message, config.apiKey!, config.from!)),
  );

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(
        `[notify] invio a ${outbound[index]!.to} fallito per ${booking.reference}:`,
        result.reason instanceof Error ? result.reason.message : result.reason,
      );
    }
  });
}
