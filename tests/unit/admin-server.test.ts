import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createAdminRoutes } from '../../server/src/account/admin';
import { hashPassword } from '../../server/src/account/crypto';
import type { Mailer } from '../../server/src/account/mail';
import { createAccountRoutes } from '../../server/src/account/routes';
import { memoryAccountStore, type AccountStore } from '../../server/src/account/store';
import { HttpError, send } from '../../server/src/http';
import { memoryQuotaStore } from '../../server/src/quota';
import { sampleCvAts } from '../../src/lib/core/fixtures/index';
import { DEFAULT_SHARE_SETTINGS } from '../../src/lib/core/share/index';

const SECRET = '0123456789abcdef0123456789abcdef-test';
const ORIGIN = 'https://cvmaker.codiosity.com';
const ADMIN_PASSWORD = 'admin-password-for-tests';
let passwordHash = '';
let server: Server | undefined;

beforeAll(async () => {
	passwordHash = await hashPassword(ADMIN_PASSWORD);
});

afterEach(async () => {
	await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
	server = undefined;
});

async function start(options: { admin?: boolean; reportEmail?: string } = {}) {
	const accounts: AccountStore = memoryAccountStore();
	const quota = memoryQuotaStore();
	const mails: { to: string; subject: string; text: string }[] = [];
	const mailer: Mailer = { send: async (message) => void mails.push(message) };
	const config = {
		appOrigin: ORIGIN,
		appSecret: SECRET,
		...(options.admin === false ? {} : { admin: { username: 'cvadmin', passwordHash } })
	};
	const admin = createAdminRoutes({ config, accounts, quota });
	const routes = createAccountRoutes({
		config,
		accounts,
		quota,
		mailer,
		reportEmail: options.reportEmail
	});
	server = createServer(async (req, res) => {
		const path = (req.url ?? '/').split('?')[0] ?? '/';
		try {
			if (
				!(await admin.handle(req, res, path, '198.51.100.9')) &&
				!(await routes.handle(req, res, path, '198.51.100.9'))
			)
				send(res, 404, { error: 'invalid' });
		} catch (error) {
			if (error instanceof HttpError) send(res, error.status, { error: error.code });
			else send(res, 500, { error: 'failed' });
		}
	});
	await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
	const { port } = server.address() as AddressInfo;
	return { base: `http://127.0.0.1:${port}`, accounts, mails };
}

function client(base: string) {
	const jar = new Map<string, string>();
	return {
		jar,
		async request(method: string, path: string, body?: unknown) {
			const response = await fetch(`${base}${path}`, {
				method,
				headers: {
					Origin: ORIGIN,
					'Sec-Fetch-Site': 'same-origin',
					...(jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
					...(body === undefined ? {} : { 'Content-Type': 'application/json' })
				},
				...(body === undefined ? {} : { body: JSON.stringify(body) })
			});
			for (const line of response.headers.getSetCookie()) {
				const [pair = ''] = line.split(';');
				const index = pair.indexOf('=');
				if (/Max-Age=0/.test(line)) jar.delete(pair.slice(0, index));
				else jar.set(pair.slice(0, index), pair.slice(index + 1));
			}
			const text = await response.text();
			return {
				status: response.status,
				json: (text ? JSON.parse(text) : {}) as Record<string, unknown>
			};
		}
	};
}

/** A verified user who shares the sample CV; returns its slug. */
async function sharedCv(h: Awaited<ReturnType<typeof start>>) {
	const owner = client(h.base);
	await owner.request('POST', '/api/auth/register', {
		email: 'nadia@example.com',
		password: 'rahasia-panjang-1',
		name: '',
		locale: 'id'
	});
	const user = await h.accounts.userByEmail('nadia@example.com');
	await h.accounts.updateUser(user!.id, { emailVerified: true });
	const saved = await owner.request('PUT', `/api/shares/${sampleCvAts.id}`, {
		access: 'link',
		discoverable: false,
		settings: DEFAULT_SHARE_SETTINGS,
		snapshot: structuredClone(sampleCvAts),
		photo: null
	});
	return String(saved.json.slug);
}

describe('site admin', () => {
	it('is off (404) until the owner sets the credentials', async () => {
		const h = await start({ admin: false });
		expect((await client(h.base).request('GET', '/api/admin/me')).status).toBe(404);
	});

	it('refuses wrong credentials and other websites; correct ones open a session', async () => {
		const h = await start();
		const browser = client(h.base);
		expect((await browser.request('GET', '/api/admin/me')).json).toEqual({ admin: false });
		expect((await browser.request('GET', '/api/admin/reports')).status).toBe(401);
		const wrong = await browser.request('POST', '/api/admin/login', {
			username: 'cvadmin',
			password: 'nope'
		});
		expect(wrong.json.error).toBe('credentials');
		const wrongUser = await browser.request('POST', '/api/admin/login', {
			username: 'root',
			password: ADMIN_PASSWORD
		});
		expect(wrongUser.json.error).toBe('credentials');
		const ok = await browser.request('POST', '/api/admin/login', {
			username: 'cvadmin',
			password: ADMIN_PASSWORD
		});
		expect(ok.status).toBe(200);
		expect(browser.jar.has('__Host-cvm_admin')).toBe(true);
		expect((await browser.request('GET', '/api/admin/me')).json).toEqual({ admin: true });
		await browser.request('POST', '/api/admin/logout', {});
		expect((await browser.request('GET', '/api/admin/me')).json).toEqual({ admin: false });
	});

	it('limits login attempts per IP', async () => {
		const h = await start();
		const browser = client(h.base);
		for (let i = 0; i < 10; i++)
			await browser.request('POST', '/api/admin/login', { username: 'x', password: 'y' });
		const blocked = await browser.request('POST', '/api/admin/login', {
			username: 'cvadmin',
			password: ADMIN_PASSWORD
		});
		expect(blocked.status).toBe(429);
	});

	it('lists reports and blocks, unblocks, dismisses and deletes a reported link', async () => {
		const h = await start({ reportEmail: 'support@codiosity.com' });
		const slug = await sharedCv(h);
		const visitor = client(h.base);
		await visitor.request('POST', `/api/s/${slug}/report`, { reason: 'spam' });
		await visitor.request('POST', `/api/s/${slug}/report`, { reason: 'personal-data' });

		// One email per link per day, to the configured address, without reporter data.
		await new Promise((resolve) => setTimeout(resolve, 50));
		const notices = h.mails.filter((mail) => mail.subject.includes('Laporan'));
		expect(notices).toHaveLength(1);
		expect(notices[0]?.to).toBe('support@codiosity.com');
		expect(notices[0]?.text).toContain(`${ORIGIN}/u/${slug}`);
		expect(notices[0]?.text).toContain(`${ORIGIN}/admin`);

		const admin = client(h.base);
		await admin.request('POST', '/api/admin/login', {
			username: 'cvadmin',
			password: ADMIN_PASSWORD
		});
		const list = await admin.request('GET', '/api/admin/reports');
		const [report] = list.json.reports as {
			shareId: string;
			slug: string;
			total: number;
			reasons: Record<string, number>;
			ownerEmail: string;
			blocked: boolean;
		}[];
		expect(report).toMatchObject({
			slug,
			total: 2,
			ownerEmail: 'nadia@example.com',
			blocked: false
		});
		expect(report?.reasons).toEqual({ spam: 1, 'personal-data': 1 });

		await admin.request('POST', `/api/admin/shares/${report!.shareId}/block`, { blocked: true });
		expect((await visitor.request('GET', `/api/s/${slug}`)).status).toBe(404);
		// The admin can still look at it.
		const preview = await admin.request('GET', `/api/admin/shares/${report!.shareId}`);
		expect((preview.json.snapshot as { personal: { fullName: string } }).personal.fullName).toBe(
			sampleCvAts.personal.fullName
		);
		await admin.request('POST', `/api/admin/shares/${report!.shareId}/block`, { blocked: false });
		expect((await visitor.request('GET', `/api/s/${slug}`)).status).toBe(200);

		await admin.request('POST', `/api/admin/shares/${report!.shareId}/dismiss`, {});
		expect((await admin.request('GET', '/api/admin/reports')).json.reports).toEqual([]);

		await admin.request('DELETE', `/api/admin/shares/${report!.shareId}`);
		expect((await visitor.request('GET', `/api/s/${slug}`)).status).toBe(404);
	});

	it('sends no report email when REPORT_EMAIL is off', async () => {
		const h = await start({ reportEmail: undefined });
		const slug = await sharedCv(h);
		await client(h.base).request('POST', `/api/s/${slug}/report`, { reason: 'spam' });
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(h.mails.filter((mail) => mail.subject.includes('Laporan'))).toHaveLength(0);
	});
});
