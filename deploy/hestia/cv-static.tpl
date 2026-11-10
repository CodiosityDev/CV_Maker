#=========================================================================#
# CV Maker — HTTP server: redirect everything to HTTPS.                   #
# Installed by deploy/hestia/install.sh. Edit the copy in the repo, then  #
# re-run the installer; changes made here are lost on domain rebuild.     #
#=========================================================================#

server {
	listen      %ip%:%web_port%;
	server_name %domain_idn% %alias_idn%;
	root        %docroot%;
	server_tokens off;

	access_log  /var/log/nginx/domains/%domain%.log combined;
	access_log  /var/log/nginx/domains/%domain%.bytes bytes;
	error_log   /var/log/nginx/domains/%domain%.error.log error;

	location ~ /\.(?!well-known\/) {
		deny all;
		return 404;
	}

	# Secrets copied into public_html by mistake (cvmaker-api.env, dumps, keys) are never served.
	location ~* \.(env|sql|bak|pem|key|log|ini|sh)$ {
		deny all;
		return 404;
	}

	# A location-level return keeps Let's Encrypt renewals working: Hestia's ACME
	# challenge location (included below) is a regex and wins over this prefix match.
	location / {
		return 301 https://%domain_idn%$request_uri;
	}

	include %home%/%user%/conf/web/%domain%/nginx.conf_*;
}
