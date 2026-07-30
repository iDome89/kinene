import { afterEach, describe, expect, it, vi } from 'vitest';
import { ownerMessage, sendMessage, staffMessage, type BookingNotification } from '@/lib/notify';
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
