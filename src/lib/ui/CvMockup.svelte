<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
</script>

<div class="mockup-stage" aria-hidden="true">
	<div class="cv-paper">
		<p class="paper-label">{t('landing.mockupLabel')}</p>
		<div class="cv-body">
			<div class="cv-name">{t('landing.mockupName')}</div>
			<div class="cv-role">{t('landing.mockupRole')}</div>
			<div class="cv-contact">{t('landing.mockupContact')}</div>
			<div class="cv-section">
				<div class="cv-heading">{t('landing.mockupSummary')}</div>
				<p>{t('landing.mockupSummaryText')}</p>
			</div>
			<div class="cv-section">
				<div class="cv-heading">{t('landing.mockupEducation')}</div>
				<strong>{t('landing.mockupUniversity')}</strong>
				<p>{t('landing.mockupDegree')}</p>
			</div>
			<div class="cv-section">
				<div class="cv-heading">{t('landing.mockupExperience')}</div>
				<strong>{t('landing.mockupProject')}</strong>
				<p class="cv-bullet">{t('landing.mockupBullet')}</p>
			</div>
			<div class="cv-section">
				<div class="cv-heading">{t('landing.mockupSkills')}</div>
				<p>{t('landing.mockupSkillText')}</p>
			</div>
		</div>
	</div>
</div>

<style>
	.mockup-stage {
		width: 100%;
		max-width: 360px;
		margin-inline: auto;
	}
	.cv-paper {
		border: 1px solid var(--color-paper-border);
		border-radius: var(--radius-lg);
		background: var(--color-paper);
		box-shadow: var(--shadow-paper);
		filter: var(--paper-dim, none);
	}
	.paper-label {
		padding: 12px 22px;
		border-bottom: 1px solid var(--color-paper-border);
		border-radius: var(--radius-lg) var(--radius-lg) 0 0;
		background: var(--color-paper-label);
		color: var(--color-paper-muted);
		font-size: 0.75rem;
	}
	.cv-body {
		padding: 24px 22px 28px;
		color: var(--color-paper-ink);
		font-size: 0.6875rem;
		line-height: 1.6;
	}
	.cv-name {
		font-size: 1.375rem;
		font-weight: 750;
		line-height: 1.3;
	}
	.cv-role {
		margin-top: 4px;
		font-size: 0.75rem;
		font-weight: 600;
	}
	.cv-contact {
		margin-top: 8px;
	}
	.cv-section {
		margin-top: 18px;
	}
	.cv-heading {
		margin-bottom: 7px;
		padding-bottom: 4px;
		border-bottom: 1px solid var(--color-paper-border);
		font-size: 0.75rem;
		font-weight: 700;
	}
	strong {
		font-weight: 650;
	}
	.cv-bullet {
		margin-top: 4px;
	}
</style>
