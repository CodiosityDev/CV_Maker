<script lang="ts">
	type Props = { size?: number; variant?: 'color' | 'mono' | 'inverse' };
	let { size = 32, variant = 'color' }: Props = $props();
	const primary = $derived(
		variant === 'inverse'
			? '#FFF1E1'
			: variant === 'mono'
				? '#1F1D3D'
				: 'var(--color-logo-ink, #1F1D3D)'
	);
	const accent = $derived(variant === 'color' ? '#9C9AFF' : primary);
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 48 48"
	fill="none"
	aria-hidden="true"
	focusable="false"
	data-logo="cv-maker"
	data-variant={variant}
>
	<path
		fill={primary}
		d="M27 7H20C10 7 3 14 3 24S10 41 20 41H27L43 7H33L22 32H20C15 32 12 29 12 24S15 16 20 16H23Z"
	/>
	<path fill={accent} d="M33 7H43L27 41H17L22 32Z" />
</svg>

<style>
	svg {
		display: block;
		flex-shrink: 0;
	}
</style>
