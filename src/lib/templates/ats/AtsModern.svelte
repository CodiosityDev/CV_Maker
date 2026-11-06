<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- RenderModel supplies validated external, email and phone URLs; templates display them unchanged. */
	import type { RenderModel } from '#lib/core/render/index.ts';
	let { model }: { model: RenderModel } = $props();
</script>

<article class="ats-modern" data-template="ats-modern" lang={model.locale}>
	<h1>{model.personal.fullName}</h1>
	{#if model.personal.headline}<p class="headline">{model.personal.headline}</p>{/if}
	<div class="contact">
		{#if model.personal.email}
			<p>
				{model.labels.email}:
				<a href={model.personal.emailHref} rel="noopener noreferrer">{model.personal.email}</a>
			</p>
		{/if}
		{#if model.personal.phone}
			<p>
				{model.labels.phone}:
				<a href={model.personal.phoneHref} rel="noopener noreferrer">{model.personal.phone}</a>
			</p>
		{/if}
		{#if model.personal.location}<p>{model.labels.location}: {model.personal.location}</p>{/if}
		{#each model.personal.links as link, index (index)}
			<p>{link.label}: <a href={link.href} rel="noopener noreferrer">{link.display}</a></p>
		{/each}
	</div>

	{#each model.sections as section (section.key)}
		<section>
			<h2>{section.title}</h2>
			{#if section.type === 'text'}
				{#each section.paragraphs as paragraph, index (index)}
					<p class="paragraph">{paragraph}</p>
				{/each}
			{:else if section.type === 'entries'}
				{#each section.entries as entry (entry.id)}
					<div class="entry">
						<div class="entry-heading">
							<h3>{entry.title}</h3>
							{#if entry.dateText}<p class="date">{entry.dateText}</p>{/if}
						</div>
						{#if entry.subtitle}<p class="subtitle">{entry.subtitle}</p>{/if}
						{#if entry.location}<p>{entry.location}</p>{/if}
						{#each entry.meta as fact, index (index)}<p>{fact}</p>{/each}
						{#if entry.link}
							<p><a href={entry.link.href} rel="noopener noreferrer">{entry.link.display}</a></p>
						{/if}
						{#if entry.description}<p class="description">{entry.description}</p>{/if}
						{#if entry.bullets.length}
							<ul>
								{#each entry.bullets as bullet, index (index)}<li>{bullet}</li>{/each}
							</ul>
						{/if}
					</div>
				{/each}
			{:else if section.type === 'skills'}
				{#each section.groups as group (group.key)}
					<p class="skill-group"><strong>{group.label}:</strong> {group.items.join(', ')}</p>
				{/each}
			{/if}
		</section>
	{/each}
</article>

<style>
	.ats-modern {
		box-sizing: border-box;
		width: 210mm;
		min-height: 297mm;
		padding: 18mm 20mm;
		background: #fff;
		color: #171717;
		font-family: Arial, Helvetica, 'Liberation Sans', sans-serif;
		font-size: 10.5pt;
		font-weight: 400;
		line-height: 1.45;
		letter-spacing: normal;
		overflow-wrap: anywhere;
	}
	h1,
	h2,
	h3,
	p {
		margin: 0;
		letter-spacing: normal;
	}
	h1 {
		font-size: 26pt;
		font-weight: 700;
		line-height: 1.15;
	}
	.headline {
		margin-top: 2.5mm;
		font-size: 12pt;
		line-height: 1.35;
	}
	.contact {
		margin-top: 4mm;
		font-size: 10pt;
	}
	.contact p + p {
		margin-top: 0.6mm;
	}
	a {
		color: inherit;
		text-decoration: underline;
		text-underline-offset: 1pt;
	}
	section {
		margin-top: 6mm;
	}
	h2 {
		margin-bottom: 2.5mm;
		padding-bottom: 1.5mm;
		border-bottom: 0.2mm solid #555;
		font-size: 11.5pt;
		font-weight: 700;
		line-height: 1.3;
		break-after: avoid;
	}
	.entry {
		break-inside: avoid;
	}
	.entry + .entry {
		margin-top: 4mm;
	}
	.entry-heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 4mm;
	}
	h3 {
		min-width: 0;
		font-size: 10.5pt;
		font-weight: 700;
		line-height: 1.45;
	}
	.date {
		flex-shrink: 0;
		max-width: 45%;
		color: #333;
		font-size: 10pt;
		text-align: right;
	}
	.subtitle {
		margin-top: 0.5mm;
		font-weight: 600;
	}
	.description {
		margin-top: 1mm;
		white-space: pre-line;
	}
	.paragraph {
		white-space: pre-line;
		orphans: 3;
		widows: 3;
	}
	.paragraph + .paragraph,
	.skill-group + .skill-group {
		margin-top: 2mm;
	}
	ul {
		margin: 2mm 0 0;
		padding-left: 5mm;
		list-style: disc;
	}
	li {
		padding-left: 0.5mm;
	}
	li + li {
		margin-top: 1mm;
	}
	@media print {
		.ats-modern {
			width: 210mm;
			min-height: 297mm;
			print-color-adjust: exact;
		}
		a {
			text-decoration: none;
		}
	}
</style>
