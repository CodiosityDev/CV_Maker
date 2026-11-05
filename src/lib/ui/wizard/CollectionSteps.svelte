<script lang="ts">
	import {
		EXPERIENCE_TYPES,
		LANGUAGE_LEVELS,
		LIMITS,
		newId,
		type CVDocument,
		type ExperienceType,
		type LanguageLevel
	} from '#lib/core/schema/index.ts';
	import type { CvStore } from '#lib/core/store/cv-store.svelte.ts';
	import type { StepIssue, WizardStepId } from '#lib/core/wizard/index.ts';
	import type { Guidance } from '#lib/core/content/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Input from '../Input.svelte';
	import Textarea from '../Textarea.svelte';
	import Select from '../Select.svelte';
	import ListEditor from '../ListEditor.svelte';
	import MonthPicker from '../MonthPicker.svelte';
	import DateRangeFields from './DateRangeFields.svelte';
	import BulletEditor from './BulletEditor.svelte';
	import SkillTags from './SkillTags.svelte';

	let {
		store,
		step,
		issues,
		guidance,
		examples
	}: {
		store: CvStore;
		step: WizardStepId;
		issues: StepIssue[];
		guidance?: Guidance;
		examples?: Guidance;
	} = $props();

	type ItemSection =
		| 'education'
		| 'experience'
		| 'organizations'
		| 'projects'
		| 'languages'
		| 'certifications'
		| 'awards';
	function replaceItems<K extends ItemSection>(section: K, items: CVDocument[K]) {
		store.update(
			(draft) => {
				draft[section] = items;
			},
			{ coalesceKey: section }
		);
	}
	function editItem<K extends ItemSection>(
		section: K,
		id: string,
		field: string,
		change: (item: CVDocument[K][number]) => void
	) {
		store.update(
			(draft) => {
				const item = draft[section].find((candidate) => candidate.id === id) as
					CVDocument[K][number] | undefined;
				if (item) change(item);
			},
			{ coalesceKey: `${section}.${id}.${field}` }
		);
	}
	function error(field: string) {
		const issue = issues.find((item) => item.field === field);
		return issue ? t(issue.messageKey) : undefined;
	}
	function experienceExamples(type: ExperienceType) {
		const kind = type === 'parttime' || type === 'volunteer' ? type : 'internship';
		return examples?.exampleBullets[kind] ?? [];
	}
	const experienceOptions = $derived(
		EXPERIENCE_TYPES.map((value) => ({ value, label: t(`wizard.experienceTypes.${value}`) }))
	);
	const languageOptions = $derived(
		LANGUAGE_LEVELS.map((value) => ({ value, label: t(`wizard.languageLevels.${value}`) }))
	);
</script>

<div class="collection-steps">
	{#if step === 'education'}
		<section
			id="education"
			tabindex="-1"
			aria-label={t('wizard.steps.education.title')}
			aria-describedby={error('education') ? 'education-error' : undefined}
		>
			{#if error('education')}<p id="education-error" class="error">{error('education')}</p>{/if}
			<ListEditor
				label={t('wizard.steps.education.title')}
				maxItems={LIMITS.itemsPerSection}
				bind:items={() => store.cv.education, (items) => replaceItems('education', items)}
				onAdd={(): CVDocument['education'][number] => ({
					id: newId(),
					institution: '',
					degree: '',
					major: '',
					gpaScale: '4.00',
					dates: { current: false },
					highlights: []
				})}
			>
				{#snippet item(entry)}
					<div class="item-fields">
						{#each ['institution', 'degree', 'major'] as field (field)}
							{@const key = field as 'institution' | 'degree' | 'major'}
							<Input
								id={`education.${entry.id}.${key}`}
								label={t(`wizard.fields.${key}`)}
								required={key === 'institution'}
								showCounter
								maxlength={key === 'degree' ? LIMITS.short : LIMITS.title}
								error={error(`education.${entry.id}.${key}`)}
								bind:value={
									() => entry[key],
									(value) =>
										editItem('education', entry.id, key, (draft) => {
											draft[key] = value;
										})
								}
							/>
						{/each}
						<div class="two-fields">
							<Input
								id={`education.${entry.id}.gpa`}
								label={t('wizard.fields.gpa')}
								showCounter
								maxlength={LIMITS.short}
								hint={guidance?.fieldTips.gpa}
								bind:value={
									() => entry.gpa ?? '',
									(value) =>
										editItem('education', entry.id, 'gpa', (draft) => {
											draft.gpa = value;
										})
								}
							/>
							<Input
								id={`education.${entry.id}.gpaScale`}
								label={t('wizard.fields.gpaScale')}
								showCounter
								maxlength={LIMITS.short}
								bind:value={
									() => entry.gpaScale ?? '',
									(value) =>
										editItem('education', entry.id, 'gpaScale', (draft) => {
											draft.gpaScale = value;
										})
								}
							/>
						</div>
						<DateRangeFields
							id={`education.${entry.id}.dates`}
							range={entry.dates}
							error={error(`education.${entry.id}.dates`)}
							onChange={(range, field) =>
								editItem('education', entry.id, `dates.${field}`, (draft) => {
									draft.dates = range;
								})}
						/>
						<Textarea
							id={`education.${entry.id}.thesisTitle`}
							label={t('wizard.fields.thesisTitle')}
							showCounter
							maxlength={LIMITS.description}
							rows={2}
							bind:value={
								() => entry.thesisTitle ?? '',
								(value) =>
									editItem('education', entry.id, 'thesisTitle', (draft) => {
										draft.thesisTitle = value;
									})
							}
						/>
						<BulletEditor
							id={`education.${entry.id}.highlights`}
							label={t('wizard.fields.highlights')}
							items={entry.highlights}
							onChange={(items) =>
								editItem('education', entry.id, 'highlights', (draft) => {
									draft.highlights = items;
								})}
						/>
					</div>
				{/snippet}
			</ListEditor>
		</section>
	{:else if step === 'experience'}
		<ListEditor
			label={t('wizard.steps.experience.title')}
			maxItems={LIMITS.itemsPerSection}
			bind:items={() => store.cv.experience, (items) => replaceItems('experience', items)}
			onAdd={(): CVDocument['experience'][number] => ({
				id: newId(),
				type: 'internship',
				role: '',
				company: '',
				location: '',
				dates: { current: false },
				bullets: []
			})}
		>
			{#snippet item(entry)}
				<div class="item-fields">
					<Select
						id={`experience.${entry.id}.type`}
						label={t('wizard.fields.type')}
						options={experienceOptions}
						bind:value={
							() => entry.type,
							(value) =>
								editItem('experience', entry.id, 'type', (draft) => {
									draft.type = value as ExperienceType;
								})
						}
					/>
					{#each ['role', 'company', 'location'] as field (field)}
						{@const key = field as 'role' | 'company' | 'location'}
						<Input
							id={`experience.${entry.id}.${key}`}
							label={t(`wizard.fields.${key}`)}
							showCounter
							maxlength={key === 'location' ? LIMITS.short : LIMITS.title}
							error={error(`experience.${entry.id}.${key}`)}
							bind:value={
								() => entry[key] ?? '',
								(value) =>
									editItem('experience', entry.id, key, (draft) => {
										draft[key] = value;
									})
							}
						/>
					{/each}
					<DateRangeFields
						id={`experience.${entry.id}.dates`}
						range={entry.dates}
						error={error(`experience.${entry.id}.dates`)}
						onChange={(range, field) =>
							editItem('experience', entry.id, `dates.${field}`, (draft) => {
								draft.dates = range;
							})}
					/>
					<BulletEditor
						id={`experience.${entry.id}.bullets`}
						label={t('wizard.fields.bullets')}
						hint={guidance?.fieldTips.bullets}
						items={entry.bullets}
						examples={experienceExamples(entry.type)}
						onChange={(items) =>
							editItem('experience', entry.id, 'bullets', (draft) => {
								draft.bullets = items;
							})}
					/>
				</div>
			{/snippet}
		</ListEditor>
	{:else if step === 'organizations'}
		<ListEditor
			label={t('wizard.steps.organizations.title')}
			maxItems={LIMITS.itemsPerSection}
			bind:items={() => store.cv.organizations, (items) => replaceItems('organizations', items)}
			onAdd={(): CVDocument['organizations'][number] => ({
				id: newId(),
				name: '',
				role: '',
				dates: { current: false },
				bullets: []
			})}
		>
			{#snippet item(entry)}
				<div class="item-fields">
					{#each ['name', 'role'] as field (field)}
						{@const key = field as 'name' | 'role'}
						<Input
							id={`organizations.${entry.id}.${key}`}
							label={t(`wizard.fields.${key}`)}
							showCounter
							maxlength={LIMITS.title}
							error={error(`organizations.${entry.id}.${key}`)}
							bind:value={
								() => entry[key],
								(value) =>
									editItem('organizations', entry.id, key, (draft) => {
										draft[key] = value;
									})
							}
						/>
					{/each}
					<DateRangeFields
						id={`organizations.${entry.id}.dates`}
						range={entry.dates}
						error={error(`organizations.${entry.id}.dates`)}
						onChange={(range, field) =>
							editItem('organizations', entry.id, `dates.${field}`, (draft) => {
								draft.dates = range;
							})}
					/>
					<BulletEditor
						id={`organizations.${entry.id}.bullets`}
						label={t('wizard.fields.bullets')}
						hint={guidance?.fieldTips.bullets}
						items={entry.bullets}
						examples={[
							...(examples?.exampleBullets.organization ?? []),
							...(examples?.exampleBullets.committee ?? [])
						]}
						onChange={(items) =>
							editItem('organizations', entry.id, 'bullets', (draft) => {
								draft.bullets = items;
							})}
					/>
				</div>
			{/snippet}
		</ListEditor>
	{:else if step === 'projects'}
		<ListEditor
			label={t('wizard.steps.projects.title')}
			maxItems={LIMITS.itemsPerSection}
			bind:items={() => store.cv.projects, (items) => replaceItems('projects', items)}
			onAdd={(): CVDocument['projects'][number] => ({
				id: newId(),
				name: '',
				role: '',
				url: '',
				bullets: []
			})}
		>
			{#snippet item(entry)}
				<div class="item-fields">
					{#each ['name', 'role'] as field (field)}
						{@const key = field as 'name' | 'role'}
						<Input
							id={`projects.${entry.id}.${key}`}
							label={t(`wizard.fields.${key}`)}
							showCounter
							maxlength={LIMITS.title}
							error={error(`projects.${entry.id}.${key}`)}
							bind:value={
								() => entry[key] ?? '',
								(value) =>
									editItem('projects', entry.id, key, (draft) => {
										draft[key] = value;
									})
							}
						/>
					{/each}
					<Input
						id={`projects.${entry.id}.url`}
						type="url"
						label={t('wizard.fields.url')}
						showCounter
						maxlength={LIMITS.url}
						bind:value={
							() => entry.url ?? '',
							(value) =>
								editItem('projects', entry.id, 'url', (draft) => {
									draft.url = value;
								})
						}
					/>
					<DateRangeFields
						id={`projects.${entry.id}.dates`}
						range={entry.dates}
						error={error(`projects.${entry.id}.dates`)}
						onChange={(range, field) =>
							editItem('projects', entry.id, `dates.${field}`, (draft) => {
								draft.dates = range;
							})}
					/>
					<BulletEditor
						id={`projects.${entry.id}.bullets`}
						label={t('wizard.fields.bullets')}
						hint={guidance?.fieldTips.bullets}
						items={entry.bullets}
						examples={examples?.exampleBullets.project}
						onChange={(items) =>
							editItem('projects', entry.id, 'bullets', (draft) => {
								draft.bullets = items;
							})}
					/>
				</div>
			{/snippet}
		</ListEditor>
	{:else if step === 'skills'}
		<div class="skills-sections">
			{#each ['hard', 'soft', 'tools'] as field (field)}
				{@const group = field as 'hard' | 'soft' | 'tools'}
				<SkillTags
					id={`skills.${group}`}
					label={t(`wizard.fields.${group}`)}
					items={store.cv.skills[group]}
					hint={group === 'hard' ? guidance?.fieldTips.skills : undefined}
					onChange={(items) =>
						store.update(
							(draft) => {
								draft.skills[group] = items;
							},
							{ coalesceKey: `skills.${group}` }
						)}
				/>
			{/each}
			<ListEditor
				label={t('wizard.fields.languages')}
				maxItems={LIMITS.itemsPerSection}
				bind:items={() => store.cv.languages, (items) => replaceItems('languages', items)}
				onAdd={(): CVDocument['languages'][number] => ({
					id: newId(),
					name: '',
					level: 'basic',
					score: ''
				})}
			>
				{#snippet item(entry)}
					<div class="item-fields">
						<Input
							id={`languages.${entry.id}.name`}
							label={t('wizard.fields.name')}
							showCounter
							maxlength={LIMITS.short}
							bind:value={
								() => entry.name,
								(value) =>
									editItem('languages', entry.id, 'name', (draft) => {
										draft.name = value;
									})
							}
						/>
						<Select
							id={`languages.${entry.id}.level`}
							label={t('wizard.fields.level')}
							options={languageOptions}
							bind:value={
								() => entry.level,
								(value) =>
									editItem('languages', entry.id, 'level', (draft) => {
										draft.level = value as LanguageLevel;
									})
							}
						/>
						<Input
							id={`languages.${entry.id}.score`}
							label={t('wizard.fields.score')}
							showCounter
							maxlength={LIMITS.short}
							bind:value={
								() => entry.score ?? '',
								(value) =>
									editItem('languages', entry.id, 'score', (draft) => {
										draft.score = value;
									})
							}
						/>
					</div>
				{/snippet}
			</ListEditor>
			<ListEditor
				label={t('wizard.fields.certifications')}
				maxItems={LIMITS.itemsPerSection}
				bind:items={() => store.cv.certifications, (items) => replaceItems('certifications', items)}
				onAdd={(): CVDocument['certifications'][number] => ({ id: newId(), name: '', issuer: '' })}
			>
				{#snippet item(entry)}
					<div class="item-fields">
						{#each ['name', 'issuer'] as field (field)}
							{@const key = field as 'name' | 'issuer'}
							<Input
								id={`certifications.${entry.id}.${key}`}
								label={t(`wizard.fields.${key}`)}
								showCounter
								maxlength={LIMITS.title}
								bind:value={
									() => entry[key],
									(value) =>
										editItem('certifications', entry.id, key, (draft) => {
											draft[key] = value;
										})
								}
							/>
						{/each}
						<MonthPicker
							id={`certifications.${entry.id}.date`}
							label={t('wizard.fields.date')}
							bind:value={
								() => entry.date,
								(value) =>
									editItem('certifications', entry.id, 'date', (draft) => {
										draft.date = value;
									})
							}
						/>
						<Input
							id={`certifications.${entry.id}.credentialUrl`}
							type="url"
							label={t('wizard.fields.credentialUrl')}
							showCounter
							maxlength={LIMITS.url}
							bind:value={
								() => entry.credentialUrl ?? '',
								(value) =>
									editItem('certifications', entry.id, 'credentialUrl', (draft) => {
										draft.credentialUrl = value;
									})
							}
						/>
					</div>
				{/snippet}
			</ListEditor>
			<ListEditor
				label={t('wizard.fields.awards')}
				maxItems={LIMITS.itemsPerSection}
				bind:items={() => store.cv.awards, (items) => replaceItems('awards', items)}
				onAdd={(): CVDocument['awards'][number] => ({ id: newId(), title: '', issuer: '' })}
			>
				{#snippet item(entry)}
					<div class="item-fields">
						{#each ['title', 'issuer'] as field (field)}
							{@const key = field as 'title' | 'issuer'}
							<Input
								id={`awards.${entry.id}.${key}`}
								label={t(key === 'title' ? 'wizard.fields.awardTitle' : 'wizard.fields.issuer')}
								showCounter
								maxlength={LIMITS.title}
								bind:value={
									() => entry[key],
									(value) =>
										editItem('awards', entry.id, key, (draft) => {
											draft[key] = value;
										})
								}
							/>
						{/each}
						<MonthPicker
							id={`awards.${entry.id}.date`}
							label={t('wizard.fields.date')}
							bind:value={
								() => entry.date,
								(value) =>
									editItem('awards', entry.id, 'date', (draft) => {
										draft.date = value;
									})
							}
						/>
						<Textarea
							id={`awards.${entry.id}.description`}
							label={t('wizard.fields.description')}
							showCounter
							maxlength={LIMITS.description}
							bind:value={
								() => entry.description ?? '',
								(value) =>
									editItem('awards', entry.id, 'description', (draft) => {
										draft.description = value;
									})
							}
						/>
					</div>
				{/snippet}
			</ListEditor>
		</div>
	{/if}
</div>

<style>
	.collection-steps,
	section {
		min-width: 0;
	}
	.item-fields {
		display: grid;
		gap: 1.25rem;
		min-width: 0;
	}
	.two-fields {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}
	.skills-sections {
		display: grid;
		gap: 2rem;
		min-width: 0;
	}
	.error {
		margin: 0 0 1rem;
		color: var(--color-danger);
		font-size: 0.875rem;
		line-height: 1.6;
	}
</style>
