import { createClient } from '@libsql/client';

const client = createClient({ url: 'file:./data/e2e.db' });

export async function clearRateLimits() {
  await client.execute('delete from rate_limits');
}

export async function countBookings(): Promise<number> {
  const result = await client.execute('select count(*) as n from bookings');
  return Number(result.rows[0]?.n ?? 0);
}
