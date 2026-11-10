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
	import { formatDateRange } from '#lib/core/render/index.ts';
	import { defaultScoreScale, isSchoolLevel } from '#lib/core/education/index.ts';
	import { suggest, type SuggestField, type SuggestionData } from '#lib/core/suggest/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Input from '../Input.svelte';
	import Autocomplete from '../Autocomplete.svelte';
	import Textarea from '../Textarea.svelte';
	import Select from '../Select.svelte';
	import ListEditor from '../ListEditor.svelte';
	import MonthPicker from '../MonthPicker.svelte';
	import DateRangeFields from './DateRangeFields.svelte';
	import BulletEditor from './BulletEditor.svelte';
	import SkillTags from './SkillTags.svelte';
	import SkillRecommendations from './SkillRecommendations.svelte';

	let {
		store,
		step,
		issues,
		suggestionsData,
		onTarget,
		examples,
		skillSection
	}: {
		store: CvStore;
		step: WizardStepId;
		issues: StepIssue[];
		suggestionsData?: SuggestionData;
		onTarget?: () => void;
		examples?: Guidance;
		skillSection?: 'skills' | 'languages' | 'certifications' | 'awards';
	} = $props();

	function fieldSuggestions(field: SuggestField, query: string, popularWhenEmpty = false) {
		return suggestionsData ? suggest(suggestionsData, field, query, { popularWhenEmpty }) : [];
	}

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
			{ coalesceKey: `${section}.structure.${newId()}` }
		);
	}
	function editItem<K extends ItemSection>(
		section: K,
		id: string,
		field: string,
		change: (item: CVDocument[K][number]) => void,
		operation: 'edit' | 'structure' = 'edit'
	) {
		store.update(
			(draft) => {
				const item = draft[section].find((candidate) => candidate.id === id) as
					CVDocument[K][number] | undefined;
				if (item) change(item);
			},
			{ coalesceKey: `${section}.${id}.${field}${operation === 'structure' ? `.${newId()}` : ''}` }
		);
	}
	const editedScoreScales: Record<string, string[] | undefined> = Object.create(null);
	function editEducationDegree(id: string, degree: string) {
		editItem('education', id, 'degree', (entry) => {
			const scale = entry.gpaScale?.trim() ?? '';
			const manuallyEdited = editedScoreScales[id]?.includes(scale) ?? false;
			const defaultScale =
				scale === defaultScoreScale(entry.degree) || scale === defaultScoreScale(undefined);
			if (!scale || (!manuallyEdited && defaultScale)) {
				entry.gpaScale = defaultScoreScale(degree);
			}
			entry.degree = degree;
		});
	}
	function editEducationScale(id: string, value: string) {
		const scale = value.trim();
		if (!scale) editedScoreScales[id] = undefined;
		else {
			const edited = (editedScoreScales[id] ??= []);
			if (!edited.includes(scale)) edited.push(scale);
		}
		editItem('education', id, 'gpaScale', (entry) => {
			entry.gpaScale = value;
		});
	}
	function itemSummary(section: ItemSection, entry: CVDocument[ItemSection][number]) {
		let title = '';
		let dates: string | undefined;
		const join = (...parts: (string | undefined)[]) =>
			parts
				.map((part) => part?.trim())
				.filter(Boolean)
				.join(' — ');
		switch (section) {
			case 'education': {
				const value = entry as CVDocument['education'][number];
				title = join(value.institution, [value.degree, value.major].filter(Boolean).join(' '));
				dates = formatDateRange(value.dates, store.cv.locale);
				break;
			}
			case 'experience': {
				const value = entry as CVDocument['experience'][number];
				title = join(value.role, value.company);
				dates = formatDateRange(value.dates, store.cv.locale);
				break;
			}
			case 'organizations': {
				const value = entry as CVDocument['organizations'][number];
				title = join(value.role, value.name);
				dates = formatDateRange(value.dates, store.cv.locale);
				break;
			}
			case 'projects': {
				const value = entry as CVDocument['projects'][number];
				title = join(value.name, value.role);
				dates = formatDateRange(value.dates, store.cv.locale);
				break;
			}
			case 'languages': {
				const value = entry as CVDocument['languages'][number];
				title = value.name.trim()
					? join(value.name, t(`wizard.languageLevels.${value.level}`), value.score)
					: '';
				break;
			}
			case 'certifications': {
				const value = entry as CVDocument['certifications'][number];
				title = join(value.name, value.issuer);
				dates = formatDateRange({ start: value.date, current: false }, store.cv.locale);
				break;
			}
			case 'awards': {
				const value = entry as CVDocument['awards'][number];
				title = join(value.title, value.issuer);
				dates = formatDateRange({ start: value.date, current: false }, store.cv.locale);
				break;
			}
		}
		return [title || t(`wizard.newItems.${section}`), dates].filter(Boolean).join(' · ');
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

<div class="collection-steps" class:bullet-step={step !== 'skills'}>
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
				getKey={(entry) => entry.id}
				getSummary={(entry) => itemSummary('education', entry)}
				emptyMessage={t('wizard.emptyLists.education')}
				onUndo={() => store.undo()}
				undoRevision={`${store.cv.updatedAt}:${store.externalChange}`}
				showHeading={false}
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
					{@const school = isSchoolLevel(entry.degree)}
					<div class="item-fields">
						{#each ['institution', 'degree', 'major'] as field (field)}
							{@const key = field as 'institution' | 'degree' | 'major'}
							<Autocomplete
								id={`education.${entry.id}.${key}`}
								label={t(`wizard.fields.${key}`)}
								suggestions={(query) => fieldSuggestions(key, query, key === 'degree')}
								popularWhenEmpty={key === 'degree'}
								required={key === 'institution'}
								showCounter
								maxlength={key === 'degree' ? LIMITS.short : LIMITS.title}
								error={error(`education.${entry.id}.${key}`)}
								bind:value={
									() => entry[key],
									(value) => {
										if (key === 'degree') editEducationDegree(entry.id, value);
										else
											editItem('education', entry.id, key, (draft) => {
												draft[key] = value;
											});
									}
								}
							/>
						{/each}
						<div class="two-fields">
							<Input
								id={`education.${entry.id}.gpa`}
								label={t(school ? 'wizard.fields.reportGrade' : 'wizard.fields.gpa')}
								showCounter
								maxlength={LIMITS.short}
								hint={t(school ? 'wizard.hints.reportGrade' : 'wizard.hints.gpa')}
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
								label={t(school ? 'wizard.fields.scoreMaximum' : 'wizard.fields.gpaScale')}
								showCounter
								maxlength={LIMITS.short}
								bind:value={
									() => entry.gpaScale ?? '', (value) => editEducationScale(entry.id, value)
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
						{#if !school}<Textarea
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
							/>{/if}
						<BulletEditor
							id={`education.${entry.id}.highlights`}
							label={t('wizard.fields.highlights')}
							items={entry.highlights}
							onChange={(items, operation) =>
								editItem(
									'education',
									entry.id,
									'highlights',
									(draft) => {
										draft.highlights = items;
									},
									operation
								)}
						/>
					</div>
				{/snippet}
			</ListEditor>
		</section>
	{:else if step === 'experience'}
		<ListEditor
			label={t('wizard.steps.experience.title')}
			getKey={(entry) => entry.id}
			getSummary={(entry) => itemSummary('experience', entry)}
			emptyMessage={t('wizard.emptyLists.experience')}
			onUndo={() => store.undo()}
			undoRevision={`${store.cv.updatedAt}:${store.externalChange}`}
			showHeading={false}
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
						{#if key === 'role'}
							<Autocomplete
								id={`experience.${entry.id}.${key}`}
								label={t(`wizard.fields.${key}`)}
								suggestions={(query) => fieldSuggestions('jobTitle', query)}
								showCounter
								maxlength={LIMITS.title}
								error={error(`experience.${entry.id}.${key}`)}
								bind:value={
									() => entry[key],
									(value) =>
										editItem('experience', entry.id, key, (draft) => {
											draft[key] = value;
										})
								}
							/>
						{:else}
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
						{/if}
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
						items={entry.bullets}
						examples={experienceExamples(entry.type)}
						onChange={(items, operation) =>
							editItem(
								'experience',
								entry.id,
								'bullets',
								(draft) => {
									draft.bullets = items;
								},
								operation
							)}
					/>
				</div>
			{/snippet}
		</ListEditor>
	{:else if step === 'organizations'}
		<ListEditor
			label={t('wizard.steps.organizations.title')}
			getKey={(entry) => entry.id}
			getSummary={(entry) => itemSummary('organizations', entry)}
			emptyMessage={t('wizard.emptyLists.organizations')}
			onUndo={() => store.undo()}
			undoRevision={`${store.cv.updatedAt}:${store.externalChange}`}
			showHeading={false}
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
						{#if key === 'role'}
							<Autocomplete
								id={`organizations.${entry.id}.${key}`}
								label={t(`wizard.fields.${key}`)}
								suggestions={(query) => fieldSuggestions('orgRole', query, true)}
								popularWhenEmpty
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
						{:else}
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
						{/if}
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
						items={entry.bullets}
						examples={[
							...(examples?.exampleBullets.organization ?? []),
							...(examples?.exampleBullets.committee ?? [])
						]}
						onChange={(items, operation) =>
							editItem(
								'organizations',
								entry.id,
								'bullets',
								(draft) => {
									draft.bullets = items;
								},
								operation
							)}
					/>
				</div>
			{/snippet}
		</ListEditor>
	{:else if step === 'projects'}
		<ListEditor
			label={t('wizard.steps.projects.title')}
			getKey={(entry) => entry.id}
			getSummary={(entry) => itemSummary('projects', entry)}
			emptyMessage={t('wizard.emptyLists.projects')}
			onUndo={() => store.undo()}
			undoRevision={`${store.cv.updatedAt}:${store.externalChange}`}
			showHeading={false}
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
						items={entry.bullets}
						examples={examples?.exampleBullets.project}
						onChange={(items, operation) =>
							editItem(
								'projects',
								entry.id,
								'bullets',
								(draft) => {
									draft.bullets = items;
								},
								operation
							)}
					/>
				</div>
			{/snippet}
		</ListEditor>
	{:else if step === 'skills'}
		<div class="skills-sections">
			{#if !skillSection || skillSection === 'skills'}
				{#if suggestionsData}<SkillRecommendations {store} data={suggestionsData} {onTarget} />{/if}
				{#each ['hard', 'soft', 'tools'] as field (field)}
					{@const group = field as 'hard' | 'soft' | 'tools'}
					<SkillTags
						id={`skills.${group}`}
						label={t(`wizard.fields.${group}`)}
						items={store.cv.skills[group]}
						{suggestionsData}
						suggestField={group === 'hard'
							? 'skillHard'
							: group === 'soft'
								? 'skillSoft'
								: 'skillTool'}
						onChange={(items) =>
							store.update(
								(draft) => {
									draft.skills[group] = items;
								},
								{ coalesceKey: `skills.${group}.structure.${newId()}` }
							)}
					/>
				{/each}
			{/if}
			{#if !skillSection || skillSection === 'languages'}
				<ListEditor
					label={t('wizard.fields.languages')}
					getKey={(entry) => entry.id}
					getSummary={(entry) => itemSummary('languages', entry)}
					emptyMessage={t('wizard.emptyLists.languages')}
					onUndo={() => store.undo()}
					undoRevision={`${store.cv.updatedAt}:${store.externalChange}`}
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
							<Autocomplete
								id={`languages.${entry.id}.name`}
								label={t('wizard.fields.name')}
								suggestions={(query) => fieldSuggestions('language', query, true)}
								popularWhenEmpty
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
			{/if}
			{#if !skillSection || skillSection === 'certifications'}
				<ListEditor
					label={t('wizard.fields.certifications')}
					getKey={(entry) => entry.id}
					getSummary={(entry) => itemSummary('certifications', entry)}
					emptyMessage={t('wizard.emptyLists.certifications')}
					onUndo={() => store.undo()}
					undoRevision={`${store.cv.updatedAt}:${store.externalChange}`}
					maxItems={LIMITS.itemsPerSection}
					bind:items={
						() => store.cv.certifications, (items) => replaceItems('certifications', items)
					}
					onAdd={(): CVDocument['certifications'][number] => ({
						id: newId(),
						name: '',
						issuer: ''
					})}
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
			{/if}
			{#if !skillSection || skillSection === 'awards'}
				<ListEditor
					label={t('wizard.fields.awards')}
					getKey={(entry) => entry.id}
					getSummary={(entry) => itemSummary('awards', entry)}
					emptyMessage={t('wizard.emptyLists.awards')}
					onUndo={() => store.undo()}
					undoRevision={`${store.cv.updatedAt}:${store.externalChange}`}
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
			{/if}
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
	@media (max-width: 480px) {
		.bullet-step :global(.list-editor > ol > li) {
			border-color: transparent;
		}
		.bullet-step :global(.card-summary) {
			background: var(--color-brand-50);
		}
	}
</style>
