<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- RenderModel supplies validated external, email and phone URLs; templates display them unchanged. */
	import type { RenderModel, RenderSection } from '#lib/core/render/index.ts';
	import { editKey, type EditTarget } from '#lib/core/design/edit.ts';
	let { model }: { model: RenderModel } = $props();

	let accent = $derived(model.theme.accentColor ?? '#9C9AFF');
	let accentInk = $derived(textOnAccent(accent));
	let spaceScale = $derived(model.design?.spaceScale ?? 1);
	let photoScale = $derived(model.design?.photoScale ?? 1);
	let photoRadius = $derived(
		model.design?.photoShape === 'square'
			? '0'
			: model.design?.photoShape === 'rounded'
				? '4mm'
				: '50%'
	);
	const inline = (target: EditTarget) => (model.editing ? editKey(target) : undefined);
	const form = (field: string) => (model.editing ? field : undefined);
	function dateField(section: RenderSection['key'], id: string) {
		return form(
			`${section}.${id}.${section === 'certifications' || section === 'awards' ? 'date' : 'dates.start'}`
		);
	}
	function metaField(section: RenderSection['key'], id: string, fact: string) {
		if (section === 'experience') return form(`${section}.${id}.type`);
		if (section !== 'education') return undefined;
		const thesis =
			fact.startsWith(`${model.labels.thesis}:`) ||
			fact.startsWith(`${model.labels.finalProject}:`);
		return form(`${section}.${id}.${thesis ? 'thesisTitle' : 'gpa'}`);
	}

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

<article
	class="creative-header"
	data-template="creative-header"
	lang={model.locale}
	style={`--accent: ${accent}; --accent-ink: ${accentInk}; --space-scale: ${spaceScale}; --photo-scale: ${photoScale}; --photo-radius: ${photoRadius};`}
>
	<header>
		<div class="identity">
			<h1 data-edit={inline({ kind: 'personal', field: 'fullName' })}>{model.personal.fullName}</h1>
			{#if model.personal.headline}<p
					class="headline"
					data-edit={inline({ kind: 'personal', field: 'headline' })}
				>
					{model.personal.headline}
				</p>{/if}
		</div>
		{#if model.personal.photoUrl}
			<img src={model.personal.photoUrl} alt={model.personal.fullName} width="120" height="120" />
		{/if}
	</header>
	<div class="content" data-visual-column={form('main')}>
		<div class="contact">
			{#if model.personal.email}
				<p data-form-field={form('personal.email')} data-form-section={form('personal')}>
					<strong>{model.labels.email}:</strong>
					<a href={model.personal.emailHref} rel="noopener noreferrer">{model.personal.email}</a>
				</p>
			{/if}
			{#if model.personal.phone}
				<p data-form-field={form('personal.phone')} data-form-section={form('personal')}>
					<strong>{model.labels.phone}:</strong>
					<a href={model.personal.phoneHref} rel="noopener noreferrer">{model.personal.phone}</a>
				</p>
			{/if}
			{#if model.personal.location}
				<p data-form-field={form('personal.city')} data-form-section={form('personal')}>
					<strong>{model.labels.location}:</strong>
					{model.personal.location}
				</p>
			{/if}
			{#each model.personal.links as link, index (index)}
				<p
					data-form-field={form('personal.links')}
					data-form-section={form('personal')}
					data-form-link={form(link.href)}
				>
					<strong>{link.label}:</strong>
					<a href={link.href} rel="noopener noreferrer">{link.display}</a>
				</p>
			{/each}
		</div>
		{#each model.sections as section (section.key)}
			<section data-visual-section={form(section.key)}>
				<h2 data-edit={inline({ kind: 'sectionTitle', section: section.key })}>{section.title}</h2>
				{#if section.type === 'text'}
					{#if model.editing}<p class="paragraph" data-edit={inline({ kind: 'summary' })}>
							{section.paragraphs.join('\n')}
						</p>
					{:else}{#each section.paragraphs as paragraph, index (index)}<p class="paragraph">
								{paragraph}
							</p>{/each}{/if}
				{:else if section.type === 'entries'}
					{#each section.entries as entry (entry.id)}
						<div class="entry" data-visual-entry={form(entry.id)}>
							<div class="entry-heading">
								<h3
									data-edit={inline({
										kind: 'entry',
										section: section.key,
										id: entry.id,
										field: 'title'
									})}
								>
									{entry.title}
								</h3>
								{#if entry.dateText}<p
										class="date"
										data-form-field={dateField(section.key, entry.id)}
										data-form-section={form(section.key)}
									>
										{entry.dateText}
									</p>{/if}
							</div>
							{#if entry.subtitle}<p
									class="subtitle"
									data-edit={section.key === 'education' || section.key === 'languages'
										? undefined
										: inline({
												kind: 'entry',
												section: section.key,
												id: entry.id,
												field: 'subtitle'
											})}
									data-form-field={section.key === 'education'
										? form(`education.${entry.id}.degree`)
										: section.key === 'languages'
											? form(`languages.${entry.id}.level`)
											: undefined}
									data-form-section={section.key === 'education' || section.key === 'languages'
										? form(section.key)
										: undefined}
								>
									{entry.subtitle}
								</p>{/if}
							{#if entry.location}<p
									data-edit={section.key === 'experience'
										? inline({
												kind: 'entry',
												section: section.key,
												id: entry.id,
												field: 'location'
											})
										: undefined}
								>
									{entry.location}
								</p>{/if}
							{#each entry.meta as fact, index (index)}<p
									data-form-field={metaField(section.key, entry.id, fact)}
									data-form-section={form(section.key)}
								>
									{fact}
								</p>{/each}
							{#if entry.link}
								<p
									data-form-field={form(
										`${section.key}.${entry.id}.${section.key === 'certifications' ? 'credentialUrl' : 'url'}`
									)}
									data-form-section={form(section.key)}
								>
									<a href={entry.link.href} rel="noopener noreferrer">{entry.link.display}</a>
								</p>
							{/if}
							{#if entry.description}<p
									class="description"
									data-edit={section.key === 'awards'
										? inline({
												kind: 'entry',
												section: section.key,
												id: entry.id,
												field: 'description'
											})
										: undefined}
								>
									{entry.description}
								</p>{/if}
							{#if entry.bullets.length}
								<ul>
									{#each entry.bullets as bullet, index (index)}<li
											data-edit={inline({
												kind: 'bullet',
												section: section.key,
												id: entry.id,
												index
											})}
										>
											{bullet}
										</li>{/each}
								</ul>
							{/if}
						</div>
					{/each}
				{:else if section.type === 'skills'}
					{#each section.groups as group (group.key)}
						<p
							class="skill-group"
							data-form-field={form(`skills.${group.key}`)}
							data-form-section={form('skills')}
						>
							<strong>{group.label}:</strong>
							{group.items.join(', ')}
						</p>
					{/each}
				{/if}
			</section>
		{/each}
	</div>
</article>

<style>
	.creative-header {
		box-sizing: border-box;
		width: 210mm;
		min-height: 297mm;
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
		padding: 15mm 18mm 12mm;
		background: var(--accent);
		color: var(--accent-ink);
		break-inside: avoid;
	}
	.identity {
		flex: 1;
		min-width: 0;
	}
	h1 {
		font-size: 28pt;
		font-weight: 700;
		line-height: 1.2;
	}
	.headline {
		max-width: 140mm;
		margin-top: calc(3mm * var(--space-scale));
		font-size: 11pt;
	}
	img {
		box-sizing: border-box;
		flex: none;
		width: calc(30mm * var(--photo-scale));
		height: calc(30mm * var(--photo-scale));
		border: 0.75mm solid #fff;
		border-radius: var(--photo-radius);
		object-fit: cover;
	}
	.content {
		padding: 7mm 18mm 16mm;
	}
	.contact {
		display: flex;
		flex-wrap: wrap;
		gap: 1mm 5mm;
		padding-bottom: calc(4mm * var(--space-scale));
		border-bottom: 0.25mm solid #d8d6e2;
		font-size: 9pt;
	}
	a {
		color: inherit;
		text-decoration: underline;
		text-underline-offset: 1pt;
	}
	section {
		margin-top: calc(5mm * var(--space-scale));
	}
	h2 {
		margin-bottom: calc(2.5mm * var(--space-scale));
		padding-left: 3mm;
		border-left: 1.25mm solid var(--accent);
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
		margin-top: calc(3.5mm * var(--space-scale));
	}
	.entry-heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 2mm 5mm;
	}
	.date {
		flex-shrink: 0;
		font-size: 9pt;
	}
	.subtitle {
		font-weight: 600;
	}
	.description {
		margin-top: calc(1mm * var(--space-scale));
		white-space: pre-line;
	}
	.paragraph {
		white-space: pre-line;
		orphans: 3;
		widows: 3;
	}
	.paragraph + .paragraph,
	.skill-group + .skill-group {
		margin-top: calc(1.5mm * var(--space-scale));
	}
	ul {
		margin: calc(1.5mm * var(--space-scale)) 0 0;
		padding-left: 5mm;
		list-style: disc;
	}
	li + li {
		margin-top: calc(0.75mm * var(--space-scale));
	}
	@media print {
		.creative-header {
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
