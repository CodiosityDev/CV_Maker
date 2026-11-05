/**
 * ATS checker (PROJECT_SPEC §9.1) — everything runs on the user's device.
 *
 *   import { createAtsAnalyzer } from '#lib/core/ats/index.ts';
 *   const analyzer = createAtsAnalyzer();                      // once per page (onMount)
 *   const { report, keywords } = await analyzer.analyze($state.snapshot(store.cv), jobPost);
 *   onDestroy(() => analyzer.dispose());
 *
 *   report.score (0–100), report.grade, report.checks[] → t(check.messageKey, check.params),
 *   check.target.step / .itemId / .field to navigate; keywords.keywords[] (term, inCv, known).
 *
 * Pass a PLAIN object (`$state.snapshot`) — reactive proxies cannot be sent to a worker.
 * `analyzeCv(cv)` is also exported for synchronous use (cheap, no job post).
 */
import type { CVDocument } from '../schema/types';
import type { FullAnalysis } from './analyze';

export { analyzeCv } from './checks';
export { matchKeywords, MAX_JOB_POST_CHARS } from './keywords';
export type { FullAnalysis } from './analyze';
export type {
	AtsCheck,
	AtsGrade,
	AtsReport,
	CheckId,
	CheckLevel,
	CheckTarget,
	KeywordMatch,
	KeywordReport
} from './types';

export interface AtsAnalyzer {
	analyze(cv: CVDocument, jobPost?: string): Promise<FullAnalysis>;
	dispose(): void;
}

interface Pending {
	resolve: (value: FullAnalysis) => void;
	reject: (reason: unknown) => void;
}

/** Uses a Web Worker when available; falls back to the main thread (e.g. tests, old browsers). */
export function createAtsAnalyzer(): AtsAnalyzer {
	let worker: Worker | undefined;
	let workerFailed = false;
	let nextId = 1;
	const pending = new Map<number, Pending>();

	const mainThread = async (cv: CVDocument, jobPost?: string) =>
		(await import('./analyze')).analyzeFull(cv, jobPost);

	function failAll(): void {
		workerFailed = true;
		worker?.terminate();
		worker = undefined;
		for (const { reject } of pending.values()) reject(new Error('ats worker failed'));
		pending.clear();
	}

	function getWorker(): Worker | undefined {
		if (workerFailed || typeof Worker === 'undefined') return undefined;
		if (!worker) {
			try {
				worker = new Worker(new URL('./ats.worker.ts', import.meta.url), { type: 'module' });
			} catch {
				workerFailed = true;
				return undefined;
			}
			worker.addEventListener('message', (event: MessageEvent) => {
				const data = event.data as { id?: unknown; ok?: unknown; result?: FullAnalysis };
				if (typeof data?.id !== 'number') return;
				const entry = pending.get(data.id);
				if (!entry) return;
				pending.delete(data.id);
				if (data.ok === true && data.result) entry.resolve(data.result);
				else entry.reject(new Error('ats analysis failed'));
			});
			worker.addEventListener('error', failAll);
		}
		return worker;
	}

	return {
		async analyze(cv, jobPost) {
			const w = getWorker();
			if (!w) return mainThread(cv, jobPost);
			const id = nextId++;
			try {
				return await new Promise<FullAnalysis>((resolve, reject) => {
					pending.set(id, { resolve, reject });
					w.postMessage({ id, cv, jobPost });
				});
			} catch {
				return mainThread(cv, jobPost); // worker crashed → still give the user a result
			}
		},
		dispose() {
			worker?.terminate();
			worker = undefined;
			pending.clear();
		}
	};
}
