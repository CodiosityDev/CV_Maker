<script lang="ts">
	import { tick } from 'svelte';
	import { LIMITS, newId, type SkillGroups } from '#lib/core/schema/index.ts';
	import type { CvStore } from '#lib/core/store/cv-store.svelte.ts';
	import { recommendSkills, type SuggestionData } from '#lib/core/suggest/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	let {
		store,
		data,
		onTarget
	}: {
		store: CvStore;
		data: SuggestionData;
		onTarget?: () => void;
	} = $props();
	const uid = $props.id();
	const groups = ['hard', 'tools', 'soft'] as const;
	const hasTarget = $derived(Boolean(store.cv.targetRole?.trim()));
	const recommended = $derived(recommendSkills(data, store.cv.targetRole, store.cv.skills));
	const visibleGroups = $derived(
		groups.filter((group) => (hasTarget || group === 'soft') && recommended[group].length)
	);
	let panel: HTMLElement | undefined = $state();
	let announcement = $state('');

	async function add(group: keyof SkillGroups, skill: string) {
		if (
			store.externalChange === 'removed' ||
			store.cv.skills[group].length >= LIMITS.skillsPerGroup ||
			!recommended[group].includes(skill)
		)
			return;
		store.update(
			(draft) => {
				draft.skills[group].push(skill);
			},
			{ coalesceKey: `skills.${group}.recommendation.${newId()}` }
		);
		announcement = '';
		await tick();
		const next =
			panel?.querySelector<HTMLButtonElement>(`[data-group="${group}"] button:not(:disabled)`) ??
			panel?.querySelector<HTMLButtonElement>('.skill-chip:not(:disabled)');
		if (next) next.focus({ preventScroll: true });
		else document.getElementById(`skills.${group}`)?.focus();
		announcement = t('wizard.recommendations.added', { skill });
	}
</script>

{#if !hasTarget || visibleGroups.length}
	<section class="recommendations" bind:this={panel} aria-labelledby={`${uid}-title`}>
		<h2 id={`${uid}-title`}>
			{hasTarget
				? t('wizard.recommendations.forRole', { targetRole: store.cv.targetRole ?? '' })
				: t('wizard.recommendations.popularSoft')}
		</h2>
		{#if !hasTarget}
			<p>{t('wizard.recommendations.emptyTarget')}</p>
			{#if onTarget}<button type="button" class="target-action" onclick={onTarget}
					>{t('wizard.recommendations.targetAction')}</button
				>{/if}
		{/if}
		{#each visibleGroups as group (group)}
			<div class="recommendation-group" data-group={group}>
				{#if hasTarget}<h3>{t(`wizard.fields.${group}`)}</h3>{/if}
				<ul>
					{#each recommended[group] as skill (skill)}
						<li>
							<button
								type="button"
								class="skill-chip"
								disabled={store.cv.skills[group].length >= LIMITS.skillsPerGroup}
								onclick={() => void add(group, skill)}>{skill}</button
							>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
		<p class="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
	</section>
{/if}

<style>
	.recommendations {
		min-width: 0;
		padding-bottom: 1.25rem;
		border-bottom: 1px solid var(--color-border);
	}
	h2 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	p {
		margin: 0.5rem 0 0;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
	.recommendation-group {
		margin-top: 1rem;
	}
	h3 {
		margin: 0 0 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
	}
	ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		min-width: 0;
		max-width: 100%;
	}
	button {
		min-width: 44px;
		min-height: 44px;
		max-width: 100%;
		border: 1px solid transparent;
		border-radius: var(--radius-pill);
		padding: 0.5rem 0.75rem;
		background: var(--color-mint-50);
		color: var(--color-text);
		font: inherit;
		font-size: 0.875rem;
		line-height: 1.5;
		text-align: left;
		overflow-wrap: anywhere;
		cursor: pointer;
		transition: background-color var(--motion-duration) ease-out;
	}
	.recommendation-group[data-group='soft'] button {
		background: var(--color-brand-50);
	}
	button:hover:not(:disabled) {
		background: var(--color-mint);
	}
	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.target-action {
		margin-top: 0.25rem;
		padding-left: 0;
		background: transparent;
		color: var(--color-brand-ink);
		text-decoration: underline;
	}
</style>
