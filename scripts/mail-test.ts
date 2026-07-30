export {};

/*
  Standalone on purpose: src/lib/notify.ts reads astro:env, which only resolves
  inside an Astro build. This checks the same credentials from plain env vars so
  you can prove sending works before a real booking depends on it.
*/

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.MAIL_FROM ?? 'Kinene <prenotazioni@kinene.it>';
const to = process.env.NOTIFY_EMAIL;

if (!apiKey || !to) {
  console.error(`\n✗ Mancano: ${[!apiKey && 'RESEND_API_KEY', !to && 'NOTIFY_EMAIL'].filter(Boolean).join(', ')}`);
  console.error('  Impostale in .env e riprova.\n');
  process.exit(1);
}

console.log(`\n→ Invio di prova da ${from} a ${to}`);

const response = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
  body: JSON.stringify({
    from,
    to: [to],
    subject: 'Test invio — Kinene',
    text: [
      'Se leggi questo messaggio, le notifiche di prenotazione funzionano.',
      '',
      `Mittente:     ${from}`,
      `Destinatario: ${to}`,
    ].join('\n'),
  }),
});

const payload = (await response.json().catch(() => null)) as
  | { id?: string; message?: string; name?: string }
  | null;

if (response.ok) {
  console.log(`✓ Email accettata da Resend (id ${payload?.id})`);
  console.log('  Controlla la posta in arrivo, e anche lo spam al primo invio.\n');
  process.exit(0);
}

console.error(`✗ Resend ha rifiutato l’invio (${response.status}):`);
console.error(`  ${payload?.message ?? 'nessun dettaglio'}`);

if (response.status === 401 || response.status === 403) {
  const domain = from.match(/@([^\s>]+)/)?.[1];
  console.error('\n  Cause tipiche:');
  console.error('  · la chiave API non è valida o è stata revocata');
  if (domain) {
    console.error(`  · il dominio ${domain} non è ancora verificato su resend.com/domains`);
    console.error('    (finché non lo è, Resend accetta solo onboarding@resend.dev');
    console.error('     e come destinatario solo l’email del tuo account)');
  }
}
console.error('');
process.exit(1);
