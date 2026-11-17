// Makes ADMIN_PASSWORD_HASH for the site admin (/admin) without the password ever being stored.
//   node scripts/hash-password.mjs
// Type the password when asked; copy the printed line into the server env file
// (cvmaker-api.env) and deploy again. Same format as server/src/account/crypto.ts.
import { randomBytes, scrypt } from 'node:crypto';
import { createInterface } from 'node:readline/promises';

const N = 32768;
const R = 8;
const P = 1;

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = (await rl.question('Admin password (at least 12 characters): ')).trim();
rl.close();
if (password.length < 12) {
	console.error('Too short: use at least 12 characters.');
	process.exit(1);
}
const salt = randomBytes(16);
const key = await new Promise((resolve, reject) =>
	scrypt(
		password.normalize('NFKC'),
		salt,
		64,
		{ N, r: R, p: P, maxmem: 64 * 1024 * 1024 },
		(error, derived) => (error ? reject(error) : resolve(derived))
	)
);
console.log(
	`\nADMIN_PASSWORD_HASH=scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`
);
