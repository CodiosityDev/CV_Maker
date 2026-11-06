<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- RenderModel supplies validated external, email and phone URLs; templates display them unchanged. */
	import type { RenderModel, RenderSection } from '#lib/core/render/index.ts';
	let { model }: { model: RenderModel } = $props();

	const sidebarKeys = new Set(['skills', 'languages']);
	let sidebarSections = $derived(model.sections.filter((section) => sidebarKeys.has(section.key)));
	let mainSections = $derived(model.sections.filter((section) => !sidebarKeys.has(section.key)));
	let accent = $derived(model.theme.accentColor ?? '#9C9AFF');
	let accentInk = $derived(textOnAccent(accent));
	let hasSidebar = $derived(
		Boolean(
			model.personal.photoUrl ||
			model.personal.email ||
			model.personal.phone ||
			model.personal.location ||
			model.personal.links.length ||
			sidebarSections.length
		)
	);

	/** Presentation only: retain readable text for older CVs with a dark accent. */
	function textOnAccent(color: string): string {
		const luminance = (value: string): number => {
			const hex = value.slice(1);
			const expanded = hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex;
			const channels = [0, 2, 4].map((offset) => {
				const channel = parseInt(expanded.slice(offset, offset + 2), 16) / 255;
				return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
			});
			return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
		};
		const background = luminance(color) + 0.05;
		const inkContrast = background / (luminance('#1F1D3D') + 0.05);
		return inkContrast >= 1.05 / background ? '#1F1D3D' : '#fff';
	}
</script>

{#snippet cvSection(section: RenderSection)}
	<section>
		<h2>{section.title}</h2>
		{#if section.type === 'text'}
			{#each section.paragraphs as paragraph, index (index)}
				<p class="paragraph">{paragraph}</p>
			{/each}
		{:else if section.type === 'entries'}
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
		{:else if section.type === 'skills'}
			{#each section.groups as group (group.key)}
				<p class="skill-group"><strong>{group.label}:</strong> {group.items.join(', ')}</p>
			{/each}
		{/if}
	</section>
{/snippet}

<article
	class="creative-sidebar"
	class:without-sidebar={!hasSidebar}
	data-template="creative-sidebar"
	lang={model.locale}
	style={`--accent: ${accent}; --accent-ink: ${accentInk};`}
>
	{#if hasSidebar}
		<aside>
			{#if model.personal.photoUrl}
				<img src={model.personal.photoUrl} alt={model.personal.fullName} width="120" height="120" />
			{/if}
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
			{#each sidebarSections as section (section.key)}{@render cvSection(section)}{/each}
		</aside>
	{/if}
	<div class="main-column">
		<header>
			<h1>{model.personal.fullName}</h1>
			{#if model.personal.headline}<p class="headline">{model.personal.headline}</p>{/if}
		</header>
		{#each mainSections as section (section.key)}{@render cvSection(section)}{/each}
	</div>
</article>

<style>
	.creative-sidebar {
		box-sizing: border-box;
		width: 210mm;
		min-height: 297mm;
		padding: 14mm;
		background: #fff;
		color: #1f1d3d;
		font-family: 'Plus Jakarta Sans Variable', Arial, Helvetica, sans-serif;
		font-size: 10pt;
		font-weight: 400;
		line-height: 1.5;
		letter-spacing: normal;
		overflow-wrap: anywhere;
	}
	.creative-sidebar::after {
		display: block;
		clear: both;
		content: '';
	}
	h1,
	h2,
	h3,
	p {
		margin: 0;
		letter-spacing: normal;
	}
	aside {
		box-sizing: border-box;
		float: left;
		width: 57mm;
		padding: 8mm 6mm;
		background: var(--accent);
		color: var(--accent-ink);
		font-size: 9pt;
		box-decoration-break: clone;
	}
	.main-column {
		margin-left: 65mm;
	}
	.without-sidebar .main-column {
		margin-left: 0;
	}
	header {
		padding-bottom: 5mm;
		border-bottom: 1mm solid var(--accent);
		break-inside: avoid;
	}
	h1 {
		font-size: 26pt;
		font-weight: 700;
		line-height: 1.2;
	}
	.headline {
		margin-top: 3mm;
		font-size: 10.5pt;
	}
	img {
		display: block;
		width: 32mm;
		height: 32mm;
		margin: 0 auto 7mm;
		border: 0.75mm solid #fff;
		border-radius: 50%;
		object-fit: cover;
	}
	a {
		color: inherit;
		text-decoration: underline;
		text-underline-offset: 1pt;
	}
	.contact p {
		break-inside: avoid;
	}
	.contact p + p {
		margin-top: 3mm;
	}
	.contact strong,
	.skill-group strong {
		display: block;
		font-weight: 700;
	}
	section {
		margin-top: 6mm;
	}
	h2 {
		margin-bottom: 2.5mm;
		font-size: 11pt;
		font-weight: 700;
		line-height: 1.4;
		break-after: avoid;
	}
	aside h2 {
		padding-bottom: 1.5mm;
		border-bottom: 0.25mm solid currentColor;
		font-size: 10pt;
	}
	h3 {
		font-size: 10pt;
		font-weight: 700;
		line-height: 1.5;
	}
	aside h3 {
		font-size: 9pt;
	}
	.entry {
		break-inside: avoid;
	}
	.entry + .entry {
		margin-top: 4mm;
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
		margin-top: 2.5mm;
	}
	ul {
		margin: 1.5mm 0 0;
		padding-left: 4mm;
		list-style: disc;
	}
	li + li {
		margin-top: 1mm;
	}
	@media print {
		.creative-sidebar {
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
