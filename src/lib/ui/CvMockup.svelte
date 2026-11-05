<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import Icon from '#lib/ui/Icon.svelte';
</script>

<div class="mockup-stage" aria-hidden="true">
	<div class="stage-dot dot-one"></div>
	<div class="stage-dot dot-two"></div>
	<div class="paper-shadow"></div>
	<div class="cv-paper">
		<div class="paper-top">
			<span class="paper-label">{t('landing.mockupLabel')}</span><span class="paper-tabs"
				><i></i><i></i><i></i></span
			>
		</div>
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
				<div class="placeholder-line long"></div>
				<div class="placeholder-line"></div>
			</div>
			<div class="cv-section">
				<div class="cv-heading">{t('landing.mockupSkills')}</div>
				<p>{t('landing.mockupSkillText')}</p>
			</div>
		</div>
	</div>
	<div class="mockup-note">
		<span class="note-icon"><Icon name="check" size={19} /></span>
		<div><strong>{t('landing.mockupTag')}</strong><span>{t('landing.mockupNote')}</span></div>
	</div>
</div>

<style>
	.mockup-stage {
		position: relative;
		isolation: isolate;
		display: grid;
		place-items: center;
		min-height: 470px;
		width: 100%;
		padding: 32px 24px 60px;
		background: #eaf5f0;
		border-radius: 48% 48% 20px 20px;
	}
	.cv-paper {
		z-index: 1;
		width: 100%;
		max-width: 330px;
		background: white;
		border: 1px solid #dce8e1;
		border-radius: 6px;
		box-shadow: var(--shadow-lg);
		transform: rotate(-4deg);
	}
	.paper-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 18px;
		border-bottom: 1px solid var(--color-neutral-100);
	}
	.paper-label {
		font-size: 9px;
		color: var(--color-text-muted);
		font-weight: 600;
	}
	.paper-tabs {
		display: flex;
		gap: 4px;
	}
	.paper-tabs i {
		display: block;
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: var(--color-neutral-300);
	}
	.cv-body {
		padding: 24px 26px 28px;
		font-size: 9px;
		color: var(--color-neutral-600);
		line-height: 1.65;
	}
	.cv-name {
		font-size: 23px;
		font-weight: 800;
		letter-spacing: -0.04em;
		color: var(--color-primary-800);
	}
	.cv-role {
		font-size: 10px;
		margin-top: 4px;
		font-weight: 600;
	}
	.cv-contact {
		font-size: 8px;
		margin-top: 8px;
	}
	.cv-section {
		margin-top: 16px;
	}
	.cv-heading {
		border-bottom: 1px solid var(--color-neutral-200);
		padding-bottom: 4px;
		margin-bottom: 7px;
		font-size: 10px;
		font-weight: 750;
		color: var(--color-primary-800);
	}
	strong {
		color: var(--color-neutral-800);
		font-weight: 650;
	}
	.cv-bullet {
		padding-left: 10px;
		border-left: 2px solid var(--color-primary-200);
		margin-top: 4px;
	}
	.placeholder-line {
		height: 3px;
		width: 64%;
		background: var(--color-neutral-100);
		margin-top: 7px;
		border-radius: 2px;
	}
	.placeholder-line.long {
		width: 88%;
	}
	.paper-shadow {
		position: absolute;
		width: 75%;
		max-width: 330px;
		height: 370px;
		background: #d4e9df;
		transform: rotate(7deg);
		border-radius: 6px;
	}
	.mockup-note {
		position: absolute;
		z-index: 2;
		bottom: 22px;
		right: 0;
		left: 16px;
		width: fit-content;
		max-width: calc(100% - 24px);
		padding: 14px 18px;
		display: flex;
		align-items: center;
		gap: 12px;
		background: white;
		border-radius: 12px;
		box-shadow: var(--shadow-md);
		transform: rotate(2deg);
	}
	.note-icon {
		color: var(--color-primary-700);
		width: 36px;
		height: 36px;
		background: var(--color-primary-50);
		display: grid;
		place-items: center;
		border-radius: 50%;
	}
	.mockup-note strong {
		display: block;
		font-size: 12px;
	}
	.mockup-note span:not(.note-icon) {
		display: block;
		font-size: 10px;
		color: var(--color-text-muted);
		margin-top: 2px;
	}
	.stage-dot {
		position: absolute;
		border-radius: 50%;
	}
	.dot-one {
		background: #f5d482;
		width: 16px;
		height: 16px;
		right: 15px;
		top: 36px;
	}
	.dot-two {
		border: 2px solid #9dc7b4;
		width: 12px;
		height: 12px;
		left: 16px;
		bottom: 104px;
	}
	@media (min-width: 768px) {
		.mockup-stage {
			min-height: 520px;
		}
		.mockup-note {
			left: -12px;
			bottom: 30px;
		}
	}
</style>
