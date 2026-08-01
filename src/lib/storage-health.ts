import { readFileSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { dataDirIsMounted, databasePath, formatBytes } from './persistence';

export interface StorageHealth {
  readonly durable: boolean;
  readonly headline: string;
  readonly detail: string;
}

const MOUNTINFO = '/proc/self/mountinfo';

function read(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

export function storageHealth(url: string, uploadDir: string): StorageHealth {
  const path = databasePath(url);

  if (path === null) {
    return {
      durable: true,
      headline: 'Database esterno',
      detail: 'I dati vivono fuori da questa macchina, quindi i deploy non li toccano.',
    };
  }

  const size = statSync(path, { throwIfNoEntry: false })?.size ?? 0;
  const mountinfo = read(MOUNTINFO);

  /* Only Linux exposes mountinfo; in locale development the question is moot. */
  if (mountinfo === null) {
    return {
      durable: true,
      headline: 'Ambiente locale',
      detail: `${path} (${formatBytes(size)}).`,
    };
  }

  const dataDir = dirname(path);
  if (!dataDirIsMounted(mountinfo, dataDir)) {
    return {
      durable: false,
      headline: 'I dati NON sopravvivono al prossimo deploy',
      detail:
        `${dataDir} non è un disco: è una cartella dentro il container, che viene ricreato da zero a ogni ` +
        'deploy. Prenotazioni, recensioni e foto della galleria spariranno. Nel pannello Render apri il ' +
        `servizio, vai su Disks, aggiungi un disco montato su ${dataDir} e fai un nuovo deploy. ` +
        'Nel frattempo scarica il backup qui sotto.',
    };
  }

  const uploadsOnDisk = dataDirIsMounted(mountinfo, uploadDir);

  return uploadsOnDisk
    ? {
        durable: true,
        headline: 'Dati al sicuro',
        detail: `Disco collegato su ${dataDir}. Database ${formatBytes(size)}, foto incluse.`,
      }
    : {
        durable: false,
        headline: 'Le foto NON sopravvivono al prossimo deploy',
        detail:
          `Il database su ${dataDir} è al sicuro, ma ${uploadDir} è fuori dal disco: le foto della ` +
          'galleria spariranno al prossimo deploy. Sposta UPLOAD_DIR dentro il disco.',
      };
}
