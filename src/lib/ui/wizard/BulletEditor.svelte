<script lang="ts">
	import { LIMITS } from '#lib/core/schema/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import ListEditor from '../ListEditor.svelte';
	import Textarea from '../Textarea.svelte';
	import Button from '../Button.svelte';

	let {
		id,
		items,
		label,
		hint,
		examples = [],
		onChange
	}: {
		id: string;
		items: string[];
		label: string;
		hint?: string;
		examples?: string[];
		onChange: (items: string[]) => void;
	} = $props();
</script>

<div class="bullets">
	{#if hint}<p class="hint">{hint}</p>{/if}
	<ListEditor
		{label}
		maxItems={LIMITS.bulletsPerItem}
		onAdd={() => ''}
		bind:items={() => items, onChange}
	>
		{#snippet item(_value, index)}
			<Textarea
				id={`${id}.${index}`}
				{label}
				maxlength={LIMITS.bullet}
				rows={2}
				bind:value={
					() => items[index] ?? '',
					(value) => onChange(items.map((entry, at) => (at === index ? value : entry)))
				}
			/>
		{/snippet}
	</ListEditor>
	{#if examples.length}
		<details>
			<summary>{t('wizard.examples')}</summary>
			<ul class="examples">
				{#each examples as example, index (index)}
					<li>
						<p>{example}</p>
						<Button
							variant="secondary"
							size="sm"
							disabled={items.length >= LIMITS.bulletsPerItem}
							onclick={() => onChange([...items, example])}>{t('wizard.useExample')}</Button
						>
					</li>
				{/each}
			</ul>
		</details>
	{/if}
</div>

<style>
	.bullets {
		min-width: 0;
	}
	.hint {
		margin: 0 0 1rem;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		line-height: 1.6;
	}
	details {
		margin-top: 1.25rem;
		border-top: 1px solid var(--color-border);
	}
	summary {
		min-height: 44px;
		padding: 0.75rem 0;
		cursor: pointer;
		color: var(--color-primary-700);
		font-weight: 600;
	}
	.examples {
		display: grid;
		gap: 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.examples li {
		padding: 1rem;
		background: var(--color-surface-muted);
		border-radius: var(--radius-md);
	}
	.examples p {
		margin: 0 0 0.75rem;
		line-height: 1.65;
		overflow-wrap: anywhere;
	}
</style>
