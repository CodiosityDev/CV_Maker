import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAccountRoutes } from '../../server/src/account/routes';
import { hashPassword, verifyPassword } from '../../server/src/account/crypto';
import type { GoogleClient } from '../../server/src/account/google';
import type { Mailer } from '../../server/src/account/mail';
import { memoryAccountStore, type AccountStore } from '../../server/src/account/store';
import { HttpError, send } from '../../server/src/http';
import { memoryQuotaStore } from '../../server/src/quota';
import { sampleCvAts, sampleCvCreative } from '../../src/lib/core/fixtures/index';
import { DEFAULT_SHARE_SETTINGS } from '../../src/lib/core/share/index';

const SECRET = '0123456789abcdef0123456789abcdef-test';
const ORIGIN = 'https://cvmaker.codiosity.com';
const JPEG = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString('base64')}`;

interface Harness {
	base: string;
	accounts: AccountStore;
	mails: { to: string; subject: string; text: string }[];
	now: { value: number };
}

let server: Server | undefined;

async function start(options: { mail?: boolean; google?: GoogleClient } = {}): Promise<Harness> {
	const accounts = memoryAccountStore();
	const mails: Harness['mails'] = [];
	const now = { value: Date.parse('2026-11-17T03:00:00.000Z') };
	const mailer: Mailer = { send: async (message) => void mails.push(message) };
	const routes = createAccountRoutes({
		config: { appOrigin: ORIGIN, appSecret: SECRET },
		accounts,
		quota: memoryQuotaStore(),
		mailer: options.mail === false ? undefined : mailer,
		google: options.google,
		now: () => now.value
	});
	server = createServer(async (req, res) => {
		const path = (req.url ?? '/').split('?')[0] ?? '/';
		try {
			if (!(await routes.handle(req, res, path, '203.0.113.7')))
				send(res, 404, { error: 'invalid' });
		} catch (error) {
			if (error instanceof HttpError) send(res, error.status, { error: error.code });
			else send(res, 500, { error: 'failed' });
		}
	});
	await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
	const { port } = server.address() as AddressInfo;
	return { base: `http://127.0.0.1:${port}`, accounts, mails, now };
}

afterEach(async () => {
	await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
	server = undefined;
});

/** A tiny browser: keeps cookies, sends same-origin headers. */
function client(base: string) {
	const jar = new Map<string, string>();
	async function request(
		method: string,
		path: string,
		body?: unknown,
		headers: Record<string, string> = {}
	) {
		const response = await fetch(`${base}${path}`, {
			method,
			redirect: 'manual',
			headers: {
				Origin: ORIGIN,
				'Sec-Fetch-Site': 'same-origin',
				...(jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
				...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
				...headers
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) })
		});
		for (const line of response.headers.getSetCookie()) {
			const [pair = ''] = line.split(';');
			const index = pair.indexOf('=');
			const name = pair.slice(0, index);
			const value = pair.slice(index + 1);
			if (/Max-Age=0/.test(line)) jar.delete(name);
			else jar.set(name, value);
		}
		const text = await response.text();
		let json: Record<string, unknown>;
		try {
			json = text ? JSON.parse(text) : {};
		} catch {
			json = {};
		}
		return { status: response.status, json, headers: response.headers };
	}
	return { request, jar };
}

const tokenFrom = (text: string) => /#token=([\w-]+)/.exec(text)?.[1] ?? '';

async function verifiedUser(h: Harness, email = 'nadia@example.com') {
	const browser = client(h.base);
	const reg = await browser.request('POST', '/api/auth/register', {
		email,
		password: 'rahasia-panjang-1',
		name: 'Nadia',
		locale: 'id'
	});
	expect(reg.status).toBe(200);
	const verify = await browser.request('POST', '/api/auth/verify', {
		token: tokenFrom(h.mails.at(-1)?.text ?? '')
	});
	expect(verify.status).toBe(200);
	return browser;
}

const shareBody = (patch: Record<string, unknown> = {}) => ({
	access: 'link',
	discoverable: false,
	settings: DEFAULT_SHARE_SETTINGS,
	snapshot: structuredClone(sampleCvAts),
	photo: null,
	...patch
});

describe('passwords', () => {
	it('hashes with scrypt and verifies in constant time', async () => {
		const hash = await hashPassword('rahasia-panjang-1');
		expect(hash).toMatch(/^scrypt\$32768\$8\$1\$/);
		expect(hash).not.toContain('rahasia');
		expect(await verifyPassword('rahasia-panjang-1', hash)).toBe(true);
		expect(await verifyPassword('salah', hash)).toBe(false);
		expect(await verifyPassword('apa saja', null)).toBe(false);
	});
});

describe('email + password accounts', () => {
	let h: Harness;
	beforeEach(async () => {
		h = await start();
	});

	it('registers, sends a verification link in the URL fragment, and logs in/out', async () => {
		const browser = client(h.base);
		expect((await browser.request('GET', '/api/auth/me')).json).toEqual({
			user: null,
			providers: { google: false, password: true }
		});
		const reg = await browser.request('POST', '/api/auth/register', {
			email: ' Nadia@Example.com ',
			password: 'rahasia-panjang-1',
			name: 'Nadia',
			locale: 'id'
		});
		expect(reg.status).toBe(200);
		expect(reg.json.user).toMatchObject({
			email: 'nadia@example.com',
			verified: false,
			hasPassword: true
		});
		expect(browser.jar.has('__Host-cvm_session')).toBe(true);
		expect(h.mails).toHaveLength(1);
		expect(h.mails[0]?.text).toContain(`${ORIGIN}/masuk/verifikasi#token=`);

		const me = await browser.request('GET', '/api/auth/me');
		expect(me.json.user).toMatchObject({ email: 'nadia@example.com' });

		expect((await browser.request('POST', '/api/auth/logout', {})).status).toBe(200);
		expect((await browser.request('GET', '/api/auth/me')).json.user).toBeNull();

		const again = await browser.request('POST', '/api/auth/login', {
			email: 'nadia@example.com',
			password: 'rahasia-panjang-1'
		});
		expect(again.status).toBe(200);
		expect((await browser.request('GET', '/api/auth/me')).json.user).not.toBeNull();
	});

	it('refuses duplicates, weak passwords and other websites', async () => {
		const browser = client(h.base);
		const body = { email: 'a@example.com', password: 'rahasia-panjang-1', name: '', locale: 'id' };
		expect((await browser.request('POST', '/api/auth/register', body)).status).toBe(200);
		expect((await browser.request('POST', '/api/auth/register', body)).json.error).toBe('exists');
		expect(
			(
				await browser.request('POST', '/api/auth/register', {
					...body,
					email: 'b@example.com',
					password: 'password'
				})
			).json.error
		).toBe('weak');
		const evil = await browser.request('POST', '/api/auth/login', body, {
			Origin: 'https://evil.example',
			'Sec-Fetch-Site': 'cross-site'
		});
		expect(evil.status).toBe(403);
	});

	it('limits wrong passwords per email', async () => {
		const browser = client(h.base);
		await browser.request('POST', '/api/auth/register', {
			email: 'a@example.com',
			password: 'rahasia-panjang-1',
			name: '',
			locale: 'id'
		});
		for (let i = 0; i < 10; i++) {
			const wrong = await browser.request('POST', '/api/auth/login', {
				email: 'a@example.com',
				password: `salah-${i}-xxxx`
			});
			expect(wrong.json.error).toBe('credentials');
		}
		const blocked = await browser.request('POST', '/api/auth/login', {
			email: 'a@example.com',
			password: 'rahasia-panjang-1'
		});
		expect(blocked.status).toBe(429);
	});

	it('resets a password through the emailed link and ends every other session', async () => {
		const first = client(h.base);
		await first.request('POST', '/api/auth/register', {
			email: 'a@example.com',
			password: 'rahasia-panjang-1',
			name: '',
			locale: 'en'
		});
		const other = client(h.base);
		const reset = await other.request('POST', '/api/auth/reset', {
			email: 'a@example.com',
			locale: 'en'
		});
		expect(reset.json).toEqual({ ok: true });
		// Unknown emails get the same answer and no email.
		const count = h.mails.length;
		expect(
			(
				await other.request('POST', '/api/auth/reset', {
					email: 'nobody@example.com',
					locale: 'en'
				})
			).json
		).toEqual({ ok: true });
		expect(h.mails).toHaveLength(count);

		const mail = h.mails.at(-1)!;
		expect(mail.subject).toBe('Reset your CV Maker password');
		const confirm = await other.request('POST', '/api/auth/reset/confirm', {
			token: tokenFrom(mail.text),
			password: 'kata-sandi-baru-2'
		});
		expect(confirm.status).toBe(200);
		expect(confirm.json.user).toMatchObject({ verified: true });
		// Single use.
		expect(
			(
				await other.request('POST', '/api/auth/reset/confirm', {
					token: tokenFrom(mail.text),
					password: 'kata-sandi-baru-3'
				})
			).json.error
		).toBe('expired');
		expect((await first.request('GET', '/api/auth/me')).json.user).toBeNull();
		expect((await other.request('GET', '/api/auth/me')).json.user).not.toBeNull();
	});

	it('password sign-up is off without mail settings', async () => {
		await new Promise<void>((resolve) => server!.close(() => resolve()));
		h = await start({ mail: false });
		const browser = client(h.base);
		expect((await browser.request('GET', '/api/auth/me')).json.providers).toEqual({
			google: false,
			password: false
		});
		const reg = await browser.request('POST', '/api/auth/register', {
			email: 'a@example.com',
			password: 'rahasia-panjang-1',
			name: '',
			locale: 'id'
		});
		expect(reg.status).toBe(503);
	});

	it('deletes the account with all its links', async () => {
		const browser = await verifiedUser(h);
		const saved = await browser.request('PUT', `/api/shares/${sampleCvAts.id}`, shareBody());
		const slug = String(saved.json.slug);
		expect((await browser.request('POST', '/api/auth/delete', { confirm: true })).status).toBe(200);
		expect((await browser.request('GET', '/api/auth/me')).json.user).toBeNull();
		expect((await client(h.base).request('GET', `/api/s/${slug}`)).status).toBe(404);
		expect(await h.accounts.userByEmail('nadia@example.com')).toBeNull();
	});
});

describe('shared links', () => {
	let h: Harness;
	beforeEach(async () => {
		h = await start();
	});

	it('needs a verified account', async () => {
		const anonymous = client(h.base);
		expect(
			(await anonymous.request('PUT', `/api/shares/${sampleCvAts.id}`, shareBody())).status
		).toBe(401);
		const browser = client(h.base);
		await browser.request('POST', '/api/auth/register', {
			email: 'a@example.com',
			password: 'rahasia-panjang-1',
			name: '',
			locale: 'id'
		});
		const unverified = await browser.request('PUT', `/api/shares/${sampleCvAts.id}`, shareBody());
		expect(unverified.json.error).toBe('unverified');
	});

	it('publishes a stripped snapshot that visitors can open without logging in', async () => {
		const owner = await verifiedUser(h);
		const saved = await owner.request('PUT', `/api/shares/${sampleCvAts.id}`, shareBody());
		expect(saved.status).toBe(200);
		expect(saved.json).toMatchObject({
			cvId: sampleCvAts.id,
			access: 'link',
			hasPassword: false,
			viewCount: 0
		});
		const slug = String(saved.json.slug);
		expect(slug).toMatch(/^[a-z2-9]{12}$/);

		const visitor = client(h.base);
		const open = await visitor.request('GET', `/api/s/${slug}`);
		expect(open.status).toBe(200);
		expect(open.headers.get('x-robots-tag')).toBe('noindex, nofollow');
		const snapshot = open.json.snapshot as typeof sampleCvAts;
		expect(snapshot.personal.fullName).toBe(sampleCvAts.personal.fullName);
		// The client sent the phone and email, but the user did not choose to show them.
		expect(snapshot.personal.phone).toBe('');
		expect(snapshot.personal.email).toBe('');

		const list = await owner.request('GET', '/api/shares');
		expect((list.json.shares as { viewCount: number }[])[0]?.viewCount).toBe(1);
	});

	it('private, expired, rotated and deleted links all answer 404', async () => {
		const owner = await verifiedUser(h);
		const visitor = client(h.base);
		const saved = await owner.request(
			'PUT',
			`/api/shares/${sampleCvAts.id}`,
			shareBody({ expiresAt: new Date(h.now.value + 3_600_000).toISOString() })
		);
		const slug = String(saved.json.slug);
		expect((await visitor.request('GET', `/api/s/${slug}`)).status).toBe(200);

		h.now.value += 2 * 3_600_000;
		expect((await visitor.request('GET', `/api/s/${slug}`)).status).toBe(404);

		await owner.request(
			'PUT',
			`/api/shares/${sampleCvAts.id}`,
			shareBody({ expiresAt: null, access: 'private' })
		);
		expect((await visitor.request('GET', `/api/s/${slug}`)).status).toBe(404);

		await owner.request('PUT', `/api/shares/${sampleCvAts.id}`, shareBody());
		const rotated = await owner.request('POST', `/api/shares/${sampleCvAts.id}/rotate`, {});
		const fresh = String(rotated.json.slug);
		expect(fresh).not.toBe(slug);
		expect((await visitor.request('GET', `/api/s/${slug}`)).status).toBe(404);
		expect((await visitor.request('GET', `/api/s/${fresh}`)).status).toBe(200);

		await owner.request('DELETE', `/api/shares/${sampleCvAts.id}`);
		expect((await visitor.request('GET', `/api/s/${fresh}`)).status).toBe(404);
		expect((await visitor.request('GET', '/api/s/..%2Fetc')).status).toBe(404);
	});

	it('password-protected links ask for the password', async () => {
		const owner = await verifiedUser(h);
		const saved = await owner.request(
			'PUT',
			`/api/shares/${sampleCvAts.id}`,
			shareBody({ password: 'rahasia' })
		);
		expect(saved.json.hasPassword).toBe(true);
		const slug = String(saved.json.slug);
		const visitor = client(h.base);
		expect((await visitor.request('GET', `/api/s/${slug}`)).json.error).toBe('password');
		expect(
			(await visitor.request('POST', `/api/s/${slug}`, { password: 'salah' })).json.error
		).toBe('password');
		const open = await visitor.request('POST', `/api/s/${slug}`, { password: 'rahasia' });
		expect(open.status).toBe(200);
		// Keeping the password: absent = unchanged.
		const kept = await owner.request('PUT', `/api/shares/${sampleCvAts.id}`, shareBody());
		expect(kept.json.hasPassword).toBe(true);
		const removed = await owner.request(
			'PUT',
			`/api/shares/${sampleCvAts.id}`,
			shareBody({ password: null })
		);
		expect(removed.json.hasPassword).toBe(false);
	});

	it('custom slugs are unique, public+discoverable links may be indexed, photos are checked', async () => {
		const owner = await verifiedUser(h);
		const other = await verifiedUser(h, 'budi@example.com');
		const first = await owner.request(
			'PUT',
			`/api/shares/${sampleCvAts.id}`,
			shareBody({ slug: 'nadia-putri', access: 'public', discoverable: true })
		);
		expect(first.json.slug).toBe('nadia-putri');
		const taken = await other.request(
			'PUT',
			`/api/shares/${sampleCvAts.id}`,
			shareBody({ slug: 'nadia-putri' })
		);
		expect(taken.json.error).toBe('taken');
		// The other user's failed attempt did not touch the first link.
		const open = await client(h.base).request('GET', '/api/s/nadia-putri');
		expect(open.headers.get('x-robots-tag')).toBe('all');
		expect((open.json.snapshot as typeof sampleCvAts).personal.fullName).toBe(
			sampleCvAts.personal.fullName
		);

		const creative = {
			snapshot: structuredClone(sampleCvCreative),
			settings: { ...DEFAULT_SHARE_SETTINGS, showPhoto: true }
		};
		const fake = `data:image/jpeg;base64,${Buffer.from('<svg onload=alert(1)>').toString('base64')}`;
		expect(
			(
				await owner.request(
					'PUT',
					`/api/shares/${sampleCvCreative.id}`,
					shareBody({ ...creative, photo: fake })
				)
			).status
		).toBe(400);
		const ok = await owner.request(
			'PUT',
			`/api/shares/${sampleCvCreative.id}`,
			shareBody({ ...creative, photo: JPEG })
		);
		expect(ok.status).toBe(200);
		const withPhoto = await client(h.base).request('GET', `/api/s/${String(ok.json.slug)}`);
		expect(withPhoto.json.photo).toBe(JPEG);
	});

	it('visitors can report a link', async () => {
		const owner = await verifiedUser(h);
		const slug = String(
			(await owner.request('PUT', `/api/shares/${sampleCvAts.id}`, shareBody())).json.slug
		);
		const visitor = client(h.base);
		expect(
			(await visitor.request('POST', `/api/s/${slug}/report`, { reason: 'spam' })).json
		).toEqual({ ok: true });
		expect(
			(await visitor.request('POST', `/api/s/${slug}/report`, { reason: 'because' })).status
		).toBe(400);
	});
});

describe('Google login', () => {
	const fakeGoogle = (
		profile: { sub: string; email: string; name: string } | null
	): GoogleClient => ({
		authUrl: (state) => `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`,
		exchange: async () => profile
	});

	async function signIn(h: Harness, browser: ReturnType<typeof client>, next = '/cv/abc/edit') {
		const start = await browser.request('GET', `/api/auth/google?next=${encodeURIComponent(next)}`);
		expect(start.status).toBe(302);
		const location = start.headers.get('location') ?? '';
		expect(location.startsWith('https://accounts.google.com/')).toBe(true);
		const state = new URL(location).searchParams.get('state');
		return browser.request('GET', `/api/auth/google/callback?code=c0de&state=${state}`, undefined, {
			Origin: '',
			'Sec-Fetch-Site': 'cross-site'
		});
	}

	it('creates a verified account and returns to the page the user came from', async () => {
		const h = await start({
			google: fakeGoogle({ sub: 'g-1', email: 'Nadia@Gmail.com', name: 'Nadia' })
		});
		const browser = client(h.base);
		expect((await browser.request('GET', '/api/auth/me')).json.providers).toEqual({
			google: true,
			password: true
		});
		const done = await signIn(h, browser);
		expect(done.status).toBe(302);
		expect(done.headers.get('location')).toBe('/cv/abc/edit');
		const me = await browser.request('GET', '/api/auth/me');
		expect(me.json.user).toMatchObject({
			email: 'nadia@gmail.com',
			verified: true,
			google: true,
			hasPassword: false
		});
	});

	it('refuses a forged state and unsafe return paths', async () => {
		const h = await start({ google: fakeGoogle({ sub: 'g-1', email: 'a@gmail.com', name: '' }) });
		const browser = client(h.base);
		await browser.request('GET', '/api/auth/google?next=/cv');
		const forged = await browser.request('GET', '/api/auth/google/callback?code=c&state=forged');
		expect(forged.headers.get('location')).toBe('/masuk?error=google');
		const evil = await signIn(h, client(h.base), '//evil.example');
		expect(evil.headers.get('location')).toBe('/cv');
	});

	it('takes over an UNVERIFIED password account with the same email (pre-hijacking)', async () => {
		const h = await start({
			google: fakeGoogle({ sub: 'g-2', email: 'victim@gmail.com', name: 'Victim' })
		});
		const attacker = client(h.base);
		await attacker.request('POST', '/api/auth/register', {
			email: 'victim@gmail.com',
			password: 'attacker-password-1',
			name: '',
			locale: 'id'
		});
		const victim = client(h.base);
		await signIn(h, victim);
		const user = await h.accounts.userByEmail('victim@gmail.com');
		expect(user).toMatchObject({ googleSub: 'g-2', emailVerified: true, passwordHash: null });
		// The attacker's session and password no longer work.
		expect((await attacker.request('GET', '/api/auth/me')).json.user).toBeNull();
		const login = await attacker.request('POST', '/api/auth/login', {
			email: 'victim@gmail.com',
			password: 'attacker-password-1'
		});
		expect(login.json.error).toBe('credentials');
	});

	it('Google refusing the code sends the user back to the login page', async () => {
		const h = await start({ google: fakeGoogle(null) });
		const done = await signIn(h, client(h.base));
		expect(done.headers.get('location')).toBe('/masuk?error=google');
	});
});
