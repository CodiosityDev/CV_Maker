// Apply the visitor's choice before styles and page content can paint.
(() => {
	try {
		let theme = 'dark';
		let privateMode = false;
		try {
			privateMode = sessionStorage.getItem('cvmaker:incognito') === '1';
		} catch {
			// A blocked preference store keeps the default theme usable.
		}
		if (!privateMode) {
			try {
				if (localStorage.getItem('cvmaker.theme') === 'light') theme = 'light';
			} catch {
				// No preference is required to open the app.
			}
		}
		document.documentElement.dataset.theme = theme;
		document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme);
		document
			.querySelector('meta[name="theme-color"]')
			?.setAttribute('content', theme === 'dark' ? '#1c1b22' : '#f3f2ff');
	} catch {
		// The HTML and CSS also default to dark if initialization cannot run.
	}
})();
