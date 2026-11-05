<script lang="ts">
	import SiteHeader from '#lib/ui/SiteHeader.svelte';
	import SiteFooter from '#lib/ui/SiteFooter.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<SiteHeader />
{@render children()}
<SiteFooter />
