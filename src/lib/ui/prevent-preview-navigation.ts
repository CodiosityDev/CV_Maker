/** Keep template links inside an application preview from opening another page or tab. */
export function preventPreviewNavigation(node: HTMLElement) {
	const preventLink = (event: MouseEvent) => {
		if (event.target instanceof Element && event.target.closest('a[href]')) event.preventDefault();
	};
	node.addEventListener('click', preventLink);
	node.addEventListener('auxclick', preventLink);
	return {
		destroy() {
			node.removeEventListener('click', preventLink);
			node.removeEventListener('auxclick', preventLink);
		}
	};
}
