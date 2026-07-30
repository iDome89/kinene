import { hashPassword } from '../src/lib/auth';
import { bytesToHex } from '@noble/hashes/utils.js';
import { randomBytes } from '@noble/hashes/utils.js';

const password = process.argv[2];

if (!password) {
  console.error('usage: npm run auth:hash -- "your-password"');
  process.exit(1);
}

console.log('\nAdd these to .env:\n');
console.log(`ADMIN_PASSWORD_HASH=${hashPassword(password)}`);
console.log(`SESSION_SECRET=${bytesToHex(randomBytes(32))}\n`);
