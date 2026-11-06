<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- RenderModel supplies validated external, email and phone URLs; templates display them unchanged. */
	import type { RenderModel } from '#lib/core/render/index.ts';
	let { model }: { model: RenderModel } = $props();

	let accent = $derived(model.theme.accentColor ?? '#9C9AFF');
</script>

<article
	class="creative-timeline"
	data-template="creative-timeline"
	lang={model.locale}
	style={`--accent: ${accent};`}
>
	<header>
		<div class="identity">
			<h1>{model.personal.fullName}</h1>
			{#if model.personal.headline}<p class="headline">{model.personal.headline}</p>{/if}
		</div>
		{#if model.personal.photoUrl}
			<img src={model.personal.photoUrl} alt={model.personal.fullName} width="120" height="120" />
		{/if}
	</header>
	<div class="contact">
		{#if model.personal.email}
			<p>
				<strong>{model.labels.email}:</strong>
				<a href={model.personal.emailHref} rel="noopener noreferrer">{model.personal.email}</a>
			</p>
		{/if}
		{#if model.personal.phone}
			<p>
				<strong>{model.labels.phone}:</strong>
				<a href={model.personal.phoneHref} rel="noopener noreferrer">{model.personal.phone}</a>
			</p>
		{/if}
		{#if model.personal.location}
			<p><strong>{model.labels.location}:</strong> {model.personal.location}</p>
		{/if}
		{#each model.personal.links as link, index (index)}
			<p>
				<strong>{link.label}:</strong>
				<a href={link.href} rel="noopener noreferrer">{link.display}</a>
			</p>
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
				<div class:timeline={['experience', 'education', 'organizations'].includes(section.key)}>
					{#each section.entries as entry (entry.id)}
						<div class="entry">
							<h3>{entry.title}</h3>
							{#if entry.subtitle}<p class="subtitle">{entry.subtitle}</p>{/if}
							{#if entry.dateText}<p class="date">{entry.dateText}</p>{/if}
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
				</div>
			{:else if section.type === 'skills'}
				{#each section.groups as group (group.key)}
					<p class="skill-group"><strong>{group.label}:</strong> {group.items.join(', ')}</p>
				{/each}
			{/if}
		</section>
	{/each}
</article>

<style>
	.creative-timeline {
		box-sizing: border-box;
		width: 210mm;
		min-height: 297mm;
		padding: 16mm 18mm;
		background: #fff;
		color: #1f1d3d;
		font-family: 'Plus Jakarta Sans Variable', Arial, Helvetica, sans-serif;
		font-size: 10pt;
		font-weight: 400;
		line-height: 1.5;
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
	header {
		display: flex;
		align-items: center;
		gap: 8mm;
		padding-left: 6mm;
		border-left: 2mm solid var(--accent);
		break-inside: avoid;
	}
	.identity {
		flex: 1;
		min-width: 0;
	}
	h1 {
		font-size: 26pt;
		font-weight: 700;
		line-height: 1.2;
	}
	.headline {
		margin-top: 3mm;
		font-size: 11pt;
	}
	img {
		box-sizing: border-box;
		flex: none;
		width: 28mm;
		height: 28mm;
		border: 1mm solid var(--accent);
		border-radius: 50%;
		object-fit: cover;
	}
	.contact {
		display: flex;
		flex-wrap: wrap;
		gap: 1mm 5mm;
		margin-top: 5mm;
		font-size: 9pt;
	}
	a {
		color: inherit;
		text-decoration: underline;
		text-underline-offset: 1pt;
	}
	section {
		margin-top: 5mm;
	}
	h2 {
		margin-bottom: 3mm;
		padding-bottom: 1mm;
		border-bottom: 0.5mm solid var(--accent);
		font-size: 12pt;
		font-weight: 700;
		line-height: 1.4;
		break-after: avoid;
	}
	h3 {
		font-size: 10pt;
		font-weight: 700;
		line-height: 1.5;
	}
	.entry {
		break-inside: avoid;
	}
	.entry + .entry {
		margin-top: 3.5mm;
	}
	.timeline {
		margin-left: 1.25mm;
		border-left: 0.5mm solid var(--accent);
	}
	.timeline .entry {
		position: relative;
		padding-left: 5mm;
	}
	.timeline .entry::before {
		position: absolute;
		top: 1.5mm;
		left: -1.9mm;
		width: 2.5mm;
		height: 2.5mm;
		border: 0.5mm solid #fff;
		border-radius: 50%;
		background: var(--accent);
		content: '';
	}
	.subtitle {
		font-weight: 600;
	}
	.date {
		font-size: 9pt;
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
		margin-top: 1.5mm;
	}
	ul {
		margin: 1.5mm 0 0;
		padding-left: 5mm;
		list-style: disc;
	}
	li + li {
		margin-top: 0.75mm;
	}
	@media print {
		.creative-timeline {
			width: 210mm;
			min-height: 297mm;
			print-color-adjust: exact;
			-webkit-print-color-adjust: exact;
		}
		a {
			text-decoration: none;
		}
	}
</style>
