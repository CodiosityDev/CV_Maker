<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- RenderModel supplies validated external, email and phone URLs; templates display them unchanged. */
	import type { RenderModel } from '#lib/core/render/index.ts';
	let { model }: { model: RenderModel } = $props();
</script>

<article class="ats-ringkas" data-template="ats-ringkas" lang={model.locale}>
	<h1>{model.personal.fullName}</h1>
	{#if model.personal.headline}<p class="headline">{model.personal.headline}</p>{/if}
	<p class="contact">
		{#if model.personal.email}
			<span>
				{model.labels.email}:
				<a href={model.personal.emailHref} rel="noopener noreferrer">{model.personal.email}</a>
			</span>
		{/if}
		{#if model.personal.phone}
			{#if model.personal.email}<span aria-hidden="true"> · </span>{/if}
			<span>
				{model.labels.phone}:
				<a href={model.personal.phoneHref} rel="noopener noreferrer">{model.personal.phone}</a>
			</span>
		{/if}
		{#if model.personal.location}
			{#if model.personal.email || model.personal.phone}<span aria-hidden="true"> · </span>{/if}
			<span>{model.labels.location}: {model.personal.location}</span>
		{/if}
		{#each model.personal.links as link, index (index)}
			{#if model.personal.email || model.personal.phone || model.personal.location || index > 0}
				<span aria-hidden="true"> · </span>
			{/if}
			<span>{link.label}: <a href={link.href} rel="noopener noreferrer">{link.display}</a></span>
		{/each}
	</p>

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
						<h3>{entry.title}</h3>
						{#if entry.subtitle || entry.dateText || entry.location || entry.meta.length}
							<p class="entry-meta">
								{#if entry.subtitle}<span class="subtitle">{entry.subtitle}</span>{/if}
								{#if entry.dateText}
									{#if entry.subtitle}<span aria-hidden="true"> · </span>{/if}
									<span class="date">{entry.dateText}</span>
								{/if}
								{#if entry.location}
									{#if entry.subtitle || entry.dateText}<span aria-hidden="true"> · </span>{/if}
									<span>{entry.location}</span>
								{/if}
								{#each entry.meta as fact, index (index)}
									{#if entry.subtitle || entry.dateText || entry.location || index > 0}
										<span aria-hidden="true"> · </span>
									{/if}
									<span>{fact}</span>
								{/each}
							</p>
						{/if}
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
				<p class="skills">
					{#each section.groups as group, index (group.key)}
						{#if index > 0}<span aria-hidden="true"> · </span>{/if}
						<span><strong>{group.label}:</strong> {group.items.join(', ')}</span>
					{/each}
				</p>
			{/if}
		</section>
	{/each}
</article>

<style>
	.ats-ringkas {
		box-sizing: border-box;
		width: 210mm;
		min-height: 297mm;
		padding: 10mm;
		background: #fff;
		color: #171717;
		font-family: Arial, Helvetica, 'Liberation Sans', sans-serif;
		font-size: 10pt;
		font-weight: 400;
		line-height: 1.2;
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
		font-size: 20pt;
		font-weight: 700;
		line-height: 1.1;
	}
	.headline {
		margin-top: 1.5mm;
		font-size: 10.5pt;
	}
	.contact {
		margin-top: 2mm;
	}
	a {
		color: inherit;
		text-decoration: underline;
		text-underline-offset: 1pt;
	}
	section {
		margin-top: 2mm;
	}
	h2 {
		margin-bottom: 1.5mm;
		padding-bottom: 0.75mm;
		border-bottom: 0.2mm solid #555;
		font-size: 11pt;
		font-weight: 700;
		line-height: 1.2;
		break-after: avoid;
	}
	h3 {
		font-size: 10pt;
		font-weight: 700;
		line-height: 1.2;
	}
	.entry {
		break-inside: avoid;
	}
	.entry + .entry {
		margin-top: 2mm;
	}
	.subtitle {
		font-weight: 600;
	}
	.date {
		color: #333;
	}
	.description {
		margin-top: 0.75mm;
		white-space: pre-line;
	}
	.paragraph {
		white-space: pre-line;
		orphans: 3;
		widows: 3;
	}
	.paragraph + .paragraph {
		margin-top: 1mm;
	}
	ul {
		margin: 1mm 0 0;
		padding-left: 4mm;
		list-style: disc;
	}
	li {
		padding-left: 0.25mm;
	}
	li + li {
		margin-top: 0.5mm;
	}
	@media print {
		.ats-ringkas {
			width: 210mm;
			min-height: 297mm;
			print-color-adjust: exact;
		}
		a {
			text-decoration: none;
		}
	}
</style>
