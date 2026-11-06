<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { CvStore } from '#lib/core/store/cv-store.svelte.ts';
	import { LIMITS, newId, type PersonalInfo } from '#lib/core/schema/index.ts';
	import { assetRepo, incognito } from '#lib/core/storage/index.ts';
	import { PhotoError } from '#lib/core/security/photo.ts';
	import { normalizePhone, type StepIssue } from '#lib/core/wizard/index.ts';
	import { suggest, type SuggestionData } from '#lib/core/suggest/index.ts';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { getIncognitoUiContext } from '#lib/ui/incognito-context.ts';
	import Input from '../Input.svelte';
	import Autocomplete from '../Autocomplete.svelte';
	import ListEditor from '../ListEditor.svelte';
	import Button from '../Button.svelte';

	let {
		store,
		issues,
		suggestionsData,
		photoUrl
	}: {
		store: CvStore;
		issues: StepIssue[];
		suggestionsData?: SuggestionData;
		photoUrl?: string;
	} = $props();
	let busy = $state(false);
	let photoError = $state<MessageKey>();
	let pendingPhoto: Promise<boolean> | undefined;
	const incognitoUi = getIncognitoUiContext();
	let destroyed = false;
	onMount(() =>
		incognitoUi?.registerBeforeStart(async () => {
			// Photo processing may finish after an ordinary store flush.
			if (pendingPhoto && !(await pendingPhoto)) return false;
			await store.flush();
			return store.saveState !== 'error';
		})
	);
	onDestroy(() => {
		destroyed = true;
	});

	function error(field: string) {
		const issue = issues.find((issue) => issue.field === field);
		return issue ? t(issue.messageKey) : undefined;
	}
	function set<K extends keyof PersonalInfo>(key: K, value: PersonalInfo[K], structural = false) {
		store.update(
			(draft) => {
				draft.personal[key] = value;
			},
			{ coalesceKey: `personal.${key}${structural ? `.${newId()}` : ''}` }
		);
	}
	function normalize() {
		const value = normalizePhone(store.cv.personal.phone);
		if (value !== undefined && value !== store.cv.personal.phone) set('phone', value);
	}
	async function changePhoto(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file || busy) return;
		await trackPhoto(savePhoto(file));
	}
	async function trackPhoto(operation: Promise<boolean>) {
		pendingPhoto = operation;
		try {
			await operation;
		} finally {
			if (pendingPhoto === operation) pendingPhoto = undefined;
		}
	}
	async function savePhoto(file: File): Promise<boolean> {
		busy = true;
		photoError = undefined;
		try {
			const id = await assetRepo.putPhoto(file);
			if (destroyed || store.externalChange === 'removed') {
				await assetRepo.remove(id);
				return false;
			}
			// The previous photo is NOT deleted here: undo may restore it.
			// assetRepo.removeOrphans() (run when the app area opens) cleans it up later.
			set('photoAssetId', id);
			await store.flush();
			return store.saveState !== 'error';
		} catch (error) {
			photoError =
				error instanceof PhotoError ? `wizard.photoErrors.${error.code}` : 'wizard.photoFailed';
			return false;
		} finally {
			busy = false;
		}
	}
	async function removePhoto() {
		if (busy) return;
		await trackPhoto(clearPhoto());
	}
	async function clearPhoto(): Promise<boolean> {
		busy = true;
		photoError = undefined;
		try {
			// Kept in storage for undo; cleaned up later by assetRepo.removeOrphans().
			set('photoAssetId', undefined);
			await store.flush();
			return store.saveState !== 'error';
		} catch {
			photoError = 'wizard.photoFailed';
			return false;
		} finally {
			busy = false;
		}
	}
</script>

<div class="fields">
	<Input
		id="personal.fullName"
		label={t('wizard.fields.fullName')}
		required
		autocomplete={incognito.active ? 'off' : 'name'}
		maxlength={LIMITS.fullName}
		showCounter
		error={error('personal.fullName')}
		bind:value={() => store.cv.personal.fullName, (value) => set('fullName', value)}
	/>
	<Input
		id="personal.headline"
		label={t('wizard.fields.headline')}
		autocomplete={incognito.active ? 'off' : undefined}
		maxlength={LIMITS.headline}
		showCounter
		bind:value={() => store.cv.personal.headline, (value) => set('headline', value)}
	/>
	<Input
		id="personal.email"
		label={t('wizard.fields.email')}
		required
		type="email"
		autocomplete={incognito.active ? 'off' : 'email'}
		maxlength={LIMITS.email}
		showCounter
		error={error('personal.email')}
		bind:value={() => store.cv.personal.email, (value) => set('email', value)}
	/>
	<Input
		id="personal.phone"
		label={t('wizard.fields.phone')}
		required
		type="tel"
		autocomplete={incognito.active ? 'off' : 'tel'}
		maxlength={LIMITS.short}
		showCounter
		error={error('personal.phone')}
		onblur={normalize}
		bind:value={() => store.cv.personal.phone, (value) => set('phone', value)}
	/>
	<div class="pair">
		<Autocomplete
			id="personal.city"
			label={t('wizard.fields.city')}
			suggestions={(query) => (suggestionsData ? suggest(suggestionsData, 'city', query) : [])}
			maxlength={LIMITS.short}
			showCounter
			bind:value={() => store.cv.personal.city, (value) => set('city', value)}
		/>
		<Autocomplete
			id="personal.province"
			label={t('wizard.fields.province')}
			suggestions={(query) => (suggestionsData ? suggest(suggestionsData, 'province', query) : [])}
			maxlength={LIMITS.short}
			showCounter
			bind:value={() => store.cv.personal.province ?? '', (value) => set('province', value)}
		/>
	</div>
	<ListEditor
		label={t('wizard.fields.links')}
		getKey={(link) => link.id}
		getSummary={(link) => link.label.trim() || link.url.trim() || t('wizard.newItems.links')}
		emptyMessage={t('wizard.emptyLists.links')}
		onUndo={() => store.undo()}
		undoRevision={`${store.cv.updatedAt}:${store.externalChange}`}
		maxItems={LIMITS.links}
		onAdd={() => ({ id: newId(), label: '', url: '' })}
		bind:items={() => store.cv.personal.links, (value) => set('links', value, true)}
	>
		{#snippet item(link)}
			<div class="fields">
				<Input
					id={`personal.links.${link.id}.label`}
					label={t('wizard.fields.label')}
					autocomplete={incognito.active ? 'off' : undefined}
					maxlength={LIMITS.short}
					showCounter
					bind:value={
						() => link.label,
						(value) =>
							store.update(
								(draft) => {
									const found = draft.personal.links.find((item) => item.id === link.id);
									if (found) found.label = value;
								},
								{ coalesceKey: `personal.links.${link.id}.label` }
							)
					}
				/>
				<Input
					id={`personal.links.${link.id}.url`}
					label={t('wizard.fields.url')}
					type="url"
					autocomplete={incognito.active ? 'off' : undefined}
					maxlength={LIMITS.url}
					showCounter
					bind:value={
						() => link.url,
						(value) =>
							store.update(
								(draft) => {
									const found = draft.personal.links.find((item) => item.id === link.id);
									if (found) found.url = value;
								},
								{ coalesceKey: `personal.links.${link.id}.url` }
							)
					}
				/>
			</div>
		{/snippet}
	</ListEditor>
	{#if store.cv.kind === 'creative'}
		<div class="photo">
			<label for="personal.photoAssetId">{t('wizard.fields.photo')}</label>
			<p id="photo-hint" class="hint">{t('wizard.hints.photo')}</p>
			{#if photoUrl}<img src={photoUrl} alt={t('wizard.photoAlt')} width="96" height="96" />{/if}
			<input
				id="personal.photoAssetId"
				type="file"
				accept="image/*"
				disabled={busy}
				onchange={changePhoto}
				aria-describedby={photoError ? 'photo-hint photo-error' : 'photo-hint'}
				aria-invalid={photoError ? true : undefined}
			/>
			{#if busy}<p role="status">{t('wizard.photoBusy')}</p>{/if}
			{#if photoError}<p id="photo-error" class="error" role="alert">{t(photoError)}</p>{/if}
			{#if store.cv.personal.photoAssetId}<Button
					variant="secondary"
					disabled={busy}
					onclick={removePhoto}>{t('wizard.photoRemove')}</Button
				>{/if}
		</div>
	{:else}<p class="hint">{t('wizard.atsPhotoHint')}</p>{/if}
</div>

<style>
	.fields,
	.photo {
		display: grid;
		gap: 1.25rem;
		min-width: 0;
	}
	.pair {
		display: grid;
		gap: 1.25rem;
		min-width: 0;
	}
	.hint {
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
	label {
		font-size: 0.875rem;
		font-weight: 600;
	}
	.photo {
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-mint-50);
	}
	.photo img {
		object-fit: cover;
		border-radius: var(--radius-md);
	}
	input[type='file'] {
		width: 100%;
		min-width: 0;
		min-height: 48px;
		padding: 0.5rem;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text-muted);
	}
	input[type='file']::file-selector-button {
		min-height: 44px;
		margin-right: 0.75rem;
		padding: 0.625rem 1rem;
		border: 0;
		border-radius: var(--radius-md);
		background: var(--color-brand-50);
		color: var(--color-brand-ink);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		transition: background-color var(--motion-duration) ease-out;
	}
	input[type='file']::file-selector-button:hover {
		background: var(--color-secondary-hover);
	}
	.error {
		color: var(--color-danger);
	}
	@media (min-width: 640px) {
		.pair {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
