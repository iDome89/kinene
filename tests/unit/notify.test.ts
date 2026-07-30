import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  decisionMessage,
  deliverDecision,
  ownerMessage,
  sendMessage,
  staffMessage,
  type BookingNotification,
} from '@/lib/notify';
import { business } from '@/config/business';
import { parseDay } from '@/lib/dates';

const day = (iso: string) => parseDay(iso)!;

const booking: BookingNotification = {
  reference: 'KIN-ABC123',
  service: 'pensione',
  startDay: day('2026-09-14'),
  endDay: day('2026-09-18'),
  priceCents: 12000,
  dogName: 'Ares',
  ownerName: 'Giulia Ferrari',
  ownerEmail: 'giulia@example.com',
  ownerPhone: '+39 340 9988776',
  emergencyContacts: [
    { firstName: 'Anna', lastName: 'Bianchi', phone: '+39 333 1112223' },
    { firstName: 'Luca', lastName: 'Verdi', phone: '059 111222' },
  ],
  notes: 'Ha paura dei temporali',
};

afterEach(() => vi.unstubAllGlobals());

describe('staffMessage', () => {
  it('carries everything needed to act without opening the site', () => {
    const message = staffMessage(booking);

    expect(message.subject).toContain('KIN-ABC123');
    expect(message.subject).toContain('Ares');
    expect(message.text).toContain('Pensione');
    expect(message.text).toContain('14 settembre 2026');
    expect(message.text).toContain('18 settembre 2026');
    expect(message.text).toContain('120,00');
    expect(message.text).toContain('Giulia Ferrari');
    expect(message.text).toContain('+39 340 9988776');
  });

  it('lists every emergency contact with its number', () => {
    const message = staffMessage(booking);
    expect(message.text).toContain('Anna Bianchi — +39 333 1112223');
    expect(message.text).toContain('Luca Verdi — 059 111222');
  });

  it('replies to the customer, not to the sending address', () => {
    expect(staffMessage(booking).replyTo).toBe('giulia@example.com');
  });

  it('includes the notes only when there are some', () => {
    expect(staffMessage(booking).text).toContain('Ha paura dei temporali');
    expect(staffMessage({ ...booking, notes: '' }).text).not.toContain('Note:');
  });

  it('says so plainly when no contact was recorded', () => {
    expect(staffMessage({ ...booking, emergencyContacts: [] }).text).toContain('(nessuno)');
  });
});

describe('ownerMessage', () => {
  it('goes to the customer and states it is not a confirmation', () => {
    const message = ownerMessage(booking);
    expect(message.to).toBe('giulia@example.com');
    expect(message.text).toContain('Non è ancora una conferma');
  });

  it('repeats the reference, the dates and the intake-test requirement', () => {
    const message = ownerMessage(booking);
    expect(message.text).toContain('KIN-ABC123');
    expect(message.text).toContain('14 settembre 2026');
    expect(message.text).toContain('test d’ingresso');
  });

  it('never leaks the staff-only fields', () => {
    const text = ownerMessage(booking).text;
    expect(text).not.toContain('Anna Bianchi');
    expect(text).not.toContain('Ha paura dei temporali');
  });
});

describe('sendMessage', () => {
  it('posts the shape Resend expects', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'abc' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const id = await sendMessage(
      { to: 'a@b.it', subject: 'Ciao', text: 'corpo', replyTo: 'c@d.it' },
      're_test_key',
      'Kinene <prenotazioni@kinene.it>',
    );

    expect(id).toBe('abc');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.authorization).toBe('Bearer re_test_key');

    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      from: 'Kinene <prenotazioni@kinene.it>',
      to: ['a@b.it'],
      subject: 'Ciao',
      text: 'corpo',
      reply_to: 'c@d.it',
    });
  });

  it('omits reply_to entirely when there is none', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'x' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await sendMessage({ to: 'a@b.it', subject: 's', text: 't' }, 'k', 'f@g.it');
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).not.toHaveProperty('reply_to');
  });

  it('surfaces the reason Resend rejected it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'The kinene.it domain is not verified' }), { status: 403 }),
      ),
    );

    await expect(sendMessage({ to: 'a@b.it', subject: 's', text: 't' }, 'k', 'f@g.it')).rejects.toThrow(
      'domain is not verified',
    );
  });

  it('still throws when the error body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>502</html>', { status: 502 })));

    await expect(sendMessage({ to: 'a@b.it', subject: 's', text: 't' }, 'k', 'f@g.it')).rejects.toThrow(
      'Resend ha risposto 502',
    );
  });
});

describe('decisionMessage', () => {
  const booking = {
    reference: 'KIN-ABC123',
    service: 'pensione' as const,
    startDay: 20500,
    endDay: 20503,
    priceCents: 9000,
    dogName: 'Ares',
    ownerName: 'Marco Rossi',
    ownerEmail: 'marco@example.com',
    intakeTestPassed: true,
    staffNote: '',
  };

  it('tells the owner a confirmation is a confirmation, with the total to pay', () => {
    const message = decisionMessage(booking, 'confirmed');
    expect(message.to).toBe('marco@example.com');
    expect(message.subject).toContain('confermata');
    expect(message.subject).toContain('KIN-ABC123');
    expect(message.text).toContain('è confermata');
    expect(message.text).toContain('90,00');
    expect(message.text).toContain('Ares');
  });

  it('reminds about the intake test only when it is still missing', () => {
    expect(decisionMessage(booking, 'confirmed').text).not.toContain('test d’ingresso');
    expect(decisionMessage({ ...booking, intakeTestPassed: false }, 'confirmed').text).toContain(
      'test d’ingresso',
    );
  });

  it('never claims a rejection is a confirmation', () => {
    const message = decisionMessage(booking, 'rejected');
    expect(message.subject).toContain('non accettata');
    expect(message.text).toContain('non possiamo accettare');
    expect(message.text).not.toContain('è confermata');
  });

  it('passes the staff reason through to the owner', () => {
    const message = decisionMessage({ ...booking, staffNote: 'Siamo al completo' }, 'rejected');
    expect(message.text).toContain('Nota: Siamo al completo');
  });

  it('omits the note line entirely when there is nothing to say', () => {
    expect(decisionMessage(booking, 'confirmed').text).not.toContain('Nota:');
  });

  it('distinguishes an annulment from a refusal', () => {
    const message = decisionMessage(booking, 'cancelled');
    expect(message.subject).toContain('annullata');
    expect(message.text).toContain('è stata annullata');
  });

  it('always carries the dates and a way to reach a human', () => {
    for (const decision of ['confirmed', 'rejected', 'cancelled'] as const) {
      const { text } = decisionMessage(booking, decision);
      expect(text).toContain('KIN-ABC123');
      expect(text).toContain('Consegna:');
      expect(text).toContain('Ritiro:');
      expect(text).toContain(business.contact.phoneDisplay);
    }
  });
});

describe('deliverDecision', () => {
  it('sends exactly one email, to the owner', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'x' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await deliverDecision(
      {
        reference: 'KIN-1',
        service: 'asilo-diurno',
        startDay: 20500,
        endDay: 20500,
        priceCents: 1500,
        dogName: 'Ares',
        ownerName: 'Marco Rossi',
        ownerEmail: 'marco@example.com',
        intakeTestPassed: true,
        staffNote: '',
      },
      'confirmed',
      { apiKey: 'k', from: 'Kinene <a@kinene.it>', staffTo: 'valeria@example.com' },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).to).toEqual(['marco@example.com']);
  });

  it('reports false when Resend is not configured, so the panel cannot claim it sent', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sent = await deliverDecision(
      {
        reference: 'KIN-3',
        service: 'pensione',
        startDay: 20500,
        endDay: 20502,
        priceCents: 6000,
        dogName: 'Nala',
        ownerName: 'Anna Bianchi',
        ownerEmail: 'anna@example.com',
        intakeTestPassed: true,
        staffNote: '',
      },
      'confirmed',
      { apiKey: undefined, from: undefined, staffTo: undefined },
    );

    expect(sent).toBe(false);
    expect(warn).toHaveBeenCalled();
  });

  it('never lets a mail failure break the decision that was already saved', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('resend down')));
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      deliverDecision(
        {
          reference: 'KIN-2',
          service: 'pensione',
          startDay: 20500,
          endDay: 20502,
          priceCents: 6000,
          dogName: 'Nala',
          ownerName: 'Anna Bianchi',
          ownerEmail: 'anna@example.com',
          intakeTestPassed: true,
          staffNote: '',
        },
        'confirmed',
        { apiKey: 'k', from: 'Kinene <a@kinene.it>', staffTo: 'valeria@example.com' },
      ),
    ).resolves.toBe(false);

    expect(errors).toHaveBeenCalled();
  });
});
