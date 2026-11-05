<script lang="ts">
	import { tick } from 'svelte';
	import { LIMITS } from '#lib/core/schema/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Input from '../Input.svelte';
	import Button from '../Button.svelte';

	let {
		id,
		label,
		items,
		hint,
		onChange
	}: {
		id: string;
		label: string;
		items: string[];
		hint?: string;
		onChange: (items: string[]) => void;
	} = $props();
	let draft = $state('');

	function add() {
		const value = draft.trim();
		if (!value || items.length >= LIMITS.skillsPerGroup) return;
		onChange([...items, value]);
		draft = '';
		document.getElementById(id)?.focus();
	}
	async function remove(index: number) {
		onChange(items.filter((_, at) => at !== index));
		await tick();
		document.getElementById(id)?.focus();
	}
</script>

<section class="skill-group" aria-label={label}>
	<div class="add-row">
		<Input
			{id}
			{label}
			{hint}
			bind:value={draft}
			showCounter
			maxlength={LIMITS.short}
			disabled={items.length >= LIMITS.skillsPerGroup}
			onkeydown={(event) => {
				if (event.key === 'Enter' && !event.isComposing) {
					event.preventDefault();
					add();
				}
			}}
		/>
		<Button
			variant="secondary"
			disabled={!draft.trim() || items.length >= LIMITS.skillsPerGroup}
			onclick={add}>{t('wizard.addSkill')}</Button
		>
	</div>
	{#if items.length}
		<ul>
			{#each items as skill, index (index)}
				<li>
					<span>{skill}</span><button
						type="button"
						aria-label={t('wizard.removeSkill', { skill })}
						onclick={() => remove(index)}>×</button
					>
				</li>
			{/each}
		</ul>
	{/if}
	<p class="limit">{t('wizard.skillsLimit', { max: LIMITS.skillsPerGroup })}</p>
</section>

<style>
	.skill-group {
		min-width: 0;
	}
	.add-row {
		display: grid;
		gap: 0.75rem;
		align-items: start;
	}
	ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 1rem 0 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		align-items: center;
		min-width: 0;
		max-width: 100%;
		padding-left: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-mint);
	}
	li span {
		overflow-wrap: anywhere;
	}
	button {
		flex-shrink: 0;
		min-width: 44px;
		min-height: 44px;
		border: 0;
		background: transparent;
		color: var(--color-brand-ink);
		font-size: 1.25rem;
		cursor: pointer;
	}
	.limit {
		margin: 0.5rem 0 0;
		color: var(--color-text-muted);
		font-size: 0.75rem;
		line-height: 1.6;
	}
	@media (min-width: 480px) {
		.add-row {
			grid-template-columns: minmax(0, 1fr) auto;
		}
		.add-row :global(.button) {
			margin-top: 1.8125rem;
		}
	}
</style>
