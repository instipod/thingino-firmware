#!/bin/sh
# shellcheck disable=SC1091

. /var/www/x/auth.sh
require_auth

PIDFILE="/run/gpsd.pid"

json_str() {
	printf '"%s"' "$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g')"
}

enabled=true
[ "$(jct /etc/thingino.json get gps.enabled 2>/dev/null | tr -d '"\r\n')" = "false" ] && enabled=false

running=false
pid=$(cat "$PIDFILE" 2>/dev/null)
[ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && running=true

source=$(cat /run/gpsd.source 2>/dev/null)
mode=$(cat /run/gpsd.mode 2>/dev/null)

tpv=null
sky=null
if [ "$running" = "true" ]; then
	reports=$(timeout 5 gpspipe -w -n 12 -x 3 2>/dev/null)
	line=$(printf '%s\n' "$reports" | grep '"class":"TPV"' | tail -n 1)
	[ -n "$line" ] && tpv=$line
	line=$(printf '%s\n' "$reports" | grep '"class":"SKY"' | tail -n 1)
	[ -n "$line" ] && sky=$line
fi

printf 'Status: 200 OK\r\n'
printf 'Content-Type: application/json\r\n'
printf 'Cache-Control: no-cache\r\n'
printf 'Connection: close\r\n'
printf '\r\n'
printf '{"code":200,"result":"success","data":{"enabled":%s,"running":%s,"source":%s,"mode":%s,"tpv":%s,"sky":%s}}\n' \
	"$enabled" "$running" "$(json_str "$source")" "$(json_str "$mode")" "$tpv" "$sky"
