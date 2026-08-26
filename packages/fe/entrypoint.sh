#!/bin/sh
set -e

# Generate config.js safely using JSON escaping via jq
tmp=$(mktemp)
jq -n \
	--arg api "${VITE_API_URL:-}" \
	--arg oidc "${VITE_OIDC_ID:-}" \
	--arg base "${VITE_BASE_PATH:-}" \
	--arg help "${VITE_HELP_GUIDE:-}" \
	--arg idp "${VITE_IDP_ACCOUNT_URL:-}" \
	--arg start "${VITE_STARTING_GUIDE:-}" \
	--arg contact "${VITE_CONTACT:-}" \
	--arg name "${VITE_APPLICATION_NAME:-}" \
	--arg requestCertification "${VITE_SHOW_REQUEST_CERTIFICATION:-}" \
	'{
		VITE_API_URL: $api,
		VITE_OIDC_ID: $oidc,
		VITE_BASE_PATH: $base,
		VITE_HELP_GUIDE: $help,
		VITE_IDP_ACCOUNT_URL: $idp,
		VITE_STARTING_GUIDE: $start,
		VITE_CONTACT: $contact,
		VITE_APPLICATION_NAME: $name,
		VITE_SHOW_REQUEST_CERTIFICATION: $requestCertification
	}' > "$tmp"

{
	printf 'window.__APP_CONFIG__ = ';
	cat "$tmp";
	printf ';\n';
} > /usr/share/nginx/html/config.js
rm -f "$tmp"

exec nginx -g 'daemon off;'
