// Banner ad for CV Maker pages (loaded in an iframe: https://iklan.codiosity.com/banner.html?lang=id).
// Google Ad Manager display unit from config.js (bannerUnitPath). Non-personalised by default.
// Tells the parent page { type: 'cvmaker-banner', filled, height } so it can open or keep the frame closed.
(function () {
	'use strict';
	var config = window.CVMAKER_AD || {};
	var parentOrigin = config.apiOrigin || 'https://cvmaker.codiosity.com';
	var lang = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'id';
	var label = document.getElementById('label');
	var told = false;

	function tell(filled, height) {
		if (told) return;
		told = true;
		if (window.parent === window) return;
		window.parent.postMessage(
			{ type: 'cvmaker-banner', filled: filled, height: height || 0 },
			parentOrigin
		);
	}

	document.documentElement.lang = lang;
	label.textContent = lang === 'en' ? 'Advertisement' : 'Iklan';

	// Not configured yet, or opened on its own: show nothing.
	if (!config.bannerUnitPath || window.parent === window) {
		tell(false);
		return;
	}

	// The frame is as wide as the space the parent gives it.
	var wide = window.innerWidth >= 728;
	var sizes = wide
		? [
				[728, 90],
				[468, 60]
			]
		: [
				[320, 100],
				[320, 50],
				[300, 50]
			];

	// No ad within 15 s (no fill, ad blocker, slow network): stay closed.
	var timer = setTimeout(function () {
		tell(false);
	}, 15000);

	window.googletag = window.googletag || { cmd: [] };
	var gpt = document.createElement('script');
	gpt.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';
	gpt.async = true;
	gpt.crossOrigin = 'anonymous';
	gpt.onerror = function () {
		clearTimeout(timer);
		tell(false);
	};
	document.head.appendChild(gpt);

	window.googletag.cmd.push(function () {
		var googletag = window.googletag;
		var slot = googletag.defineSlot(config.bannerUnitPath, sizes, 'banner-slot');
		if (!slot) {
			clearTimeout(timer);
			tell(false);
			return;
		}
		var pubads = googletag.pubads();
		slot.addService(pubads);
		if (config.nonPersonalizedAds) pubads.setPrivacySettings({ nonPersonalizedAds: true });
		pubads.collapseEmptyDivs(true);
		pubads.addEventListener('slotRenderEnded', function (event) {
			if (event.slot !== slot) return;
			clearTimeout(timer);
			if (event.isEmpty || !event.size) {
				tell(false);
				return;
			}
			label.hidden = false;
			// Label line (~16 px) + the ad's own height.
			tell(true, Number(event.size[1]) + 18);
		});
		googletag.enableServices();
		googletag.display('banner-slot');
	});
})();
