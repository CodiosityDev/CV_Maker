<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import {
		Accordion,
		BottomSheet,
		Button,
		Card,
		Checkbox,
		Dialog,
		Input,
		LanguageSwitcher,
		ListEditor,
		MonthPicker,
		Select,
		Stepper,
		Textarea,
		Toggle,
		toast
	} from '#lib/ui/index.ts';

	type Project = { name: string };
	let name = $state('');
	let summary = $state('');
	let cvKind = $state('');
	let includeProjects = $state(false);
	let showSection = $state(true);
	let dialogOpen = $state(false);
	let sheetOpen = $state(false);
	let disabledDialogOpen = $state(false);
	let disabledSheetOpen = $state(false);
	let endDate = $state<string | undefined>();
	let untilPresent = $state(false);
	let projects = $state<Project[]>([
		{ name: t('ui.itemExample', { number: 1 }) },
		{ name: t('ui.itemExample', { number: 2 }) }
	]);
	let emptyProjects = $state<Project[]>([]);

	const options = $derived([
		{ value: '', label: t('ui.chooseOption') },
		{ value: 'ats', label: t('ui.atsOption') },
		{ value: 'creative', label: t('ui.creativeOption') }
	]);
	const steps = $derived([
		t('ui.stepType'),
		t('ui.stepPersonal'),
		t('ui.stepEducation'),
		t('ui.stepReview')
	]);
	const variants = $derived([
		{ value: 'primary' as const, label: t('ui.primary') },
		{ value: 'secondary' as const, label: t('ui.secondary') },
		{ value: 'ghost' as const, label: t('ui.ghost') },
		{ value: 'danger' as const, label: t('ui.danger') }
	]);
	const sizes = $derived([
		{ value: 'sm' as const, label: t('ui.small') },
		{ value: 'md' as const, label: t('ui.medium') },
		{ value: 'lg' as const, label: t('ui.large') }
	]);
</script>

<svelte:head>
	<title>{t('ui.showcaseTitle')}</title>
	<meta name="description" content={t('ui.showcaseIntro')} />
</svelte:head>

<main id="main" tabindex="-1" class="showcase">
	<header class="intro">
		<h1>{t('ui.showcaseHeading')}</h1>
		<p>{t('ui.showcaseIntro')}</p>
	</header>

	<section aria-labelledby="showcase-buttons">
		<h2 id="showcase-buttons">{t('ui.buttons')}</h2>
		{#each variants as variant (variant.value)}
			<div class="button-group">
				{#each sizes as size (size.value)}
					<Button variant={variant.value} size={size.value}>
						{variant.label} · {size.label}
					</Button>
				{/each}
				<Button variant={variant.value} disabled>{variant.label} · {t('ui.disabled')}</Button>
				<Button variant={variant.value} loading>{variant.label}</Button>
			</div>
		{/each}
		<div class="button-group">
			<Button href="/">{t('ui.linkButton')}</Button>
			<Button href="/" disabled>{t('ui.linkButton')} · {t('ui.disabled')}</Button>
		</div>
	</section>

	<section aria-labelledby="showcase-fields">
		<h2 id="showcase-fields">{t('ui.fields')}</h2>
		<div class="grid">
			<Input
				label={t('ui.nameLabel')}
				placeholder={t('ui.namePlaceholder')}
				hint={t('ui.nameHint')}
				bind:value={name}
				required
				maxlength={100}
				showCounter
			/>
			<Input label={t('ui.emailLabel')} type="email" error={t('ui.emailError')} required />
			<Input label={t('ui.disabledField')} disabled />
			<Select label={t('ui.selectLabel')} {options} bind:value={cvKind} required />
			<Select label={t('ui.selectLabel')} {options} error={t('ui.chooseOption')} />
			<Select label={t('ui.disabledField')} {options} value="ats" disabled />
			<Textarea
				label={t('ui.summaryLabel')}
				hint={t('ui.summaryHint')}
				bind:value={summary}
				maxlength={800}
				required
			/>
			<Textarea label={t('ui.summaryLabel')} error={t('ui.required')} maxlength={800} />
			<Textarea label={t('ui.disabledField')} disabled />
		</div>
	</section>

	<section aria-labelledby="showcase-choices">
		<h2 id="showcase-choices">{t('ui.choices')}</h2>
		<div class="grid">
			<div class="stack">
				<Checkbox label={t('ui.checkboxLabel')} bind:checked={includeProjects} />
				<Checkbox label={t('ui.checkboxLabel')} checked />
				<Checkbox label={t('ui.disabled')} disabled />
				<Checkbox label={t('ui.disabled')} checked disabled />
			</div>
			<div class="stack">
				<Toggle label={t('ui.toggleLabel')} bind:checked={showSection} />
				<Toggle label={t('ui.toggleLabel')} />
				<Toggle label={t('ui.disabled')} disabled />
				<Toggle label={t('ui.disabled')} checked disabled />
			</div>
		</div>
	</section>

	<section aria-labelledby="showcase-progress">
		<h2 id="showcase-progress">{t('ui.progress')}</h2>
		<div class="stack">
			<Stepper {steps} current={2} />
			<Stepper {steps} current={0} disabled />
		</div>
	</section>

	<section aria-labelledby="showcase-cards">
		<h2 id="showcase-cards">{t('ui.cards')}</h2>
		<div class="grid">
			<Card>
				{#snippet header()}<h3>{t('ui.cardTitle')}</h3>{/snippet}
				<p>{t('ui.cardBody')}</p>
				{#snippet footer()}<p>{t('ui.cardFooter')}</p>{/snippet}
			</Card>
			<Card><p>{t('ui.cardBody')}</p></Card>
			<Card disabled>
				{#snippet header()}<h3>{t('ui.disabled')}</h3>{/snippet}
				<p>{t('ui.cardBody')}</p>
			</Card>
		</div>
	</section>

	<section aria-labelledby="showcase-overlays">
		<h2 id="showcase-overlays">{t('ui.overlays')}</h2>
		<div class="button-group">
			<Button onclick={() => (dialogOpen = true)}>{t('ui.openDialog')}</Button>
			<Button variant="secondary" onclick={() => (sheetOpen = true)}>{t('ui.openSheet')}</Button>
			<Button variant="secondary" onclick={() => (disabledDialogOpen = true)}>
				{t('ui.openDialog')} · {t('ui.disabled')}
			</Button>
			<Button variant="secondary" onclick={() => (disabledSheetOpen = true)}>
				{t('ui.openSheet')} · {t('ui.disabled')}
			</Button>
		</div>
	</section>

	<section aria-labelledby="showcase-toasts">
		<h2 id="showcase-toasts">{t('ui.toasts')}</h2>
		<div class="button-group">
			<Button onclick={() => toast.success(t('ui.successMessage'))}>{t('ui.successToast')}</Button>
			<Button variant="danger" onclick={() => toast.error(t('ui.errorMessage'))}
				>{t('ui.errorToast')}</Button
			>
			<Button variant="secondary" onclick={() => toast.info(t('ui.infoMessage'))}
				>{t('ui.infoToast')}</Button
			>
		</div>
	</section>

	<section aria-labelledby="showcase-accordion">
		<h2 id="showcase-accordion">{t('ui.accordionTitle')}</h2>
		<Accordion title={t('ui.accordionOne')}><p>{t('ui.accordionAnswer')}</p></Accordion>
		<Accordion title={t('ui.accordionTwo')} open><p>{t('ui.accordionTwoAnswer')}</p></Accordion>
		<Accordion title={t('ui.disabled')} disabled><p>{t('ui.accordionAnswer')}</p></Accordion>
	</section>

	<section aria-labelledby="showcase-list">
		<h2 id="showcase-list">{t('ui.list')}</h2>
		<div class="stack">
			<ListEditor
				label={t('ui.listLabel')}
				bind:items={projects}
				onAdd={() => ({ name: t('ui.itemExample', { number: projects.length + 1 }) })}
			>
				{#snippet item(project, index)}
					<Input label={t('ui.itemLabel', { number: index + 1 })} bind:value={project.name} />
				{/snippet}
			</ListEditor>
			<ListEditor
				label={t('ui.emptyListLabel')}
				bind:items={emptyProjects}
				onAdd={() => ({ name: t('ui.itemExample', { number: emptyProjects.length + 1 }) })}
			>
				{#snippet item(project, index)}
					<Input label={t('ui.itemLabel', { number: index + 1 })} bind:value={project.name} />
				{/snippet}
			</ListEditor>
			<ListEditor
				label={t('ui.disabled')}
				items={[{ name: t('ui.itemExample', { number: 1 }) }]}
				onAdd={() => ({ name: '' })}
				disabled
			>
				{#snippet item(project, index)}
					<Input label={t('ui.itemLabel', { number: index + 1 })} value={project.name} disabled />
				{/snippet}
			</ListEditor>
		</div>
	</section>

	<section aria-labelledby="showcase-month">
		<h2 id="showcase-month">{t('ui.monthPicker')}</h2>
		<div class="grid">
			<div class="stack">
				<MonthPicker
					label={t('ui.dateLabel')}
					bind:value={endDate}
					bind:current={untilPresent}
					allowCurrent
				/>
				<p>{t('ui.selectedDate', { value: endDate ?? t('ui.noDate') })}</p>
			</div>
			<MonthPicker label={t('ui.dateLabel')} error={t('ui.required')} required />
			<MonthPicker label={t('ui.disabled')} value="2024-07" allowCurrent current disabled />
		</div>
	</section>

	<section aria-labelledby="showcase-language">
		<h2 id="showcase-language">{t('ui.language')}</h2>
		<div class="button-group">
			<LanguageSwitcher />
			<LanguageSwitcher disabled />
		</div>
	</section>
</main>

<Dialog bind:open={dialogOpen} title={t('ui.modalTitle')} description={t('ui.modalBody')}>
	<Input label={t('ui.nameLabel')} />
	{#snippet footer()}
		<Button variant="secondary" onclick={() => (dialogOpen = false)}>{t('common.cancel')}</Button>
		<Button onclick={() => (dialogOpen = false)}>{t('common.confirm')}</Button>
	{/snippet}
</Dialog>

<BottomSheet bind:open={sheetOpen} title={t('ui.sheetTitle')} description={t('ui.sheetBody')}>
	<p>{t('ui.cardBody')}</p>
	{#snippet footer()}
		<Button onclick={() => (sheetOpen = false)}>{t('common.close')}</Button>
	{/snippet}
</BottomSheet>

<Dialog
	bind:open={disabledDialogOpen}
	title={t('ui.disabled')}
	description={t('ui.modalBody')}
	disabled
>
	<Input label={t('ui.nameLabel')} disabled />
	{#snippet footer()}<Button disabled>{t('common.confirm')}</Button>{/snippet}
</Dialog>

<BottomSheet
	bind:open={disabledSheetOpen}
	title={t('ui.disabled')}
	description={t('ui.sheetBody')}
	disabled
>
	<Input label={t('ui.nameLabel')} disabled />
	{#snippet footer()}<Button disabled>{t('common.confirm')}</Button>{/snippet}
</BottomSheet>

<style>
	.showcase {
		width: min(100% - 32px, 1120px);
		margin: 0 auto;
		padding: 48px 0 80px;
	}
	.intro {
		margin-bottom: 40px;
	}
	h1 {
		margin: 0 0 16px;
		font-size: 2.25rem;
		font-weight: 800;
		line-height: 1.25;
	}
	h2 {
		margin: 0 0 24px;
		font-size: 1.5rem;
		font-weight: 700;
	}
	h3 {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 700;
	}
	p {
		margin: 0;
		color: var(--color-text-muted);
		line-height: 1.7;
	}
	main > section {
		min-width: 0;
		margin-top: 40px;
		padding-top: 32px;
		border-top: 1px solid var(--color-border);
	}
	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 24px;
		align-items: start;
	}
	.stack {
		display: grid;
		gap: 20px;
		min-width: 0;
	}
	.button-group {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 12px;
		margin-bottom: 16px;
	}
	@media (min-width: 768px) {
		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
