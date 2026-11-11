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
import type { ExtractedCv, ScanAnalysis } from '../scan/types';
import type { FullAnalysis } from './analyze';

export { analyzeCv } from './checks';
export {
	aiConciseInput,
	conciseFromCv,
	conciseFromText,
	mergeConciseAi,
	rateConcise,
	type ConciseLevel,
	type ConcisePoint,
	type ConciseReport
} from './concise';
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
	/** Same for a CV FILE: pass the result of `extractCvText(file)` (core/scan). */
	analyzeScan(cv: ExtractedCv, jobPost?: string): Promise<ScanAnalysis>;
	dispose(): void;
}

interface Pending {
	resolve: (value: unknown) => void;
	reject: (reason: unknown) => void;
}

type Job = { cv: CVDocument; scan?: undefined } | { scan: ExtractedCv; cv?: undefined };

/** Uses a Web Worker when available; falls back to the main thread (e.g. tests, old browsers). */
export function createAtsAnalyzer(): AtsAnalyzer {
	let worker: Worker | undefined;
	let workerFailed = false;
	let nextId = 1;
	const pending = new Map<number, Pending>();

	const mainThread = async (job: Job, jobPost?: string): Promise<unknown> => {
		const analysis = await import('./analyze');
		return job.scan
			? analysis.analyzeScanFull(job.scan, jobPost)
			: analysis.analyzeFull(job.cv, jobPost);
	};

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
				const data = event.data as { id?: unknown; ok?: unknown; result?: unknown };
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

	async function run(job: Job, jobPost?: string): Promise<unknown> {
		const w = getWorker();
		if (!w) return mainThread(job, jobPost);
		const id = nextId++;
		try {
			return await new Promise<unknown>((resolve, reject) => {
				pending.set(id, { resolve, reject });
				w.postMessage({ id, ...job, jobPost });
			});
		} catch {
			return mainThread(job, jobPost); // worker crashed → still give the user a result
		}
	}

	return {
		async analyze(cv, jobPost) {
			return (await run({ cv }, jobPost)) as FullAnalysis;
		},
		async analyzeScan(scan, jobPost) {
			return (await run({ scan }, jobPost)) as ScanAnalysis;
		},
		dispose() {
			worker?.terminate();
			worker = undefined;
			pending.clear();
		}
	};
}
