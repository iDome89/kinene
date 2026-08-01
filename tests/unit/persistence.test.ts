import { describe, expect, it } from 'vitest';
import { databasePath, dataDirIsMounted, formatBytes, storageVerdict } from '@/lib/persistence';

describe('databasePath', () => {
  it('reads the path Render actually mounts', () => {
    expect(databasePath('file:/data/kinene.db')).toBe('/data/kinene.db');
  });

  it('handles the relative path used in development', () => {
    expect(databasePath('file:./data/kinene.db')).toBe('./data/kinene.db');
  });

  it('drops libsql query parameters', () => {
    expect(databasePath('file:/data/kinene.db?mode=rwc')).toBe('/data/kinene.db');
  });

  it('collapses the file:// form to one leading slash', () => {
    expect(databasePath('file:///data/kinene.db')).toBe('/data/kinene.db');
  });

  it('reports no local path for a remote database', () => {
    expect(databasePath('libsql://kinene.turso.io')).toBeNull();
  });
});

describe('storageVerdict', () => {
  const rows = { prenotazioni: 12, recensioni: 4, foto: 30 };

  it('shouts when the database did not survive the deploy', () => {
    const line = storageVerdict(
      { url: 'file:/data/kinene.db', path: '/data/kinene.db', existedAtBoot: false, bytesAtBoot: 0 },
      { prenotazioni: 0, recensioni: 0, foto: 0 },
    );
    expect(line).toContain('ATTENZIONE');
    expect(line).toContain('non e persistente');
    expect(line).toContain('/data');
  });

  it('stays quiet and factual when the database was found', () => {
    const line = storageVerdict(
      { url: 'file:/data/kinene.db', path: '/data/kinene.db', existedAtBoot: true, bytesAtBoot: 262144 },
      rows,
    );
    expect(line).not.toContain('ATTENZIONE');
    expect(line).toContain('ritrovato');
    expect(line).toContain('256.0 KB');
  });

  it('always carries the inventory, so an empty survivor is still visible', () => {
    const line = storageVerdict(
      { url: 'file:/data/kinene.db', path: '/data/kinene.db', existedAtBoot: true, bytesAtBoot: 4096 },
      { prenotazioni: 0, recensioni: 0, foto: 0 },
    );
    expect(line).toContain('0 prenotazioni');
    expect(line).toContain('0 recensioni');
  });

  it('does not blame the disk when the database is remote', () => {
    const line = storageVerdict(
      { url: 'libsql://kinene.turso.io', path: null, existedAtBoot: false, bytesAtBoot: 0 },
      rows,
    );
    expect(line).not.toContain('ATTENZIONE');
    expect(line).toContain('remoto');
    expect(line).toContain('12 prenotazioni');
  });
});

describe('formatBytes', () => {
  it('scales through the units a database file passes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('an empty file is not a survivor', () => {
  it('treats a zero-byte database as newly created, because that is what it is', () => {
    const line = storageVerdict(
      { url: 'file:/data/kinene.db', path: '/data/kinene.db', existedAtBoot: false, bytesAtBoot: 0 },
      { prenotazioni: 0, recensioni: 0, foto: 0 },
    );
    expect(line).toContain('ATTENZIONE');
  });
});

describe('dataDirIsMounted', () => {
  /* Trimmed but structurally real: field 5 is the mount point. */
  const containerOnly = [
    '1234 1233 0:59 / / rw,relatime - overlay overlay rw,lowerdir=/x',
    '1235 1234 0:62 / /proc rw,nosuid - proc proc rw',
    '1236 1234 0:63 / /sys ro,nosuid - sysfs sysfs ro',
    '1240 1234 8:1 /etc/hosts /etc/hosts rw,relatime - ext4 /dev/sda1 rw',
  ].join('\n');

  const withDisk = `${containerOnly}\n1250 1234 8:16 / /data rw,relatime - ext4 /dev/sdb rw`;

  it('sees no disk when the directory only exists inside the image', () => {
    expect(dataDirIsMounted(containerOnly, '/data')).toBe(false);
  });

  it('sees the disk once one is attached', () => {
    expect(dataDirIsMounted(withDisk, '/data')).toBe(true);
  });

  it('counts a subdirectory of the mounted disk as persistent', () => {
    expect(dataDirIsMounted(withDisk, '/data/uploads')).toBe(true);
  });

  it('is not fooled by a mount whose path merely starts with the same letters', () => {
    const decoy = `${containerOnly}\n1250 1234 8:16 / /database rw,relatime - ext4 /dev/sdb rw`;
    expect(dataDirIsMounted(decoy, '/data')).toBe(false);
  });

  it('does not count the container root as a disk', () => {
    expect(dataDirIsMounted(containerOnly, '/')).toBe(false);
  });

  it('ignores a trailing slash', () => {
    expect(dataDirIsMounted(withDisk, '/data/')).toBe(true);
  });

  it('treats unreadable mountinfo as no disk rather than guessing yes', () => {
    expect(dataDirIsMounted('', '/data')).toBe(false);
  });
});
