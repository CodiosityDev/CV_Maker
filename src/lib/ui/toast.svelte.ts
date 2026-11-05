export interface ToastMessage {
	id: number;
	kind: 'success' | 'error' | 'info';
	message: string;
}

export const toastState = $state<{ items: ToastMessage[] }>({ items: [] });
const timers: Record<number, ReturnType<typeof setTimeout> | undefined> = {};
let nextId = 0;

function dismiss(id: number): void {
	clearTimeout(timers[id]);
	delete timers[id];
	toastState.items = toastState.items.filter((item) => item.id !== id);
}

function show(kind: ToastMessage['kind'], message: string): number {
	// Notifications are a client interaction; never share messages across SSR requests.
	if (typeof window === 'undefined') return 0;
	const id = ++nextId;
	toastState.items = [...toastState.items, { id, kind, message }];
	timers[id] = setTimeout(() => dismiss(id), 4_000);
	return id;
}

export const toast = {
	success: (message: string): number => show('success', message),
	error: (message: string): number => show('error', message),
	info: (message: string): number => show('info', message),
	dismiss
};
