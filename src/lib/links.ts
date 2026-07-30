import { business } from '@/config/business';

export function whatsappLink(message: string): string {
  return `https://wa.me/${business.contact.whatsapp}?text=${encodeURIComponent(message)}`;
}

export function telLink(): string {
  return `tel:${business.contact.phone}`;
}

export function mailLink(subject?: string): string | null {
  if (!business.contact.email) return null;
  return subject
    ? `mailto:${business.contact.email}?subject=${encodeURIComponent(subject)}`
    : `mailto:${business.contact.email}`;
}

export function mapsLink(): string {
  const { street, locality, province, postalCode } = business.address;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${street}, ${postalCode} ${locality} ${province}`,
  )}`;
}

export const fullAddress = `${business.address.street}, ${business.address.postalCode} ${business.address.locality} (${business.address.province})`;

export interface NavItem {
  readonly href: string;
  readonly label: string;
}

export const primaryNav: readonly NavItem[] = [
  { href: '/servizi/pensione', label: 'Servizi' },
  { href: '/prezzi', label: 'Prezzi' },
  { href: '/galleria', label: 'Galleria' },
  { href: '/recensioni', label: 'Recensioni' },
  { href: '/chi-siamo', label: 'Chi siamo' },
  { href: '/contatti', label: 'Contatti' },
];

export const footerNav: readonly { title: string; items: readonly NavItem[] }[] = [
  {
    title: 'Servizi',
    items: [
      { href: '/servizi/asilo-diurno', label: 'Asilo diurno' },
      { href: '/servizi/asilo-notturno', label: 'Asilo notturno' },
      { href: '/servizi/pensione', label: 'Pensione' },
      { href: '/test-di-ingresso', label: 'Test d’ingresso gratuito' },
    ],
  },
  {
    title: 'Struttura',
    items: [
      { href: '/chi-siamo', label: 'Chi siamo' },
      { href: '/galleria', label: 'Galleria' },
      { href: '/recensioni', label: 'Recensioni' },
      { href: '/prezzi', label: 'Prezzi e disdette' },
      { href: '/regolamento', label: 'Regolamento interno' },
    ],
  },
  {
    title: 'Informazioni',
    items: [
      { href: '/contatti', label: 'Contatti e orari' },
      { href: '/prenota', label: 'Richiedi una prenotazione' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/cookie', label: 'Cookie' },
    ],
  },
];

export function isActivePath(currentPath: string, href: string): boolean {
  if (href === '/') return currentPath === '/';
  if (href === '/servizi/pensione') return currentPath.startsWith('/servizi/');
  return currentPath === href || currentPath.startsWith(`${href}/`);
}
