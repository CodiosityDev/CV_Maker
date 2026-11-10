import type { AiQuota } from '#lib/core/ai/types.ts';
import { incognito } from '#lib/core/storage/index.ts';

export type AiModule = typeof import('#lib/core/ai/index.ts');
export const aiSession = $state({
	consented: false,
	epoch: 0,
	quota: undefined as AiQuota | undefined
});
let mode = incognito.active;
let expired: string | undefined;
let revision = 0;
let moduleRequest: Promise<AiModule> | undefined;
let quotaRequest: Promise<void> | undefined;

export function loadAiModule(): Promise<AiModule> {
	return (moduleRequest ??= import('#lib/core/ai/index.ts').catch((error: unknown) => {
		moduleRequest = undefined;
		throw error;
	}));
}
export function resetAiSession(): void {
	aiSession.consented = false;
	aiSession.quota = undefined;
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
	aiSession.quota = quota;
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
				if (sameAiSession(epoch, active) && revision === version) aiSession.quota = quota;
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
