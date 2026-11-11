<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- RenderModel supplies validated external, email and phone URLs; templates display them unchanged. */
	import type { RenderModel, RenderSection } from '#lib/core/render/index.ts';
	import { editKey, type EditTarget } from '#lib/core/design/edit.ts';
	let { model }: { model: RenderModel } = $props();

	let accent = $derived(model.theme.accentColor ?? '#9C9AFF');
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
</script>

<article
	class="creative-timeline"
	data-template="creative-timeline"
	data-visual-column={form('main')}
	lang={model.locale}
	style={`--accent: ${accent}; --space-scale: ${spaceScale}; --photo-scale: ${photoScale}; --photo-radius: ${photoRadius};`}
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
				<div class:timeline={['experience', 'education', 'organizations'].includes(section.key)}>
					{#each section.entries as entry (entry.id)}
						<div class="entry" data-visual-entry={form(entry.id)}>
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
							{#if entry.dateText}<p
									class="date"
									data-form-field={dateField(section.key, entry.id)}
									data-form-section={form(section.key)}
								>
									{entry.dateText}
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
				</div>
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
		margin-top: calc(3mm * var(--space-scale));
		font-size: 11pt;
	}
	img {
		box-sizing: border-box;
		flex: none;
		width: calc(28mm * var(--photo-scale));
		height: calc(28mm * var(--photo-scale));
		border: 1mm solid var(--accent);
		border-radius: var(--photo-radius);
		object-fit: cover;
	}
	.contact {
		display: flex;
		flex-wrap: wrap;
		gap: 1mm 5mm;
		margin-top: calc(5mm * var(--space-scale));
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
		margin-bottom: calc(3mm * var(--space-scale));
		padding-bottom: calc(1mm * var(--space-scale));
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
		margin-top: calc(3.5mm * var(--space-scale));
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
