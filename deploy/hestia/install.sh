#!/usr/bin/env bash
# Install the CV Maker nginx template into HestiaCP and apply it to the web domain (one-time, root).
# Deploys run from the private repo CodiosityDev/CV_Maker-deploy (VPS self-hosted runner).
#
# Usage (on the VPS, as root, from this folder):
#   bash install.sh <hestia-user> [domain]
#
# Works on both Hestia setups:
#   - nginx only (WEB_SYSTEM=nginx)            → web template   (nginx/php-fpm)
#   - nginx proxy + Apache (PROXY_SYSTEM=nginx) → proxy template (nginx), Apache is bypassed
# If `nginx -t` fails after switching, the previous template is restored.
set -euo pipefail

HESTIA_USER="${1:-el}"
DOMAIN="${2:-cvmaker.codiosity.com}"
NAME="cv-static"
HESTIA="${HESTIA:-/usr/local/hestia}"
BIN="$HESTIA/bin"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SNIPPET_DIR="/etc/nginx/snippets"
SNIPPET="$SNIPPET_DIR/cvmaker-security-headers.conf"

die() { echo "ERROR: $*" >&2; exit 1; }

[ -n "$HESTIA_USER" ] || die "usage: bash install.sh [hestia-user] [domain]"
[ "$(id -u)" -eq 0 ] || die "run as root (e.g. sudo bash install.sh $HESTIA_USER)"
[ -f "$HESTIA/conf/hestia.conf" ] || die "HestiaCP not found at $HESTIA"
for f in cv-static.tpl cv-static.stpl security-headers.conf; do
	[ -f "$HERE/$f" ] || die "missing $HERE/$f"
done

conf() { sed -n "s/^$1='\([^']*\)'.*/\1/p" "$HESTIA/conf/hestia.conf" | head -n1 || true; }
WEB_SYSTEM="$(conf WEB_SYSTEM)"
PROXY_SYSTEM="$(conf PROXY_SYSTEM)"

DOMAIN_JSON="$("$BIN/v-list-web-domain" "$HESTIA_USER" "$DOMAIN" json)" \
	|| die "web domain $DOMAIN not found for user $HESTIA_USER"
field() { printf '%s' "$DOMAIN_JSON" | sed -n "s/.*\"$1\": *\"\([^\"]*\)\".*/\1/p" | head -n1 || true; }
[ "$(field SSL)" = "yes" ] \
	|| die "SSL is not enabled on $DOMAIN. Enable SSL + Let's Encrypt in the panel first, then re-run."

if [ "$WEB_SYSTEM" = "nginx" ]; then
	MODE="web"
	TPL_DIR="$HESTIA/data/templates/web/nginx/php-fpm"
	PREVIOUS="$(field TPL)"
	PORT=web_port
	SSL_PORT=web_ssl_port
elif [ "$PROXY_SYSTEM" = "nginx" ]; then
	MODE="proxy"
	TPL_DIR="$HESTIA/data/templates/web/nginx"
	PREVIOUS="$(field PROXY)"
	PORT=proxy_port
	SSL_PORT=proxy_ssl_port
else
	die "unsupported setup: WEB_SYSTEM='$WEB_SYSTEM' PROXY_SYSTEM='$PROXY_SYSTEM' (nginx is required)"
fi
[ -d "$TPL_DIR" ] || die "template folder not found: $TPL_DIR"
PREVIOUS="${PREVIOUS:-default}"

# nginx >= 1.25.1 uses `http2 on;`; older versions need `listen ... ssl http2;`.
NGINX_VERSION="$(nginx -v 2>&1 | sed -n 's#.*nginx/\([0-9.]*\).*#\1#p' | head -n1 || true)"
NGINX_VERSION="${NGINX_VERSION:-0}"
if [ "$(printf '%s\n%s\n' 1.25.1 "$NGINX_VERSION" | sort -V | head -n1)" = "1.25.1" ]; then
	HTTP2_SED='s/^\t#__HTTP2__$/\thttp2 on;/'
else
	HTTP2_SED='/^\t#__HTTP2__$/d; s/^\(\tlisten .*\) ssl;$/\1 ssl http2;/'
fi

echo "Hestia mode : $MODE (WEB_SYSTEM=$WEB_SYSTEM, PROXY_SYSTEM=${PROXY_SYSTEM:-none})"
echo "nginx       : $NGINX_VERSION"
echo "Domain      : $DOMAIN (user $HESTIA_USER, current template: $PREVIOUS)"

mkdir -p "$SNIPPET_DIR"
install -m 0644 "$HERE/security-headers.conf" "$SNIPPET"

sed -e "s/%web_port%/%$PORT%/g" "$HERE/cv-static.tpl" > "$TPL_DIR/$NAME.tpl"
sed -e "s/%web_ssl_port%/%$SSL_PORT%/g" -e "$HTTP2_SED" "$HERE/cv-static.stpl" > "$TPL_DIR/$NAME.stpl"
chmod 0644 "$TPL_DIR/$NAME.tpl" "$TPL_DIR/$NAME.stpl"
echo "Installed   : $TPL_DIR/$NAME.{tpl,stpl} and $SNIPPET"

apply() {
	if [ "$MODE" = "web" ]; then
		"$BIN/v-change-web-domain-tpl" "$HESTIA_USER" "$DOMAIN" "$1"
	else
		"$BIN/v-change-web-domain-proxy-tpl" "$HESTIA_USER" "$DOMAIN" "$1"
	fi
}

set +e
apply "$NAME"
APPLY_STATUS=$?
nginx -t
TEST_STATUS=$?
set -e

if [ "$APPLY_STATUS" -ne 0 ] || [ "$TEST_STATUS" -ne 0 ]; then
	echo "nginx config check failed — restoring template '$PREVIOUS'." >&2
	apply "$PREVIOUS" || true
	nginx -t && systemctl reload nginx || true
	die "template not applied; the site keeps its previous configuration"
fi

systemctl reload nginx
echo
echo "Done. $DOMAIN now uses the '$NAME' $MODE template."
echo "Quick checks:"
echo "  curl -sI https://$DOMAIN/ | grep -iE '^(HTTP|content-security|strict-transport|cache-control)'"
echo "  curl -s -o /dev/null -w '%{http_code}\n' https://$DOMAIN/cv/abc        # expect 200 (SPA)"
echo "  curl -s -o /dev/null -w '%{http_code}\n' https://$DOMAIN/tidak-ada     # expect 404"
