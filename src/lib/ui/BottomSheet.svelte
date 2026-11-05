<script lang="ts">
	import type { Snippet } from 'svelte';
	import Dialog from './Dialog.svelte';

	interface Props {
		open?: boolean;
		title?: string;
		description?: string;
		children?: Snippet;
		footer?: Snippet;
		disabled?: boolean;
		class?: string;
	}

	let {
		open = $bindable(false),
		title,
		description,
		children,
		footer,
		disabled = false,
		class: className = ''
	}: Props = $props();
</script>

<Dialog
	bind:open
	{title}
	{description}
	{children}
	{footer}
	{disabled}
	class={className}
	presentation="sheet"
	closeOnBackdrop
/>
