import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { DERIVATIVE_WIDTHS, isValidMediaFileName, mediaFileName, widthsFor } from './media';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './data/uploads';
const SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function newSlug(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let slug = '';
  for (const byte of bytes) slug += SLUG_ALPHABET[byte % SLUG_ALPHABET.length];
  return slug;
}

export interface StoredImage {
  readonly slug: string;
  readonly width: number;
  readonly height: number;
}

/*
  Re-encoding through sharp is also the sanitiser: whatever metadata, colour
  profile or trailing payload the upload carried does not survive the round trip.
*/
export async function storeImage(bytes: Uint8Array): Promise<StoredImage> {
  await mkdir(UPLOAD_DIR, { recursive: true });

  const source = sharp(bytes, { failOn: 'error' }).rotate();
  const { width, height } = await source.metadata();

  if (!width || !height) throw new Error('unreadable-image');

  const slug = newSlug();

  await Promise.all(
    widthsFor(width).map(async (target) => {
      const buffer = await sharp(bytes)
        .rotate()
        .resize({ width: target, withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toBuffer();
      await writeFile(join(UPLOAD_DIR, mediaFileName(slug, target)), buffer);
    }),
  );

  return { slug, width, height };
}

export async function deleteImage(slug: string): Promise<void> {
  await Promise.all(
    DERIVATIVE_WIDTHS.map(async (width) => {
      try {
        await unlink(join(UPLOAD_DIR, mediaFileName(slug, width)));
      } catch {
        /* a derivative that was never generated is not an error */
      }
    }),
  );
}

export async function readMedia(fileName: string): Promise<Buffer | null> {
  if (!isValidMediaFileName(fileName)) return null;
  try {
    return await readFile(join(UPLOAD_DIR, fileName));
  } catch {
    return null;
  }
}
