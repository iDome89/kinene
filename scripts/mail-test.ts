import nodemailer from 'nodemailer';

/*
  Standalone on purpose: src/lib/notify.ts reads astro:env, which only resolves
  inside an Astro build. This checks the same credentials from plain env vars so
  you can prove SMTP works before a real booking depends on it.
*/

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT ?? 587);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const to = process.env.NOTIFY_EMAIL || user;

const missing = Object.entries({ SMTP_HOST: host, SMTP_USER: user, SMTP_PASS: pass })
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  console.error(`\n✗ Mancano: ${missing.join(', ')}`);
  console.error('  Impostale in .env (o passale inline) e riprova.\n');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
});

console.log(`\n→ Connessione a ${host}:${port} come ${user}`);

try {
  await transporter.verify();
  console.log('✓ Credenziali accettate dal server');
} catch (error) {
  console.error('✗ Il server ha rifiutato la connessione o le credenziali:');
  console.error(`  ${error instanceof Error ? error.message : String(error)}`);
  if (host?.includes('me.com')) {
    console.error('\n  iCloud richiede una password per app generata su appleid.apple.com,');
    console.error('  non la password dell’account Apple. Serve la verifica in due passaggi attiva.');
  }
  process.exit(1);
}

try {
  const info = await transporter.sendMail({
    from: `"Kinene" <${user}>`,
    to,
    subject: 'Test invio — Kinene',
    text: [
      'Se leggi questo messaggio, le notifiche di prenotazione funzionano.',
      '',
      `Server:      ${host}:${port}`,
      `Mittente:    ${user}`,
      `Destinatario: ${to}`,
    ].join('\n'),
  });
  console.log(`✓ Email inviata a ${to} (id ${info.messageId})`);
  console.log('\n  Controlla anche la posta indesiderata: al primo invio finisce spesso lì.\n');
} catch (error) {
  console.error('✗ Connessione riuscita ma invio fallito:');
  console.error(`  ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

process.exit(0);
