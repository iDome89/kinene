export interface StorageProbe {
  readonly url: string;
  readonly path: string | null;
  readonly existedAtBoot: boolean;
  readonly bytesAtBoot: number;
}

export function databasePath(url: string): string | null {
  if (!url.startsWith('file:')) return null;
  const withoutScheme = url.slice('file:'.length);
  const withoutQuery = withoutScheme.split('?')[0]!;
  return withoutQuery.startsWith('//') ? withoutQuery.slice(2) : withoutQuery;
}

/*
  A wiped volume and a healthy one both answer `select 1`. The only honest
  signal is whether the file was already there when this process started, so
  the deploy log has to carry it: a database that is new on every boot is a
  database that is not persisting.
*/
export function storageVerdict(probe: StorageProbe, rows: Readonly<Record<string, number>>): string {
  const inventory = Object.entries(rows)
    .map(([label, count]) => `${count} ${label}`)
    .join(', ');

  if (probe.path === null) {
    return `[storage] database remoto (${probe.url.split(':')[0]}): ${inventory}`;
  }

  if (!probe.existedAtBoot) {
    return (
      `[storage] ATTENZIONE: ${probe.path} non esisteva all'avvio, database creato ora (${inventory}). ` +
      'Se questo messaggio compare a ogni deploy, il disco non e persistente: ' +
      'collega un disco a /data dal pannello Render.'
    );
  }

  return `[storage] ${probe.path} ritrovato (${formatBytes(probe.bytesAtBoot)}): ${inventory}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
