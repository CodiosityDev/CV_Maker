<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		letterFontFamily,
		type LetterBlock,
		type LetterModel,
		type RichRun
	} from '#lib/core/letter/index.ts';

	let {
		model,
		textBlock
	}: {
		model: LetterModel;
		textBlock?: Snippet<[Extract<LetterBlock, { kind: 'text' }>]>;
	} = $props();
</script>

{#snippet underlined(run: RichRun)}
	{#if run.underline}<u>{run.text}</u>{:else}{run.text}{/if}
{/snippet}

{#snippet emphasized(run: RichRun)}
	{#if run.italic}<em>{@render underlined(run)}</em>{:else}{@render underlined(run)}{/if}
{/snippet}

{#snippet runs(parts: RichRun[])}
	{#each parts as run, index (index)}
		{#if run.bold}<strong>{@render emphasized(run)}</strong>{:else}{@render emphasized(run)}{/if}
	{/each}
{/snippet}

<article
	class="formal-letter"
	lang={model.locale}
	style:font-family={letterFontFamily(model.style.font)}
	style:font-size={`${model.style.size}pt`}
	style:line-height={model.style.lineHeight}
	style:text-align={model.style.align}
>
	{#if model.sender.length}
		<div class="sender">
			{#each model.sender as line, index (index)}<p>{line}</p>{/each}
		</div>
	{/if}
	<p class="date" class:right={model.locale === 'id'}>{model.dateLine}</p>
	{#if model.meta.length}
		<table class="meta">
			<tbody>
				{#each model.meta as row, index (index)}
					<tr><th scope="row">{row.label}</th><td>:</td><td>{@render runs(row.value)}</td></tr>
				{/each}
			</tbody>
		</table>
	{/if}
	<div class="recipient">
		{#each model.recipient as line, index (index)}<p>{line}</p>{/each}
	</div>
	<p class="salutation">{model.salutation}</p>
	{#each model.blocks as block (block.key)}
		<div class="body-block">
			{#if block.kind === 'text'}
				{#if textBlock}{@render textBlock(block)}{:else}<p>{@render runs(block.runs)}</p>{/if}
			{:else if block.kind === 'identity'}
				<p>{@render runs(block.intro)}</p>
				<table class="identity">
					<tbody>
						{#each block.rows as row, index (index)}
							<tr><th scope="row">{row.label}</th><td>:</td><td>{@render runs(row.value)}</td></tr>
						{/each}
					</tbody>
				</table>
			{:else if block.kind === 'list'}
				<p>{@render runs(block.intro)}</p>
				<ol>
					{#each block.items as item, index (index)}<li>{@render runs(item)}</li>{/each}
				</ol>
			{:else}<p>{@render runs(block.runs)}</p>{/if}
		</div>
	{/each}
	<div class="signature">
		<p>{model.closing}</p>
		<p class="signature-name">{model.signatureName}</p>
	</div>
</article>

<style>
	.formal-letter {
		box-sizing: border-box;
		width: 210mm;
		min-height: 297mm;
		padding: 25mm;
		background: #fff;
		color: #000;
		font-weight: 400;
		font-style: normal;
		letter-spacing: normal;
		overflow-wrap: anywhere;
	}
	p {
		margin: 0;
		white-space: pre-wrap;
		orphans: 3;
		widows: 3;
	}
	.sender,
	.date,
	.meta,
	.recipient,
	.salutation,
	.body-block {
		margin-bottom: 0.8em;
	}
	.sender,
	.recipient,
	.signature,
	.meta,
	.identity {
		text-align: left;
	}
	.date {
		text-align: left;
	}
	.date.right {
		text-align: right;
	}
	table {
		width: auto;
		border-collapse: collapse;
		font: inherit;
		color: inherit;
	}
	th,
	td {
		padding: 0;
		vertical-align: top;
		text-align: left;
		font-weight: 400;
	}
	th {
		padding-right: 0.6em;
		white-space: nowrap;
	}
	td + td {
		padding-left: 0.45em;
	}
	.identity {
		margin-top: 0.4em;
	}
	ol {
		margin: 0.4em 0 0;
		padding-left: 1.6em;
		list-style: decimal;
	}
	li {
		padding-left: 0.15em;
		white-space: pre-wrap;
	}
	.signature {
		break-inside: avoid;
	}
	.signature-name {
		margin-top: 3em;
	}
	@media print {
		.formal-letter {
			width: auto;
			min-height: 0;
			padding: 0;
			print-color-adjust: exact;
		}
	}
</style>
