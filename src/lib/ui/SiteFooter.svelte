<script lang="ts">
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/index.svelte.ts';
</script>

<footer>
	<div class="site-container footer-inner">
		<p class="attribution">
			{t('footer.madeBy')}
			<a href="https://codiosity.com" target="_blank" rel="noopener noreferrer"
				>{t('nav.codiosity')}<span aria-hidden="true">↗</span><span class="sr-only">
					{t('a11y.opensNewTab')}</span
				></a
			>
		</p>
		<nav aria-label={t('footer.links')}>
			<a href={resolve('/(site)/privasi')}>{t('nav.privacy')}</a>
			<a href={resolve('/(site)/tentang')}>{t('nav.about')}</a>
			<a href={resolve('/(site)/faq')}>{t('nav.faq')}</a>
			<a href="https://github.com/CodiosityDev/CV_Maker" target="_blank" rel="noopener noreferrer"
				>{t('footer.github')}<span aria-hidden="true">↗</span><span class="sr-only">
					{t('a11y.opensNewTab')}</span
				></a
			>
		</nav>
	</div>
</footer>

<style>
	footer {
		border-top: 1px solid var(--color-border);
		background: var(--color-cream-50);
	}
	.footer-inner {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding-block: 1.5rem;
	}
	.attribution {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0 0.375rem;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
	a {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		min-width: 44px;
		min-height: 44px;
		color: var(--color-brand-ink);
		font-size: 0.875rem;
		font-weight: 600;
		text-decoration: none;
		transition: color var(--motion-duration) ease-out;
	}
	a:hover {
		color: var(--color-text);
		text-decoration: underline;
	}
	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1.5rem;
	}
	@media (min-width: 768px) {
		.footer-inner {
			flex-direction: row;
			flex-wrap: wrap;
			justify-content: space-between;
			align-items: center;
		}
	}
</style>
