import { business, policy, services, type ServiceId } from '@/config/business';
import { formatDayIt } from './dates';
import { plural } from './plural';
import { formatEuro } from './pricing';
import type { EmergencyContact } from './rules';

export interface BookingNotification {
  readonly reference: string;
  readonly service: ServiceId;
  readonly startDay: number;
  readonly endDay: number;
  readonly priceCents: number;
  readonly dogNames: readonly string[];
  readonly sharedSpace: boolean;
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

/* "Ares" per un cane, "Ares e Nala" per due: la stessa frase deve reggere entrambi. */
function dogList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? 'il cane';
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}

function spaceNote(names: readonly string[], sharedSpace: boolean): string[] {
  if (names.length < 2) return [];
  return [
    `Cani:        ${plural(names.length, 'cane', 'cani')}, ${
      sharedSpace ? 'nello stesso spazio' : 'in spazi separati'
    }`,
  ];
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
    subject: `Nuova richiesta ${booking.reference} — ${dogList(booking.dogNames)}`,
    text: [
      `Nuova richiesta di prenotazione: ${booking.reference}`,
      '',
      `Servizio:  ${definition.name}`,
      `Consegna:  ${formatDayIt(booking.startDay)} (${definition.checkInFrom}—${definition.checkInTo})`,
      `Ritiro:    ${formatDayIt(booking.endDay)} (${definition.checkOutFrom}—${definition.checkOutTo})`,
      `Totale:    ${formatEuro(booking.priceCents)}`,
      '',
      `Cane:         ${dogList(booking.dogNames)}`,
      ...spaceNote(booking.dogNames, booking.sharedSpace),
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
      `abbiamo ricevuto la tua richiesta per ${dogList(booking.dogNames)}. Non è ancora una conferma:`,
      'verifichiamo la disponibilità e ti rispondiamo, di norma entro 24 ore.',
      '',
      `Riferimento:    ${booking.reference}`,
      `Servizio:       ${definition.name}`,
      `Consegna:       ${formatDayIt(booking.startDay)} (${definition.checkInFrom}—${definition.checkInTo})`,
      `Ritiro:         ${formatDayIt(booking.endDay)} (${definition.checkOutFrom}—${definition.checkOutTo})`,
      `Totale stimato: ${formatEuro(booking.priceCents)}, da saldare il giorno del check-in.`,
      '',
      `Ricorda che il test d’ingresso è obbligatorio e gratuito, e va fatto almeno ${policy.intakeTestNoticeDays} giorni prima del soggiorno.`,
      '',
      `${business.tradeName} — ${business.contact.personName}`,
      business.contact.phoneDisplay,
    ].join('\n'),
  };
}

export type Decision = 'confirmed' | 'rejected' | 'cancelled';

export interface DecisionNotification {
  readonly reference: string;
  readonly service: ServiceId;
  readonly startDay: number;
  readonly endDay: number;
  readonly priceCents: number;
  readonly dogNames: readonly string[];
  readonly sharedSpace: boolean;
  readonly ownerName: string;
  readonly ownerEmail: string;
  readonly intakeTestPassed: boolean;
  readonly staffNote: string;
}

export function decisionMessage(booking: DecisionNotification, decision: Decision): Message {
  const definition = services[booking.service];
  const when = [
    `Riferimento: ${booking.reference}`,
    `Servizio:    ${definition.name}`,
    ...spaceNote(booking.dogNames, booking.sharedSpace),
    `Consegna:    ${formatDayIt(booking.startDay)} (${definition.checkInFrom}—${definition.checkInTo})`,
    `Ritiro:      ${formatDayIt(booking.endDay)} (${definition.checkOutFrom}—${definition.checkOutTo})`,
  ];

  const signature = ['', `${business.tradeName} — ${business.contact.personName}`, business.contact.phoneDisplay];
  const note = booking.staffNote ? ['', `Nota: ${booking.staffNote}`] : [];

  if (decision === 'confirmed') {
    return {
      to: booking.ownerEmail,
      subject: `Prenotazione confermata — ${booking.reference}`,
      text: [
        `Ciao ${booking.ownerName},`,
        '',
        `la prenotazione per ${dogList(booking.dogNames)} è confermata.`,
        '',
        ...when,
        `Totale:      ${formatEuro(booking.priceCents)}, da saldare il giorno del check-in.`,
        '',
        'Cosa portare: libretto sanitario aggiornato, il cibo abituale con il misurino e, se vuoi,',
        'una coperta o un gioco con l’odore di casa.',
        ...(booking.intakeTestPassed
          ? []
          : [
              '',
              `Ricorda che il test d’ingresso è obbligatorio, gratuito e va fatto almeno ${policy.intakeTestNoticeDays} giorni prima del soggiorno:`,
              'contattaci per fissarlo se non l’hai ancora fatto.',
            ]),
        ...note,
        ...signature,
      ].join('\n'),
    };
  }

  if (decision === 'rejected') {
    return {
      to: booking.ownerEmail,
      subject: `Prenotazione non accettata — ${booking.reference}`,
      text: [
        `Ciao ${booking.ownerName},`,
        '',
        `purtroppo non possiamo accettare la richiesta per ${dogList(booking.dogNames)} nelle date indicate.`,
        '',
        ...when,
        ...note,
        '',
        'Se vuoi provare con date diverse o capire meglio il motivo, scrivici o chiamaci: ne parliamo.',
        ...signature,
      ].join('\n'),
    };
  }

  return {
    to: booking.ownerEmail,
    subject: `Prenotazione annullata — ${booking.reference}`,
    text: [
      `Ciao ${booking.ownerName},`,
      '',
      `la prenotazione per ${dogList(booking.dogNames)} è stata annullata.`,
      '',
      ...when,
      ...note,
      '',
      'Se si tratta di un errore, contattaci: rimettiamo a posto.',
      ...signature,
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
async function deliver(messages: readonly Message[], config: MailConfig, reference: string): Promise<number> {
  if (!config.apiKey || !config.from) {
    console.warn(
      `[notify] Resend non configurato: ${reference} salvata ma nessuna email inviata. ` +
        'Imposta RESEND_API_KEY, MAIL_FROM e NOTIFY_EMAIL.',
    );
    return 0;
  }

  const results = await Promise.allSettled(
    messages.map((message) => sendMessage(message, config.apiKey!, config.from!)),
  );

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(
        `[notify] invio a ${messages[index]!.to} fallito per ${reference}:`,
        result.reason instanceof Error ? result.reason.message : result.reason,
      );
    }
  });

  return results.filter((result) => result.status === 'fulfilled').length;
}

export async function deliverDecision(
  booking: DecisionNotification,
  decision: Decision,
  config: MailConfig,
): Promise<boolean> {
  return (await deliver([decisionMessage(booking, decision)], config, booking.reference)) > 0;
}

export async function deliverBooking(booking: BookingNotification, config: MailConfig): Promise<void> {
  const staffTo = config.staffTo || business.contact.email;

  if (!config.apiKey || !config.from || !staffTo) {
    console.warn(
      `[notify] Resend non configurato: ${booking.reference} salvata ma nessuna email inviata. ` +
        'Imposta RESEND_API_KEY, MAIL_FROM e NOTIFY_EMAIL.',
    );
    return;
  }

  await deliver(
    [{ ...staffMessage(booking), to: staffTo }, ownerMessage(booking)],
    config,
    booking.reference,
  );
}
