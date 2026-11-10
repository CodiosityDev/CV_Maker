<script module lang="ts">
	let shownThisPage = false;
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { i18n, t } from '#lib/i18n/index.svelte.ts';

	type Stats = typeof import('#lib/core/stats/index.ts');
	let slot = $state<HTMLDivElement>();
	let count = $state<number>();
	let online = $state<number>();
	let displayed = $state(0);
	let unavailable = $state(false);
	let format = $state.raw<Stats['formatVisitors']>();
	const finalNumber = $derived(count !== undefined && format ? format(count, i18n.locale) : '');
	const displayedNumber = $derived(format ? format(displayed, i18n.locale) : '');
	const onlineNumber = $derived(online !== undefined && format ? format(online, i18n.locale) : '');
	const label = $derived(
		[
			online !== undefined ? t('landing.onlineCount', { count: onlineNumber }) : '',
			t(count === 1 ? 'landing.visitorCount' : 'landing.visitorsCount', { count: finalNumber })
		]
			.filter(Boolean)
			.join(', ')
	);

	onMount(() => {
		let current = true;
		let visible = false;
		let started = false;
		let frame: number | undefined;
		let observer: IntersectionObserver | undefined;
		let stopOnline: (() => void) | undefined;
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
				stopOnline = stats.watchOnline((value) => {
					if (current) online = value;
				});
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
			stopOnline?.();
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
				{#if online !== undefined}
					<span class="stat online" aria-hidden="true" data-testid="online-count">
						<span class="dot"></span>
						<strong>{onlineNumber}</strong>
						<span>{t('landing.online')}</span>
					</span>
					<span class="separator" aria-hidden="true"></span>
				{/if}
				<span class="stat visitor-value" aria-hidden="true">
					<strong style:width="{Math.max(1, finalNumber.length)}ch">{displayedNumber}</strong>
					<span>{t(count === 1 ? 'landing.visitor' : 'landing.visitors')}</span>
				</span>
			</p>
		{/if}
	</div>
{/if}

<style>
	/* Reserved height = the pill's height: the landing never moves when the numbers arrive. */
	.visitor-slot {
		min-height: 40px;
		margin-top: 16px;
		color: var(--color-text-muted);
		font-size: 14px;
		line-height: 24px;
	}
	p {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 12px;
		min-height: 40px;
		margin: 0;
		padding: 7px 14px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-pill);
		background: var(--color-surface);
	}
	.stat {
		display: inline-flex;
		align-items: baseline;
		gap: 6px;
	}
	.separator {
		width: 1px;
		height: 16px;
		background: var(--color-border);
	}
	.dot {
		position: relative;
		align-self: center;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-live);
	}
	/* A calm "live" pulse: a ring that fades out; off with reduced motion (app.css). */
	.dot::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: var(--color-live);
		animation: live 2.4s ease-out infinite;
	}
	@keyframes live {
		from {
			opacity: 0.5;
			transform: scale(1);
		}
		to {
			opacity: 0;
			transform: scale(2.6);
		}
	}
	strong {
		flex-shrink: 0;
		color: var(--color-text);
		font-weight: 650;
		font-variant-numeric: tabular-nums;
		/* The reserved width (for the count-up) sits before the number, not before the label. */
		text-align: end;
	}
</style>
