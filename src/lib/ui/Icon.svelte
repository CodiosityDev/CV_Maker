<script lang="ts">
	let {
		name = 'arrow',
		size = 20,
		class: className = ''
	}: {
		name?: 'arrow' | 'check' | 'shield' | 'file' | 'book' | 'download' | 'spark' | 'github';
		size?: number;
		class?: string;
	} = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.7"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	class={className}
>
	{#if name === 'arrow'}<path d="M5 12h14m-6-6 6 6-6 6" />
	{:else if name === 'check'}<path d="m5 12 4 4L19 6" />
	{:else if name === 'shield'}<path
			d="M12 3 4.5 6v5.5c0 4.5 3 7.5 7.5 9.5 4.5-2 7.5-5 7.5-9.5V6L12 3Z"
		/><path d="m8.5 12 2.3 2.3 4.7-4.8" />
	{:else if name === 'file'}<path
			d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Z"
		/><path d="M14 3v5h5M9 12h6m-6 4h4" />
	{:else if name === 'book'}<path
			d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15"
		/>
	{:else if name === 'download'}<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4" />
	{:else if name === 'spark'}<path
			d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"
		/>
	{:else}<path
			d="M9 19c-4 1-4-2-5-2m10 4v-3.4c0-1 .1-1.6-.5-2.1 3-.3 6-1.5 6-6A4.7 4.7 0 0 0 18 6c.2-1 .1-2-.3-3-1.5 0-2.8.7-3.7 1.4a13 13 0 0 0-6 0C7.1 3.7 5.8 3 4.3 3 3.9 4 3.8 5 4 6a4.7 4.7 0 0 0-1.5 3.5c0 4.5 3 5.7 6 6-.6.5-.5 1.1-.5 2.1V21"
		/>{/if}
</svg>
