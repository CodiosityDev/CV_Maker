<script module lang="ts">
	let shownThisPage = false;
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { i18n, t } from '#lib/i18n/index.svelte.ts';

	type Stats = typeof import('#lib/core/stats/index.ts');
	let slot = $state<HTMLDivElement>();
	let count = $state<number>();
	let displayed = $state(0);
	let unavailable = $state(false);
	let format = $state.raw<Stats['formatVisitors']>();
	const finalNumber = $derived(count !== undefined && format ? format(count, i18n.locale) : '');
	const displayedNumber = $derived(format ? format(displayed, i18n.locale) : '');
	const label = $derived(
		t(count === 1 ? 'landing.visitorCount' : 'landing.visitorsCount', { count: finalNumber })
	);

	onMount(() => {
		let current = true;
		let visible = false;
		let started = false;
		let frame: number | undefined;
		let observer: IntersectionObserver | undefined;
		const motion = matchMedia('(prefers-reduced-motion: reduce)');

		function finish() {
			if (frame !== undefined) cancelAnimationFrame(frame);
			frame = undefined;
			if (count !== undefined) displayed = count;
		}
		function reveal() {
			if (!current || !visible || started || count === undefined) return;
			started = true;
			observer?.disconnect();
			const target = count;
			if (motion.matches || shownThisPage || target === 0) finish();
			else {
				const began = performance.now();
				function animate(now: number) {
					if (!current) return;
					const progress = Math.min(1, (now - began) / 1_000);
					displayed = Math.round(target * (1 - (1 - progress) ** 3));
					if (progress < 1) frame = requestAnimationFrame(animate);
					else frame = undefined;
				}
				frame = requestAnimationFrame(animate);
			}
			shownThisPage = true;
		}
		function motionChanged() {
			if (motion.matches) finish();
		}
		motion.addEventListener('change', motionChanged);
		if (typeof IntersectionObserver !== 'undefined' && slot) {
			observer = new IntersectionObserver((entries) => {
				visible = entries.some((entry) => entry.isIntersecting);
				reveal();
			});
			observer.observe(slot);
		} else visible = true;

		void import('#lib/core/stats/index.ts')
			.then(async (stats) => {
				const total = await stats.visitorCount();
				if (!current) return;
				if (total === undefined) {
					unavailable = true;
					observer?.disconnect();
					return;
				}
				format = stats.formatVisitors;
				count = total;
				if (motion.matches || shownThisPage) displayed = total;
				reveal();
			})
			.catch(() => {
				if (current) unavailable = true;
				observer?.disconnect();
			});

		return () => {
			current = false;
			if (frame !== undefined) cancelAnimationFrame(frame);
			observer?.disconnect();
			motion.removeEventListener('change', motionChanged);
		};
	});
</script>

{#if !unavailable}
	<div
		class="visitor-slot"
		bind:this={slot}
		data-testid="visitor-count-slot"
		aria-hidden={count === undefined}
	>
		{#if count !== undefined}
			<p role="status" aria-live="off" aria-label={label} data-testid="visitor-count">
				<span class="visitor-value" aria-hidden="true">
					<strong style:width="{Math.max(1, finalNumber.length)}ch">{displayedNumber}</strong>
					<span>{t(count === 1 ? 'landing.visitor' : 'landing.visitors')}</span>
				</span>
			</p>
		{/if}
	</div>
{/if}

<style>
	.visitor-slot {
		min-height: 24px;
		margin-top: 16px;
		color: var(--color-text-muted);
		font-size: 14px;
		line-height: 24px;
	}
	p {
		margin: 0;
	}
	.visitor-value {
		display: inline-flex;
		align-items: baseline;
		gap: 8px;
	}
	strong {
		flex-shrink: 0;
		color: var(--color-text);
		font-weight: 650;
		font-variant-numeric: tabular-nums;
	}
</style>
