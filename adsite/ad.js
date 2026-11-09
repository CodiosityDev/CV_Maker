/**
 * Rewarded-ad page for CV Maker (https://iklan.codiosity.com). Runs on its OWN origin so ad scripts
 * can never read the CV data stored by cvmaker.codiosity.com.
 *
 * Flow: CV Maker opens this page with a signed single-use ticket in the URL fragment → the user
 * presses "Start" → Google Ad Manager shows a rewarded ad → on `rewardedSlotGranted` this page
 * sends the ticket to the CV Maker API, which adds one AI use to that device.
 */
(function () {
	'use strict';

	var config = window.CVMAKER_AD || {};
	var ticket = location.hash.slice(1);
	// Remove the ticket from the address bar BEFORE any ad script loads.
	history.replaceState(null, '', location.pathname + location.search);

	var lang = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'id';
	var TEXT = {
		id: {
			loading: ['Menyiapkan iklan…', 'Tunggu sebentar.'],
			ready: ['Iklan siap', 'Tonton iklan sampai selesai untuk mendapat +1 bantuan AI.'],
			start: 'Mulai iklan',
			watching: ['Iklan sedang diputar', 'Jangan tutup halaman ini sampai iklan selesai.'],
			claiming: ['Menambahkan jatah…', 'Sebentar lagi selesai.'],
			done: ['Berhasil, +1 bantuan AI', 'Kembali ke tab CV Maker. Jatahmu sudah bertambah.'],
			early: [
				'Iklan ditutup sebelum selesai',
				'Jatah hanya bertambah jika iklan ditonton sampai selesai.'
			],
			unavailable: [
				'Belum ada iklan',
				'Saat ini belum ada iklan yang bisa ditampilkan. Coba lagi nanti.'
			],
			limit: [
				'Batas hari ini tercapai',
				'Kamu sudah menonton iklan sebanyak batas hari ini. Coba lagi besok.'
			],
			invalid: [
				'Buka dari CV Maker',
				'Halaman ini hanya bisa dipakai lewat tombol "Tonton iklan" di CV Maker.'
			],
			failed: ['Jatah belum bertambah', 'Koneksi bermasalah. Tekan "Coba lagi".'],
			retry: 'Coba lagi',
			back: 'Kembali ke CV Maker',
			note: 'Halaman iklan ini terpisah dari CV Maker dan tidak bisa melihat isi CV-mu.'
		},
		en: {
			loading: ['Preparing the ad…', 'One moment.'],
			ready: ['Ad ready', 'Watch the ad to the end to get +1 AI help.'],
			start: 'Start ad',
			watching: ['Ad playing', 'Keep this page open until the ad ends.'],
			claiming: ['Adding your use…', 'Almost done.'],
			done: ['Done: +1 AI help', 'Go back to the CV Maker tab. Your quota has been increased.'],
			early: [
				'The ad was closed early',
				'Your quota only grows when the ad is watched to the end.'
			],
			unavailable: ['No ad yet', 'There is no ad to show right now. Try again later.'],
			limit: [
				"Today's limit reached",
				"You have watched today's maximum number of ads. Try again tomorrow."
			],
			invalid: [
				'Open from CV Maker',
				'This page only works from the "Watch an ad" button in CV Maker.'
			],
			failed: ['Quota not added yet', 'Connection problem. Press "Try again".'],
			retry: 'Try again',
			back: 'Back to CV Maker',
			note: 'This ad page is separate from CV Maker and cannot see your CV.'
		}
	}[lang];

	var $ = function (id) {
		return document.getElementById(id);
	};
	var startButton = $('start');
	var retryButton = $('retry');
	var backLink = $('back');

	document.documentElement.lang = lang;
	startButton.textContent = TEXT.start;
	retryButton.textContent = TEXT.retry;
	backLink.textContent = TEXT.back;
	backLink.href = config.appUrl || 'https://cvmaker.codiosity.com/cv';
	$('note').textContent = TEXT.note;

	var finished = false;
	function show(state) {
		$('title').textContent = TEXT[state][0];
		$('message').textContent = TEXT[state][1];
		startButton.hidden = state !== 'ready';
		retryButton.hidden = state !== 'failed';
		backLink.hidden = ['done', 'early', 'unavailable', 'limit', 'invalid'].indexOf(state) < 0;
		if (state !== 'loading' && state !== 'ready' && state !== 'watching' && state !== 'claiming') {
			finished = true;
		}
	}

	// Ticket: "r1.<device>.<issued base36>.<nonce>.<signature>" (checked again by the server).
	var parts = ticket.split('.');
	var issuedAt = parts.length === 5 ? parseInt(parts[2], 36) : NaN;
	if (parts[0] !== 'r1' || !isFinite(issuedAt)) {
		show('invalid');
		return;
	}
	if (!config.adUnitPath) {
		show('unavailable');
		return;
	}
	show('loading');

	function claim() {
		show('claiming');
		// The server refuses claims faster than an ad can be watched: wait for that moment.
		var wait = Math.max(0, issuedAt + ((config.minSeconds || 15) + 1) * 1000 - Date.now());
		setTimeout(function () {
			fetch(config.apiOrigin + '/api/ai/reward/claim', {
				method: 'POST',
				mode: 'cors',
				credentials: 'omit',
				headers: { 'Content-Type': 'text/plain' },
				body: JSON.stringify({ ticket: ticket })
			})
				.then(function (response) {
					if (response.ok) {
						show('done');
						setTimeout(function () {
							window.close();
						}, 2500);
					} else {
						show(response.status === 429 ? 'limit' : 'failed');
					}
				})
				.catch(function () {
					show('failed');
				});
		}, wait);
	}
	retryButton.addEventListener('click', claim);

	// No ad within 20 s (no fill, ad blocker, slow network): say so instead of spinning forever.
	var noAdTimer = setTimeout(function () {
		if (!finished && startButton.hidden) show('unavailable');
	}, 20000);

	window.googletag = window.googletag || { cmd: [] };
	var gpt = document.createElement('script');
	gpt.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';
	gpt.async = true;
	gpt.crossOrigin = 'anonymous';
	gpt.onerror = function () {
		clearTimeout(noAdTimer);
		show('unavailable');
	};
	document.head.appendChild(gpt);

	window.googletag.cmd.push(function () {
		var googletag = window.googletag;
		var slot = googletag.defineOutOfPageSlot(
			config.adUnitPath,
			googletag.enums.OutOfPageFormat.REWARDED
		);
		if (!slot) {
			// This browser/page cannot show rewarded ads.
			clearTimeout(noAdTimer);
			show('unavailable');
			return;
		}
		var granted = false;
		var pubads = googletag.pubads();
		slot.addService(pubads);
		if (config.nonPersonalizedAds) pubads.setPrivacySettings({ nonPersonalizedAds: true });

		pubads.addEventListener('rewardedSlotReady', function (event) {
			clearTimeout(noAdTimer);
			show('ready');
			startButton.onclick = function () {
				startButton.disabled = true;
				show('watching');
				event.makeRewardedVisible();
			};
		});
		pubads.addEventListener('rewardedSlotGranted', function () {
			granted = true;
			claim();
		});
		pubads.addEventListener('rewardedSlotClosed', function () {
			googletag.destroySlots([slot]);
			if (!granted) show('early');
		});
		pubads.addEventListener('slotRenderEnded', function (event) {
			if (event.slot === slot && event.isEmpty) {
				clearTimeout(noAdTimer);
				show('unavailable');
			}
		});
		googletag.enableServices();
		googletag.display(slot);
	});
})();
