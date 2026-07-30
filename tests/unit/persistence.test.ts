import { describe, expect, it } from 'vitest';
import { databasePath, formatBytes, storageVerdict } from '@/lib/persistence';

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
