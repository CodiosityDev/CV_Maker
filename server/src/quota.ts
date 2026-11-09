/**
 * Daily counters. `consume` takes one unit from several scopes at once (device + IP + global) and
 * rolls back if any scope is full; `refund` gives units back when the AI call fails, so users
 * only pay for answers they actually received.
 */
/**
 * device/ip/global: AI uses · issue: new device tokens per IP · bonus: extra uses earned from ads
 * per device · bonusip: the same per IP · ticket: single-use ad tickets (replay protection) ·
 * visit: a visitor seen today (once per day) · visitip: new visitors per IP (anti-inflation).
 */
export type QuotaScope =
	'device' | 'ip' | 'issue' | 'global' | 'bonus' | 'bonusip' | 'ticket' | 'visit' | 'visitip';

/** All-time counters. visitors: sum of daily unique visitors since launch (starts at 0). */
export type TotalName = 'visitors';

export interface QuotaKey {
	scope: QuotaScope;
	subject: string;
	limit: number;
}

export interface QuotaStore {
	/** Atomically +1 when below `limit`; false when already at the limit. */
	increment(scope: QuotaScope, subject: string, day: string, limit: number): Promise<boolean>;
	/** −1 (never below 0). */
	decrement(scope: QuotaScope, subject: string, day: string): Promise<void>;
	used(scope: QuotaScope, subject: string, day: string): Promise<number>;
	/** Deletes counters older than `beforeDay`. */
	prune(beforeDay: string): Promise<void>;
	/** All-time counter (never pruned): +1, returns the new value. */
	addTotal(name: TotalName): Promise<number>;
	total(name: TotalName): Promise<number>;
	close(): Promise<void>;
}

/** Takes one unit from every key, or none. Returns the scope that was full, if any. */
export async function consume(
	store: QuotaStore,
	keys: readonly QuotaKey[],
	day: string
): Promise<QuotaScope | undefined> {
	const taken: QuotaKey[] = [];
	for (const key of keys) {
		if (await store.increment(key.scope, key.subject, day, key.limit)) {
			taken.push(key);
			continue;
		}
		await refund(store, taken, day);
		return key.scope;
	}
	return undefined;
}

export async function refund(
	store: QuotaStore,
	keys: readonly QuotaKey[],
	day: string
): Promise<void> {
	for (const key of keys) await store.decrement(key.scope, key.subject, day);
}

/** For development and tests. Counters are lost on restart. */
export function memoryQuotaStore(): QuotaStore {
	const counts = new Map<string, number>();
	const totals = new Map<TotalName, number>();
	const id = (scope: QuotaScope, subject: string, day: string) => `${day}|${scope}|${subject}`;
	return {
		async increment(scope, subject, day, limit) {
			const key = id(scope, subject, day);
			const value = counts.get(key) ?? 0;
			if (value >= limit) return false;
			counts.set(key, value + 1);
			return true;
		},
		async decrement(scope, subject, day) {
			const key = id(scope, subject, day);
			const value = counts.get(key) ?? 0;
			if (value > 1) counts.set(key, value - 1);
			else counts.delete(key);
		},
		async used(scope, subject, day) {
			return counts.get(id(scope, subject, day)) ?? 0;
		},
		async prune(beforeDay) {
			for (const key of counts.keys()) if (key.slice(0, 10) < beforeDay) counts.delete(key);
		},
		async addTotal(name) {
			const value = (totals.get(name) ?? 0) + 1;
			totals.set(name, value);
			return value;
		},
		async total(name) {
			return totals.get(name) ?? 0;
		},
		async close() {}
	};
}
