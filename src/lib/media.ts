export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const DERIVATIVE_WIDTHS = [400, 800, 1600] as const;
export type DerivativeWidth = (typeof DERIVATIVE_WIDTHS)[number];

export type UploadFormat = 'jpeg' | 'png' | 'webp' | 'heic';

export type UploadRejection =
  | 'empty'
  | 'too-large'
  | 'unsupported-format'
  | 'missing-alt';

const MEDIA_NAME = /^[a-z0-9]{16}-(400|800|1600)\.webp$/;

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[offset + index] !== signature[index]) return false;
  }
  return true;
}

/* Extensions and Content-Type are attacker-controlled; the leading bytes are not. */
export function detectFormat(bytes: Uint8Array): UploadFormat | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';

  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'webp';
  }

  if (startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) return 'heic';
  }

  return null;
}

export interface UploadCandidate {
  readonly bytes: Uint8Array;
  readonly alt: string;
}

export type UploadCheck =
  | { readonly ok: true; readonly format: UploadFormat }
  | { readonly ok: false; readonly reason: UploadRejection };

export function checkUpload(candidate: UploadCandidate): UploadCheck {
  if (candidate.bytes.length === 0) return { ok: false, reason: 'empty' };
  if (candidate.bytes.length > MAX_UPLOAD_BYTES) return { ok: false, reason: 'too-large' };
  if (candidate.alt.trim().length === 0) return { ok: false, reason: 'missing-alt' };

  const format = detectFormat(candidate.bytes);
  if (format === null) return { ok: false, reason: 'unsupported-format' };

  return { ok: true, format };
}

export const REJECTION_MESSAGES: Readonly<Record<UploadRejection, string>> = {
  empty: 'Il file è vuoto.',
  'too-large': `Il file supera ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
  'unsupported-format': 'Formato non supportato. Carica JPG, PNG, WebP o HEIC.',
  'missing-alt': 'Serve una descrizione della foto per i lettori di schermo.',
};

export function mediaFileName(slug: string, width: DerivativeWidth): string {
  return `${slug}-${width}.webp`;
}

export function isValidMediaFileName(name: string): boolean {
  return MEDIA_NAME.test(name);
}

/* Derivatives never shrink below the source, so a small upload is not upscaled. */
export function widthsFor(sourceWidth: number): DerivativeWidth[] {
  const usable = DERIVATIVE_WIDTHS.filter((width) => width <= sourceWidth);
  return usable.length > 0 ? usable : [DERIVATIVE_WIDTHS[0]];
}

export function srcSetFor(slug: string, sourceWidth: number): string {
  return widthsFor(sourceWidth)
    .map((width) => `/media/${mediaFileName(slug, width)} ${width}w`)
    .join(', ');
}

export function largestWidth(sourceWidth: number): DerivativeWidth {
  const usable = widthsFor(sourceWidth);
  return usable[usable.length - 1]!;
}
