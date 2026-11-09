// Settings of the rewarded-ad page (https://iklan.codiosity.com). Nothing here is secret.
// adUnitPath comes from Google Ad Manager → Inventory → Ad units (format "Rewarded"):
//   '/<network code>/<ad unit code>', e.g. '/21234567890/cvmaker_rewarded'.
// Empty → the page says "no ad available right now" (safe default until Ad Manager is ready).
window.CVMAKER_AD = {
	adUnitPath: '',
	apiOrigin: 'https://cvmaker.codiosity.com',
	appUrl: 'https://cvmaker.codiosity.com/cv',
	// Must match AI_REWARD_MIN_SECONDS on the server.
	minSeconds: 15,
	// true = no personalised ads (no ad profile built from the visitor). Safer for privacy (UU PDP).
	nonPersonalizedAds: true
};
