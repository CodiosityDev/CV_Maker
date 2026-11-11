import type { AiQuota } from '#lib/core/ai/types.ts';
import { incognito } from '#lib/core/storage/index.ts';

export type AiModule = typeof import('#lib/core/ai/index.ts');
export const aiSession = $state({
	consented: false,
	epoch: 0,
	quota: undefined as AiQuota | undefined,
	lite: undefined as AiQuota['lite'],
	liteBlocked: false
});
let mode = incognito.active;
let expired: string | undefined;
let revision = 0;
let moduleRequest: Promise<AiModule> | undefined;
let quotaRequest: Promise<void> | undefined;
let liteBlockedReset: string | undefined;

export function loadAiModule(): Promise<AiModule> {
	return (moduleRequest ??= import('#lib/core/ai/index.ts').catch((error: unknown) => {
		moduleRequest = undefined;
		throw error;
	}));
}
export function resetAiSession(): void {
	aiSession.consented = false;
	aiSession.quota = undefined;
	aiSession.lite = undefined;
	aiSession.liteBlocked = false;
	liteBlockedReset = undefined;
	aiSession.epoch += 1;
	revision += 1;
	quotaRequest = undefined;
}
export function syncAiSession(): void {
	if (mode !== incognito.active || (incognito.expiredAt && expired !== incognito.expiredAt)) {
		mode = incognito.active;
		expired = incognito.expiredAt;
		resetAiSession();
	}
}
export function sameAiSession(epoch: number, active: boolean): boolean {
	return (
		aiSession.epoch === epoch && incognito.active === active && (!active || !incognito.expiredAt)
	);
}
export function updateAiQuota(quota: AiQuota): void {
	revision += 1;
	resetLiteBlockForNewDay(quota.resetsAt);
	aiSession.quota = quota.lite || !aiSession.lite ? quota : { ...quota, lite: aiSession.lite };
	if (quota.lite) aiSession.lite = quota.lite;
}
/** The limit can apply to the IP. A same-day device quota cannot lift it. */
export function blockAiLite(): void {
	if (!aiSession.liteBlocked) liteBlockedReset = aiSession.quota?.resetsAt;
	aiSession.liteBlocked = true;
}
function resetLiteBlockForNewDay(resetsAt: string): void {
	if (liteBlockedReset && Date.parse(resetsAt) > Date.parse(liteBlockedReset)) {
		aiSession.liteBlocked = false;
		liteBlockedReset = undefined;
	}
}
/** A free check changes only its own counter; never infer or spend a daily AI use. */
export function updateAiLiteQuota(lite: NonNullable<AiQuota['lite']>): void {
	revision += 1;
	aiSession.lite = lite;
	if (aiSession.quota) aiSession.quota = { ...aiSession.quota, lite };
}
export function refreshAiQuota(): Promise<void> {
	syncAiSession();
	if (quotaRequest) return quotaRequest;
	const epoch = aiSession.epoch;
	const active = incognito.active;
	const version = revision;
	const request = loadAiModule()
		.then((module) => module.aiClient.quota())
		.then(
			(quota) => {
				if (sameAiSession(epoch, active) && revision === version) {
					resetLiteBlockForNewDay(quota.resetsAt);
					aiSession.quota = quota;
					aiSession.lite = quota.lite;
				}
			},
			() => {
				if (sameAiSession(epoch, active) && revision === version) aiSession.quota = undefined;
			}
		)
		.finally(() => {
			if (quotaRequest === request) quotaRequest = undefined;
		});
	quotaRequest = request;
	return request;
}
