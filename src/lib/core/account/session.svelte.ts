/**
 * Reactive login state for the UI.
 *
 *   import { account } from '#lib/core/account/session.svelte.ts';
 *   onMount(() => void account.load());   // once per page (cached; `force` refreshes)
 *   {#if account.user} … {:else if account.loaded && account.providers.google} …
 *
 * Other tabs learn about login/logout through BroadcastChannel and refresh themselves.
 */
import { ACCOUNT_HINT_STORAGE_KEY } from './hint';
import { accountClient, type AccountUser, type AuthProviders } from './index';

/**
 * ACCOUNT_HINT_STORAGE_KEY = '1' after a login on this browser (no account data). Pages that only
 * NEED the session for background work (auto-updating shared links) ask the server only when it
 * is set, so people who never log in cause no account requests. Cleared on logout and by wipeAll.
 */
export { ACCOUNT_HINT_STORAGE_KEY };

function setHint(on: boolean): void {
	try {
		if (on) localStorage.setItem(ACCOUNT_HINT_STORAGE_KEY, '1');
		else localStorage.removeItem(ACCOUNT_HINT_STORAGE_KEY);
	} catch {
		// localStorage unavailable: background sync simply stays off.
	}
}

let user = $state<AccountUser | null>(null);
let providers = $state<AuthProviders>({ google: false, password: false });
let loaded = $state(false);
/** The API answered (false = server down/offline: hide account features, don't claim "logged out"). */
let available = $state(false);
let pending: Promise<void> | undefined;

const CHANNEL = 'cvmaker-account';
let channel: BroadcastChannel | undefined;

function announce(): void {
	try {
		channel?.postMessage('changed');
	} catch {
		// BroadcastChannel unavailable: other tabs refresh on their next load.
	}
}

function listen(): void {
	if (channel || typeof BroadcastChannel === 'undefined') return;
	try {
		channel = new BroadcastChannel(CHANNEL);
		channel.onmessage = () => void account.load(true);
	} catch {
		channel = undefined;
	}
}

export const account = {
	/** Logged-in user, or null. Reactive. */
	get user(): AccountUser | null {
		return user;
	},
	/** Which login methods the server offers. Reactive. */
	get providers(): AuthProviders {
		return providers;
	},
	/** True after the first answer (or failure). Reactive. */
	get loaded(): boolean {
		return loaded;
	},
	/** False while the account API cannot be reached. Reactive. */
	get available(): boolean {
		return available;
	},
	/** Loads the session (once; `force` asks the server again). */
	load(force = false): Promise<void> {
		listen();
		if (pending && !force) return pending;
		pending = (async () => {
			const result = await accountClient.me();
			if (result.ok) {
				user = result.data.user;
				providers = result.data.providers;
				available = true;
				setHint(user !== null);
			} else {
				available = false;
			}
			loaded = true;
		})();
		return pending;
	},
	/** After a successful login/register/reset: show the user at once and tell other tabs. */
	signedIn(next: AccountUser): void {
		user = next;
		loaded = true;
		available = true;
		setHint(true);
		announce();
	},
	async logout(): Promise<boolean> {
		const result = await accountClient.logout();
		if (!result.ok) return false;
		user = null;
		setHint(false);
		announce();
		return true;
	},
	/** After deleting the account. */
	signedOut(): void {
		user = null;
		setHint(false);
		announce();
	},
	/** True when this browser has logged in before (no request made). */
	hinted(): boolean {
		try {
			return localStorage.getItem(ACCOUNT_HINT_STORAGE_KEY) === '1';
		} catch {
			return false;
		}
	}
};
