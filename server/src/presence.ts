/**
 * "Sedang online": visitors seen in the last ONLINE_WINDOW_MS. Each open CV Maker tab sends a small
 * heartbeat (`POST /api/hello` with `{ visitor, beat: true }`) about once a minute while visible.
 *
 * Memory only, never the database: keys are HMACs of the random browser id (never the id or the IP),
 * and an entry disappears ONLINE_WINDOW_MS after its last heartbeat. A script cannot inflate the
 * number much: at most MAX_PER_IP ids count per IP at the same time.
 */
export const ONLINE_WINDOW_MS = 150_000;
export const MAX_PER_IP = 20;
/** Safety cap for memory; beyond it new visitors are not added (the count stays a lower bound). */
export const MAX_ENTRIES = 100_000;

interface Entry {
	ip: string;
	seen: number;
}

export interface Presence {
	/** Marks a visitor as online now. `subject` and `ip` must already be HMACs. */
	seen(subject: string, ip: string): void;
	/** Visitors seen within the window. */
	online(): number;
}

export function createPresence(now: () => number = Date.now): Presence {
	const entries = new Map<string, Entry>();
	const perIp = new Map<string, number>();
	let lastPrune = 0;

	function drop(subject: string, entry: Entry): void {
		entries.delete(subject);
		const left = (perIp.get(entry.ip) ?? 1) - 1;
		if (left > 0) perIp.set(entry.ip, left);
		else perIp.delete(entry.ip);
	}

	/** At most every 5 s: the count may include visitors who left up to 5 s ago. */
	function prune(): void {
		const time = now();
		if (time - lastPrune < 5_000) return;
		lastPrune = time;
		const limit = time - ONLINE_WINDOW_MS;
		for (const [subject, entry] of entries) if (entry.seen < limit) drop(subject, entry);
	}

	return {
		seen(subject, ip) {
			prune();
			const existing = entries.get(subject);
			if (existing) {
				// Same browser from a new network (phone switching to Wi-Fi): move its IP slot.
				if (existing.ip !== ip) {
					drop(subject, existing);
				} else {
					existing.seen = now();
					return;
				}
			}
			if (entries.size >= MAX_ENTRIES || (perIp.get(ip) ?? 0) >= MAX_PER_IP) return;
			entries.set(subject, { ip, seen: now() });
			perIp.set(ip, (perIp.get(ip) ?? 0) + 1);
		},
		online() {
			prune();
			return entries.size;
		}
	};
}
