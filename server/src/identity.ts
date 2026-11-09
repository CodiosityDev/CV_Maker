/**
 * Anonymous identities for quota counting. Nothing here identifies a person:
 * - device token = random id + HMAC signature (stateless; the server stores no list of devices)
 * - ad ticket     = device id + start time + random nonce + HMAC (single use, checked on claim)
 * - IP subject   = HMAC of the IP (raw IPs are never stored)
 * - day          = calendar day in WIB (UTC+7, no DST), so quotas reset at 00:00 WIB
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_VERSION = 'v1';
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

const mac = (secret: string, purpose: string, value: string): string =>
	createHmac('sha256', secret).update(`${purpose}:${value}`).digest('base64url');

export function issueDeviceToken(secret: string): string {
	const id = randomBytes(16).toString('base64url');
	return `${TOKEN_VERSION}.${id}.${mac(secret, 'device', id).slice(0, 32)}`;
}

/** Device id from a valid token; `undefined` for anything forged, truncated or malformed. */
export function verifyDeviceToken(secret: string, token: string | undefined): string | undefined {
	if (!token || token.length > 100) return undefined;
	const [version, id, signature] = token.split('.');
	if (version !== TOKEN_VERSION || !id || !signature || !/^[\w-]{22}$/.test(id)) return undefined;
	const expected = Buffer.from(mac(secret, 'device', id).slice(0, 32));
	const actual = Buffer.from(signature);
	return actual.length === expected.length && timingSafeEqual(actual, expected) ? id : undefined;
}

/** Stable, non-reversible key for an IP address. */
export function ipSubject(secret: string, ip: string): string {
	return mac(secret, 'ip', ip);
}

/** 'YYYY-MM-DD' of the current day in WIB. */
export function wibDay(now: number = Date.now()): string {
	return new Date(now + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** ISO time of the next 00:00 WIB. */
export function nextWibMidnight(now: number = Date.now()): string {
	const wib = new Date(now + WIB_OFFSET_MS);
	const midnightWib = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate() + 1);
	return new Date(midnightWib - WIB_OFFSET_MS).toISOString();
}

export interface RewardTicket {
	device: string;
	/** ms since epoch when the ad was started. */
	issuedAt: number;
	/** Random, single use: the server remembers claimed nonces for the day. */
	nonce: string;
}

const TICKET_VERSION = 'r1';

export function issueRewardTicket(
	secret: string,
	device: string,
	now: number = Date.now()
): string {
	const body = `${device}.${now.toString(36)}.${randomBytes(16).toString('base64url')}`;
	return `${TICKET_VERSION}.${body}.${mac(secret, 'ticket', body).slice(0, 32)}`;
}

export function verifyRewardTicket(secret: string, ticket: unknown): RewardTicket | undefined {
	if (typeof ticket !== 'string' || ticket.length > 160) return undefined;
	const [version, device, issued, nonce, signature, ...rest] = ticket.split('.');
	if (version !== TICKET_VERSION || rest.length || !device || !issued || !nonce || !signature) {
		return undefined;
	}
	if (
		!/^[\w-]{22}$/.test(device) ||
		!/^[\w-]{22}$/.test(nonce) ||
		!/^[0-9a-z]{1,12}$/.test(issued)
	) {
		return undefined;
	}
	const expected = Buffer.from(mac(secret, 'ticket', `${device}.${issued}.${nonce}`).slice(0, 32));
	const actual = Buffer.from(signature);
	if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return undefined;
	return { device, issuedAt: parseInt(issued, 36), nonce };
}
