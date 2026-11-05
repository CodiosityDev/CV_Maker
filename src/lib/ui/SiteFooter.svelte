<script lang="ts">
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Icon from '#lib/ui/Icon.svelte';
</script>

<footer>
	<div class="site-container footer-inner">
		<div>
			<a class="brand" href={resolve('/')}
				>{t('app.name')}<span class="brand-dot" aria-hidden="true"></span></a
			>
			<p>{t('footer.description')}</p>
		</div>
		<nav aria-label={t('footer.links')}>
			<a href={resolve('/privasi')}>{t('nav.privacy')}</a>
			<a href={resolve('/tentang')}>{t('nav.about')}</a>
			<a href="https://github.com/CodiosityDev/CV_Maker" target="_blank" rel="noopener noreferrer"
				><Icon name="github" size={18} />{t('footer.github')}</a
			>
		</nav>
	</div>
	<div class="site-container footer-bottom">
		<span>{t('footer.local')}</span><span>{t('footer.openSource')}</span>
	</div>
</footer>

<style>
	footer {
		border-top: 1px solid var(--color-neutral-200);
		background: var(--color-surface);
		padding-top: 40px;
	}
	.footer-inner {
		display: flex;
		flex-direction: column;
		gap: 24px;
		padding-bottom: 32px;
	}
	.brand {
		display: inline-flex;
		gap: 4px;
		align-items: center;
		min-height: 44px;
		color: var(--color-text);
		font-size: 20px;
		font-weight: 800;
		letter-spacing: -0.06em;
		text-decoration: none;
	}
	.brand-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--color-primary-600);
		align-self: center;
		margin-top: 12px;
	}
	p {
		color: var(--color-text-muted);
		font-size: 14px;
	}
	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 24px;
	}
	nav a {
		display: inline-flex;
		min-width: 44px;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		color: var(--color-text-muted);
		font-size: 14px;
		font-weight: 600;
		text-decoration: none;
	}
	nav a:hover {
		text-decoration: underline;
	}
	.footer-bottom {
		border-top: 1px solid var(--color-neutral-200);
		padding-block: 20px;
		display: flex;
		flex-wrap: wrap;
		gap: 8px 24px;
		justify-content: space-between;
		color: var(--color-text-muted);
		font-size: 12px;
	}
	@media (min-width: 768px) {
		.footer-inner {
			flex-direction: row;
			justify-content: space-between;
			align-items: center;
		}
	}
</style>
