import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCvStore } from '../../src/lib/core/store/cv-store.svelte';
import { sampleCvAts } from '../../src/lib/core/fixtures/index';
import type { CVDocument } from '../../src/lib/core/schema/index';

function fakeRepo() {
	const saved: CVDocument[] = [];
	let fail = false;
	return {
		saved,
		setFail: (value: boolean) => (fail = value),
		save: vi.fn(async (doc: CVDocument) => {
			if (fail) throw new Error('QuotaExceededError');
			saved.push(doc);
		}),
		get: vi.fn(async () => structuredClone(sampleCvAts))
	};
}

describe('cv store', () => {
	let clock = 0;
	const now = () => clock;

	beforeEach(() => {
		vi.useFakeTimers();
		clock = Date.parse('2026-02-01T00:00:00.000Z');
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	function setup(options: Parameters<typeof createCvStore>[1] = {}) {
		const repo = fakeRepo();
		const store = createCvStore(sampleCvAts, { repo, now, listenToPage: false, ...options });
		return { repo, store };
	}

	it('does not mutate the initial document', () => {
		const { store } = setup();
		store.update((d) => {
			d.personal.fullName = 'Baru';
		});
		expect(sampleCvAts.personal.fullName).toBe('Rizky Aditya Pratama');
	});

	it('autosaves once after the debounce, with a plain snapshot', async () => {
		const { repo, store } = setup();
		store.update((d) => {
			d.summary = 'a';
		});
		store.update((d) => {
			d.summary = 'ab';
		});
		expect(repo.save).not.toHaveBeenCalled();
		expect(store.saveState).toBe('idle');
		await vi.advanceTimersByTimeAsync(500);
		expect(repo.save).toHaveBeenCalledTimes(1);
		expect(repo.saved[0]!.summary).toBe('ab');
		expect(store.saveState).toBe('saved');
		expect(store.lastSavedAt).toBe(new Date(clock).toISOString());
	});

	it('sets updatedAt on every change', () => {
		const { store } = setup();
		clock += 5000;
		store.update((d) => {
			d.summary = 'x';
		});
		expect(store.cv.updatedAt).toBe(new Date(clock).toISOString());
	});

	it('undo/redo restore previous states', () => {
		const { store } = setup();
		store.update((d) => {
			d.personal.city = 'Bandung';
		});
		store.update((d) => {
			d.personal.city = 'Jakarta';
		});
		expect(store.canUndo).toBe(true);
		store.undo();
		expect(store.cv.personal.city).toBe('Bandung');
		store.undo();
		expect(store.cv.personal.city).toBe('Malang');
		expect(store.canUndo).toBe(false);
		store.redo();
		expect(store.cv.personal.city).toBe('Bandung');
		expect(store.canRedo).toBe(true);
	});

	it('coalesces rapid typing in the same field into one undo step', () => {
		const { store } = setup();
		for (const value of ['R', 'Ri', 'Riz']) {
			clock += 200;
			store.update((d) => (d.personal.fullName = value), { coalesceKey: 'personal.fullName' });
		}
		clock += 200;
		store.update((d) => (d.personal.city = 'Solo'), { coalesceKey: 'personal.city' });
		store.undo();
		expect(store.cv.personal.fullName).toBe('Riz');
		store.undo();
		expect(store.cv.personal.fullName).toBe('Rizky Aditya Pratama');
	});

	it('starts a new undo step after a pause', () => {
		const { store } = setup();
		store.update((d) => (d.summary = 'a'), { coalesceKey: 'summary' });
		clock += 1500;
		store.update((d) => (d.summary = 'ab'), { coalesceKey: 'summary' });
		store.undo();
		expect(store.cv.summary).toBe('a');
	});

	it('a new change clears redo; skipHistory changes are not undoable', () => {
		const { store } = setup();
		store.update((d) => (d.summary = 'a'));
		store.undo();
		store.update((d) => (d.summary = 'b'));
		expect(store.canRedo).toBe(false);
		store.update((d) => (d.status.wizardStep = 3), { skipHistory: true });
		store.undo();
		expect(store.cv.summary).toBe(sampleCvAts.summary);
		expect(store.cv.status.wizardStep).toBe(3);
	});

	it('limits history size', () => {
		const { store } = setup({ historyLimit: 3 });
		for (let i = 0; i < 10; i++) store.update((d) => (d.summary = String(i)));
		let undos = 0;
		while (store.canUndo) {
			store.undo();
			undos++;
		}
		expect(undos).toBe(3);
	});

	it('rolls back when the mutator throws', () => {
		const { store } = setup();
		expect(() =>
			store.update((d) => {
				d.summary = 'half-done';
				throw new Error('boom');
			})
		).toThrow('boom');
		expect(store.cv.summary).toBe(sampleCvAts.summary);
	});

	it('reports save errors and retries on the next flush', async () => {
		const { repo, store } = setup();
		repo.setFail(true);
		store.update((d) => (d.summary = 'x'));
		await vi.advanceTimersByTimeAsync(500);
		expect(store.saveState).toBe('error');
		repo.setFail(false);
		await store.flush();
		expect(store.saveState).toBe('saved');
		expect(repo.saved.at(-1)?.summary).toBe('x');
	});

	it('destroy() flushes pending changes immediately', async () => {
		const { repo, store } = setup();
		store.update((d) => (d.summary = 'last words'));
		await store.destroy();
		expect(repo.saved.at(-1)?.summary).toBe('last words');
	});

	describe('changes from other tabs', () => {
		it('flags a newer save of the same CV, ignores older saves and other CVs', () => {
			const { store } = setup();
			store.applyExternalChange({ type: 'cv-saved', id: 'other', updatedAt: '2099-01-01' });
			store.applyExternalChange({ type: 'cv-saved', id: sampleCvAts.id, updatedAt: '2000-01-01' });
			expect(store.externalChange).toBe('none');
			store.applyExternalChange({
				type: 'cv-saved',
				id: sampleCvAts.id,
				updatedAt: '2099-01-01T00:00:00.000Z'
			});
			expect(store.externalChange).toBe('updated');
		});

		it('a CV deleted elsewhere is never re-created by autosave', async () => {
			const { repo, store } = setup();
			store.update((d) => (d.summary = 'pending'));
			store.applyExternalChange({ type: 'cv-removed', id: sampleCvAts.id });
			expect(store.externalChange).toBe('removed');
			await vi.advanceTimersByTimeAsync(2000);
			store.update((d) => (d.summary = 'more edits'));
			await vi.advanceTimersByTimeAsync(2000);
			await store.flush();
			await store.destroy();
			expect(repo.save).not.toHaveBeenCalled();
		});

		it('wiping all data also blocks autosave', async () => {
			const { repo, store } = setup();
			store.update((d) => (d.summary = 'x'));
			store.applyExternalChange({ type: 'wiped' });
			await vi.advanceTimersByTimeAsync(2000);
			expect(repo.save).not.toHaveBeenCalled();
		});

		it('drops a save that was already queued when the deletion arrives', async () => {
			const { repo, store } = setup();
			let release!: () => void;
			repo.save.mockImplementationOnce(
				() => new Promise<void>((resolve) => (release = () => resolve()))
			);
			store.update((d) => (d.summary = 'first'));
			const first = store.flush();
			await Promise.resolve(); // let the first save start (now in flight, waiting on release)
			expect(repo.save).toHaveBeenCalledTimes(1);
			store.update((d) => (d.summary = 'second'));
			const second = store.flush(); // queued behind the first
			store.applyExternalChange({ type: 'cv-removed', id: sampleCvAts.id });
			release();
			await first;
			await second;
			expect(repo.save).toHaveBeenCalledTimes(1);
		});

		it('keepLocalVersion() saves immediately with a newer updatedAt', async () => {
			const { repo, store } = setup();
			store.update((d) => (d.summary = 'mine'));
			store.applyExternalChange({
				type: 'cv-saved',
				id: sampleCvAts.id,
				updatedAt: '2099-01-01T00:00:00.000Z'
			});
			expect(store.externalChange).toBe('updated');
			const before = store.cv.updatedAt;
			clock += 60_000;
			await store.keepLocalVersion();
			expect(store.externalChange).toBe('none');
			expect(repo.saved.at(-1)?.summary).toBe('mine');
			expect(repo.saved.at(-1)!.updatedAt > before).toBe(true);
		});

		it('a deleted CV is purged from memory: content and undo/redo history', async () => {
			const { repo, store } = setup();
			store.update((d) => (d.personal.fullName = 'Rahasia Warnet'));
			store.update((d) => (d.personal.phone = '081234567890'));
			store.undo();
			expect(store.canUndo && store.canRedo).toBe(true);
			const step = store.cv.status.wizardStep;

			store.applyExternalChange({ type: 'wiped' });
			expect(store.externalChange).toBe('removed');
			expect(store.cv.id).toBe(sampleCvAts.id);
			expect(store.cv.personal.fullName).toBe('');
			expect(store.cv.personal.email).toBe('');
			expect(store.cv.experience).toEqual([]);
			expect(store.cv.status.wizardStep).toBe(step);
			expect(store.canUndo).toBe(false);
			expect(store.canRedo).toBe(false);
			store.undo();
			expect(store.cv.personal.fullName).toBe('');

			// Nothing to keep: the old "keep my version" must not re-create it.
			await store.keepLocalVersion();
			await vi.advanceTimersByTimeAsync(2000);
			expect(repo.save).not.toHaveBeenCalled();
			expect(store.externalChange).toBe('removed');
		});
	});

	it('replace() swaps the document and clears history', () => {
		const { store } = setup();
		store.update((d) => (d.summary = 'x'));
		store.replace({ ...structuredClone(sampleCvAts), summary: 'from other tab' });
		expect(store.cv.summary).toBe('from other tab');
		expect(store.canUndo).toBe(false);
	});
});
