<script lang="ts">
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/index.svelte.ts';
	const links = [
		{ href: resolve('/(site)/privasi'), key: 'nav.privacy' },
		{ href: resolve('/(site)/tentang'), key: 'nav.about' },
		{ href: resolve('/(site)/faq'), key: 'nav.faq' }
	] as const;
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
		<nav aria-label={t('footer.links')} data-sveltekit-preload-code="viewport">
			{#each links as link (link.key)}<a href={link.href}>{t(link.key)}</a>{/each}
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
