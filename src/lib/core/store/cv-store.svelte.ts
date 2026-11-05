/**
 * Reactive store for the CV currently open in the wizard/editor (PROJECT_SPEC §6).
 *
 *   const store = createCvStore(cv);          // cv from cvRepo.get(id) or cvRepo.create(...)
 *   store.cv.personal.fullName                // reactive read
 *   store.update((d) => { d.personal.fullName = value }, { coalesceKey: 'personal.fullName' });
 *   store.undo(); store.redo(); store.canUndo; store.saveState;
 *   onDestroy(() => store.destroy());
 *
 * Always mutate through `update()` — direct writes to `store.cv` bypass undo history and autosave.
 */
import type { CVDocument } from '../schema/types';
import {
	cvRepo as defaultRepo,
	onExternalChange,
	type CvRepository,
	type SyncEvent
} from '../storage/index';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface CvStoreOptions {
	/** Defaults to the app's IndexedDB-backed repository. */
	repo?: Pick<CvRepository, 'save' | 'get'>;
	/** Autosave debounce. Default 500 ms. */
	autosaveMs?: number;
	/** Max undo steps. Default 50. */
	historyLimit?: number;
	/** Updates with the same coalesceKey within this window form ONE undo step. Default 1000 ms. */
	coalesceMs?: number;
	/** Save on `pagehide` / tab hidden and listen to other tabs. Default: true in the browser. */
	listenToPage?: boolean;
	/** Injected clock (tests). */
	now?: () => number;
}

export interface UpdateOptions {
	/**
	 * Group rapid edits of the same field into one undo step.
	 * Use a stable key per field, e.g. `experience.${item.id}.role`.
	 */
	coalesceKey?: string;
	/** Do not record an undo step (e.g. remembering the current wizard step). */
	skipHistory?: boolean;
}

export type CvStore = ReturnType<typeof createCvStore>;

export function createCvStore(initial: CVDocument, options: CvStoreOptions = {}) {
	const repo = options.repo ?? defaultRepo;
	const autosaveMs = options.autosaveMs ?? 500;
	const historyLimit = options.historyLimit ?? 50;
	const coalesceMs = options.coalesceMs ?? 1000;
	const now = options.now ?? (() => Date.now());
	const listenToPage = options.listenToPage ?? typeof window !== 'undefined';

	let cv = $state<CVDocument>(structuredClone(initial));
	let saveState = $state<SaveState>('idle');
	let lastSavedAt = $state<string | undefined>(undefined);
	/** Another tab saved a newer version of this CV. */
	let externalChange = $state<'none' | 'updated' | 'removed'>('none');
	let undoCount = $state(0);
	let redoCount = $state(0);

	const undoStack: CVDocument[] = [];
	const redoStack: CVDocument[] = [];
	let lastCoalesceKey: string | undefined;
	let lastUpdateAt = 0;

	let dirty = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let saveChain: Promise<void> = Promise.resolve();
	let destroyed = false;
	/**
	 * Set when another tab deleted this CV (or wiped all data): autosave must not resurrect it.
	 * Edits are kept in memory (dirty) until the user explicitly chooses `keepLocalVersion()`.
	 */
	let savingBlocked = false;

	const snapshot = (): CVDocument => $state.snapshot(cv) as CVDocument;

	function syncCounts(): void {
		undoCount = undoStack.length;
		redoCount = redoStack.length;
	}

	function touch(): void {
		// A throwaway Date used only for formatting, not reactive state.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		cv.updatedAt = new Date(now()).toISOString();
	}

	function cancelTimer(): void {
		if (timer !== undefined) {
			clearTimeout(timer);
			timer = undefined;
		}
	}

	function scheduleSave(): void {
		dirty = true;
		cancelTimer();
		if (savingBlocked) return;
		timer = setTimeout(() => {
			timer = undefined;
			void flush();
		}, autosaveMs);
	}

	/** Saves pending changes now. Resolves when everything queued so far is written. */
	function flush(): Promise<void> {
		cancelTimer();
		if (!dirty || savingBlocked) return saveChain;
		dirty = false;
		const doc = snapshot();
		saveState = 'saving';
		saveChain = saveChain.then(async () => {
			if (savingBlocked) {
				// Deleted elsewhere while this save was queued: drop it, keep the edits pending.
				dirty = true;
				saveState = 'idle';
				return;
			}
			try {
				await repo.save(doc);
				if (!dirty) saveState = 'saved';
				lastSavedAt = doc.updatedAt;
			} catch {
				saveState = 'error';
				dirty = true; // retry on the next change or flush
			}
		});
		return saveChain;
	}

	/** Apply a change. The mutator receives the live (reactive) document. */
	function update(mutator: (draft: CVDocument) => void, opts: UpdateOptions = {}): void {
		const t = now();
		const coalesce =
			opts.coalesceKey !== undefined &&
			opts.coalesceKey === lastCoalesceKey &&
			t - lastUpdateAt < coalesceMs;

		// Snapshot only when a new undo step is recorded (keeps typing cheap on low-end phones).
		const before = !opts.skipHistory && !coalesce ? snapshot() : undefined;
		try {
			mutator(cv);
		} catch (error) {
			if (before) cv = before;
			throw error;
		}

		if (!opts.skipHistory) {
			if (before) {
				undoStack.push(before);
				if (undoStack.length > historyLimit) undoStack.shift();
			}
			redoStack.length = 0;
			lastCoalesceKey = opts.coalesceKey;
			lastUpdateAt = t;
			syncCounts();
		}
		touch();
		scheduleSave();
	}

	/** Undo/redo restore CONTENT only: wizard progress (`status`) is navigation, not an edit. */
	function restore(doc: CVDocument): void {
		cv = { ...doc, status: $state.snapshot(cv.status) };
	}

	function undo(): void {
		const previous = undoStack.pop();
		if (!previous) return;
		redoStack.push(snapshot());
		restore(previous);
		lastCoalesceKey = undefined;
		syncCounts();
		touch();
		scheduleSave();
	}

	function redo(): void {
		const next = redoStack.pop();
		if (!next) return;
		undoStack.push(snapshot());
		restore(next);
		lastCoalesceKey = undefined;
		syncCounts();
		touch();
		scheduleSave();
	}

	/** Replace the whole document (e.g. after reloading). Clears undo/redo history. */
	function replace(doc: CVDocument): void {
		cv = structuredClone(doc);
		undoStack.length = 0;
		redoStack.length = 0;
		lastCoalesceKey = undefined;
		externalChange = 'none';
		savingBlocked = false;
		dirty = false;
		syncCounts();
	}

	/** Load the latest saved version (after another tab changed it). Returns false if it no longer exists. */
	async function reloadFromRepo(): Promise<boolean> {
		const latest = await repo.get(cv.id);
		if (!latest) return false;
		replace(latest);
		saveState = 'saved';
		return true;
	}

	/**
	 * Keep this tab's version: dismiss the notice and save it now with a fresh `updatedAt`
	 * (so it is the newest version everywhere). If the CV was deleted elsewhere, this re-creates it.
	 */
	function keepLocalVersion(): Promise<void> {
		externalChange = 'none';
		savingBlocked = false;
		touch();
		dirty = true;
		return flush();
	}

	/** React to a change made in another tab (wired automatically; exposed for tests). */
	function applyExternalChange(event: SyncEvent): void {
		if (event.type !== 'wiped' && event.id !== cv.id) return;
		if (event.type === 'cv-saved') {
			if (event.updatedAt > cv.updatedAt) externalChange = 'updated';
			return;
		}
		// 'cv-removed' or 'wiped': never let a pending autosave bring the CV back.
		externalChange = 'removed';
		savingBlocked = true;
		cancelTimer();
	}

	const onPageHide = () => void flush();
	const onVisibility = () => {
		if (document.visibilityState === 'hidden') void flush();
	};
	let stopSync: () => void = () => {};

	if (listenToPage) {
		window.addEventListener('pagehide', onPageHide);
		document.addEventListener('visibilitychange', onVisibility);
		stopSync = onExternalChange(applyExternalChange);
	}

	/** Stop listeners and save pending changes. Call in onDestroy. */
	function destroy(): Promise<void> {
		if (destroyed) return saveChain;
		destroyed = true;
		if (listenToPage) {
			window.removeEventListener('pagehide', onPageHide);
			document.removeEventListener('visibilitychange', onVisibility);
		}
		stopSync();
		return flush();
	}

	return {
		/** The live document. Read freely; change only through `update()`. */
		get cv(): CVDocument {
			return cv;
		},
		get saveState(): SaveState {
			return saveState;
		},
		/** `updatedAt` of the last successfully saved version. */
		get lastSavedAt(): string | undefined {
			return lastSavedAt;
		},
		get canUndo(): boolean {
			return undoCount > 0;
		},
		get canRedo(): boolean {
			return redoCount > 0;
		},
		get externalChange(): 'none' | 'updated' | 'removed' {
			return externalChange;
		},
		update,
		undo,
		redo,
		flush,
		replace,
		reloadFromRepo,
		keepLocalVersion,
		applyExternalChange,
		destroy
	};
}
