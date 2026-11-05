/**
 * Cross-tab notifications (same browser, same device) via BroadcastChannel.
 * Lets an open editor know that another tab saved or deleted the same CV.
 */
import { newId } from '../schema/ids';

export type SyncMessage =
	| { type: 'cv-saved'; id: string; updatedAt: string; from: string }
	| { type: 'cv-removed'; id: string; from: string }
	| { type: 'wiped'; from: string };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type SyncEvent = DistributiveOmit<SyncMessage, 'from'>;

/** Identifies this tab; messages from ourselves are ignored. */
export const TAB_ID = newId();
const CHANNEL_NAME = 'cvmaker';

let channel: BroadcastChannel | null | undefined;

function getChannel(): BroadcastChannel | null {
	if (channel !== undefined) return channel;
	channel =
		typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
			? new BroadcastChannel(CHANNEL_NAME)
			: null;
	return channel;
}

export function broadcast(event: SyncEvent): void {
	try {
		getChannel()?.postMessage({ ...event, from: TAB_ID });
	} catch {
		// Notifications are best-effort.
	}
}

/** Subscribe to changes made in OTHER tabs. Returns an unsubscribe function. */
export function onExternalChange(listener: (event: SyncEvent) => void): () => void {
	const ch = getChannel();
	if (!ch) return () => {};
	const handler = (message: MessageEvent<unknown>) => {
		const data = message.data as Partial<SyncMessage> | null;
		if (!data || typeof data !== 'object' || data.from === TAB_ID) return;
		if (
			data.type === 'cv-saved' &&
			typeof data.id === 'string' &&
			typeof data.updatedAt === 'string'
		) {
			listener({ type: 'cv-saved', id: data.id, updatedAt: data.updatedAt });
		} else if (data.type === 'cv-removed' && typeof data.id === 'string') {
			listener({ type: 'cv-removed', id: data.id });
		} else if (data.type === 'wiped') {
			listener({ type: 'wiped' });
		}
	};
	ch.addEventListener('message', handler);
	return () => ch.removeEventListener('message', handler);
}
