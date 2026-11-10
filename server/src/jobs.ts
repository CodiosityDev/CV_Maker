/**
 * Long AI tasks (CV conversion) run as background jobs: `POST /api/ai/run` answers 202 at once and
 * the browser polls `GET /api/ai/job?id=`. No proxy timeout (Apache/nginx/Cloudflare) can cut the
 * request, and a phone that switches apps does not lose the result.
 *
 * Memory only: a result (it contains CV content) lives at most RESULT_TTL_MS after it is ready (and a
 * job at most JOB_TTL_MS), is readable only with
 * the device token that started it, and is never written to the database or logs.
 */
import { randomBytes } from 'node:crypto';

export const JOB_TTL_MS = 10 * 60 * 1000;
/** A finished result is kept this long for the browser to fetch (a lost poll can retry). */
export const RESULT_TTL_MS = 2 * 60 * 1000;
/** Jobs running at the same time on the whole server (protects the AI provider and memory). */
export const MAX_RUNNING_JOBS = 20;

export type JobView<T> =
	{ status: 'pending' } | { status: 'done'; value: T } | { status: 'failed'; error: unknown };

interface Job<T> {
	device: string;
	createdAt: number;
	finishedAt?: number;
	view: JobView<T>;
}

export interface JobStore<T> {
	/** False when this device already has a running job or the server is full. */
	canStart(device: string): 'ok' | 'device' | 'full';
	/** Starts `work` in the background; returns the job id. */
	start(device: string, work: () => Promise<T>): string;
	/** The job, only for the device that started it (a wrong device sees nothing). */
	get(id: string, device: string): JobView<T> | undefined;
}

export function createJobStore<T>(now: () => number = Date.now): JobStore<T> {
	const jobs = new Map<string, Job<T>>();

	function sweep(): void {
		const time = now();
		for (const [id, job] of jobs) {
			const expired =
				job.createdAt < time - JOB_TTL_MS ||
				(job.finishedAt !== undefined && job.finishedAt < time - RESULT_TTL_MS);
			if (expired) jobs.delete(id);
		}
	}

	return {
		canStart(device) {
			sweep();
			let running = 0;
			for (const job of jobs.values()) {
				if (job.view.status !== 'pending') continue;
				if (job.device === device) return 'device';
				running += 1;
			}
			return running >= MAX_RUNNING_JOBS ? 'full' : 'ok';
		},
		start(device, work) {
			const id = randomBytes(16).toString('base64url');
			const job: Job<T> = { device, createdAt: now(), view: { status: 'pending' } };
			jobs.set(id, job);
			work().then(
				(value) => {
					job.view = { status: 'done', value };
					job.finishedAt = now();
				},
				(error: unknown) => {
					job.view = { status: 'failed', error };
					job.finishedAt = now();
				}
			);
			return id;
		},
		get(id, device) {
			sweep();
			const job = jobs.get(id);
			if (!job || job.device !== device) return undefined;
			return job.view;
		}
	};
}
