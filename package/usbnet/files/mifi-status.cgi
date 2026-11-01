#!/bin/sh
# shellcheck disable=SC1091

. /var/www/x/auth.sh
require_auth

MIFI_STATUS_URL="http://192.168.1.1/srv/status"

json_header() {
	printf 'Status: %s\r\n' "$1"
	printf 'Content-Type: %s\r\n' "${2:-application/json}"
	printf 'Cache-Control: no-cache\r\n'
	printf 'Connection: close\r\n'
	printf '\r\n'
}

body=$(mktemp /tmp/mifi-status.XXXXXX)
trap 'rm -f "$body"' EXIT

content_type=$(curl -fsS --connect-timeout 2 --max-time 5 \
	-o "$body" -w '%{content_type}' "$MIFI_STATUS_URL" 2>/dev/null)

if [ $? -ne 0 ] || [ ! -s "$body" ]; then
	json_header "400 Bad Request"
	printf '{"error":{"code":400,"message":"MiFi not connected"}}\n'
	exit 0
fi

json_header "200 OK" "${content_type:-application/json}"
cat "$body"
