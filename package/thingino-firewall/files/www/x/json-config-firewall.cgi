#!/bin/sh
# shellcheck disable=SC1091,SC2018,SC2019,SC3043

. /var/www/x/auth.sh
require_auth

DOMAIN="firewall"
CONFIG_FILE="/etc/thingino.json"
INIT_SCRIPT="/etc/init.d/S35firewall"
TMP_FILE=""
REQ_FILE=""

cleanup() {
	[ -n "$TMP_FILE" ] && rm -f "$TMP_FILE"
	[ -n "$REQ_FILE" ] && rm -f "$REQ_FILE"
}
trap cleanup EXIT

ADDR_AWK='
function grp(g) {
	if (g == "" || length(g) > 4 || g ~ /[^0-9A-Fa-f]/) return ""
	while (length(g) < 4) g = "0" g
	return g
}
function expand6(s,   dc, head, tail, hp, tp, hn, tn, miss, i, g, out) {
	if (s ~ /:::/) return ""
	dc = index(s, "::")
	out = ""
	if (dc) {
		head = substr(s, 1, dc - 1)
		tail = substr(s, dc + 2)
		if (index(tail, "::")) return ""
		hn = (head == "") ? 0 : split(head, hp, ":")
		tn = (tail == "") ? 0 : split(tail, tp, ":")
		miss = 8 - hn - tn
		if (miss < 1) return ""
		for (i = 1; i <= hn; i++) { g = grp(hp[i]); if (g == "") return ""; out = out g }
		for (i = 1; i <= miss; i++) out = out "0000"
		for (i = 1; i <= tn; i++) { g = grp(tp[i]); if (g == "") return ""; out = out g }
	} else {
		if (split(s, hp, ":") != 8) return ""
		for (i = 1; i <= 8; i++) { g = grp(hp[i]); if (g == "") return ""; out = out g }
	}
	return tolower(out)
}
function bits6(hex,   i, out) {
	out = ""
	for (i = 1; i <= length(hex); i++) out = out H[substr(hex, i, 1)]
	return out
}
function v4num(ip,   o) {
	split(ip, o, ".")
	return o[1] * 16777216 + o[2] * 65536 + o[3] * 256 + o[4]
}
function valid(a,   p, n, ip, bits, o, i) {
	n = split(a, p, "/")
	if (n > 2) return 0
	ip = p[1]
	bits = (n == 2) ? p[2] : ""
	if (n == 2 && bits !~ /^[0-9]+$/) return 0
	if (ip ~ /:/) {
		if (bits != "" && bits + 0 > 128) return 0
		return expand6(ip) != ""
	}
	if (ip !~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/) return 0
	split(ip, o, ".")
	for (i = 1; i <= 4; i++) if (o[i] + 0 > 255) return 0
	if (bits != "" && bits + 0 > 32) return 0
	return 1
}
function contains(net, c,   p, n, bits, m) {
	n = split(net, p, "/")
	if ((p[1] ~ /:/) != (c ~ /:/)) return 0
	if (c ~ /:/) {
		bits = (n == 2) ? p[2] + 0 : 128
		return substr(bits6(expand6(p[1])), 1, bits) == substr(bits6(expand6(c)), 1, bits)
	}
	bits = (n == 2) ? p[2] + 0 : 32
	m = 2 ^ (32 - bits)
	return int(v4num(p[1]) / m) == int(v4num(c) / m)
}
BEGIN {
	split("0000 0001 0010 0011 0100 0101 0110 0111 1000 1001 1010 1011 1100 1101 1110 1111", B, " ")
	for (i = 0; i < 16; i++) H[substr("0123456789abcdef", i + 1, 1)] = B[i + 1]
	if (mode == "valid") exit !valid(a)
	if (mode == "contains") exit !contains(a, b)
	exit 1
}'

addr_valid() {
	awk -v mode=valid -v a="$1" "$ADDR_AWK"
}

addr_contains() {
	awk -v mode=contains -v a="$1" -v b="$2" "$ADDR_AWK"
}

json_escape() {
	printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

send_json() {
	printf 'Status: %s\n' "${2:-200 OK}"
	cat <<EOF
Content-Type: application/json
Cache-Control: no-store
Pragma: no-cache
Connection: close

$1
EOF
	exit 0
}

json_error() {
	send_json "{\"error\":{\"code\":${1:-400},\"message\":\"$(json_escape "$2")\"}}" "${3:-400 Bad Request}"
}

strip_json_string() {
	case "$1" in
		"" | null) printf '' ;;
		*) printf '%s' "$1" | sed -e 's/^"//' -e 's/"$//' ;;
	esac
}

normalize_bool() {
	case "$(printf '%s' "$1" | tr 'A-Z' 'a-z')" in
		1 | true | yes | on) printf 'true' ;;
		*) printf 'false' ;;
	esac
}

ensure_config() {
	if [ ! -f "$CONFIG_FILE" ]; then
		umask 077
		echo '{}' >"$CONFIG_FILE"
	fi
}

cfg() {
	strip_json_string "$(jct "$CONFIG_FILE" get "$DOMAIN.$1" 2>/dev/null)"
}

client_addr() {
	local addr="$REMOTE_ADDR"
	case "$addr" in
		::ffff:*.*.*.*) addr="${addr#::ffff:}" ;;
	esac
	printf '%s' "$addr"
}

is_active() {
	[ -x "$INIT_SCRIPT" ] && "$INIT_SCRIPT" status >/dev/null 2>&1
}

handle_get() {
	ensure_config
	local active=false
	is_active && active=true
	send_json "{\"enabled\":$(normalize_bool "$(cfg enabled)"),\"allow_ping\":$(normalize_bool "$(cfg allow_ping)"),\"trusted\":\"$(json_escape "$(cfg trusted)")\",\"active\":$active,\"client\":\"$(json_escape "$(client_addr)")\"}"
}

handle_post() {
	local enabled allow_ping raw trusted addr client covered

	REQ_FILE=$(mktemp /tmp/${DOMAIN}-req.XXXXXX)
	if [ -n "$CONTENT_LENGTH" ]; then
		dd bs=1 count="$CONTENT_LENGTH" 2>/dev/null >"$REQ_FILE"
	else
		cat >"$REQ_FILE"
	fi

	enabled=$(normalize_bool "$(jct "$REQ_FILE" get enabled 2>/dev/null)")
	allow_ping=$(normalize_bool "$(jct "$REQ_FILE" get allow_ping 2>/dev/null)")
	raw=$(strip_json_string "$(jct "$REQ_FILE" get trusted 2>/dev/null)")
	raw=$(printf '%s' "$raw" | sed -e 's/\\[nrt]/ /g' | tr ',;\t\r\n' '     ')

	trusted=""
	for addr in $raw; do
		addr_valid "$addr" ||
			json_error 422 "Invalid address or subnet: $addr" "422 Unprocessable Entity"
		case " $trusted " in
			*" $addr "*) ;;
			*) trusted="${trusted:+$trusted }$addr" ;;
		esac
	done

	if [ "$enabled" = "true" ]; then
		[ -n "$trusted" ] ||
			json_error 422 "Add at least one trusted address before enabling the firewall" "422 Unprocessable Entity"

		client=$(client_addr)
		case "$client" in
			"" | 127.* | ::1) ;;
			*)
				covered=false
				for addr in $trusted; do
					if addr_contains "$addr" "$client"; then
						covered=true
						break
					fi
				done
				[ "$covered" = "true" ] ||
					json_error 422 "Your address $client is not in the trusted list; saving would lock you out" "422 Unprocessable Entity"
				;;
		esac
	fi

	ensure_config
	TMP_FILE=$(mktemp /tmp/${DOMAIN}.XXXXXX)
	echo '{}' >"$TMP_FILE"
	jct "$TMP_FILE" set "$DOMAIN.enabled" "$enabled" >/dev/null 2>&1
	jct "$TMP_FILE" set "$DOMAIN.allow_ping" "$allow_ping" >/dev/null 2>&1
	jct "$TMP_FILE" set "$DOMAIN.trusted" "$trusted" >/dev/null 2>&1
	jct "$CONFIG_FILE" import "$TMP_FILE" >/dev/null 2>&1

	if [ -x "$INIT_SCRIPT" ]; then
		"$INIT_SCRIPT" restart >/dev/null 2>&1
		if [ "$enabled" = "true" ] && [ ! -f /run/portal_mode ] && ! is_active; then
			json_error 500 "Settings saved, but the firewall rules could not be applied. Check logread." "500 Internal Server Error"
		fi
	fi

	send_json '{"status":"ok"}'
}

case "$REQUEST_METHOD" in
	GET | "") handle_get ;;
	POST) handle_post ;;
	*) json_error 405 "Method not allowed" "405 Method Not Allowed" ;;
esac
