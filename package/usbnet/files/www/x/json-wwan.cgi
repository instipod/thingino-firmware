#!/bin/sh
# shellcheck disable=SC1091,SC3043

. /var/www/x/auth.sh
require_auth

RUN_DIR="/run/qmi"
CONFIG_JSON="/etc/thingino.json"

json_str() {
	printf '"%s"' "$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g')"
}

json_val() {
	local v
	v=$(printf '%s' "$1" | tr -d '\r\n')
	case "$v" in
		'{'*'}' | '['*']' | '"'*'"') printf '%s' "$v" ;;
		*) printf 'null' ;;
	esac
}

json_num() {
	case "$1" in
		'' | *[!0-9]*) printf 'null' ;;
		*) printf '%s' "$1" ;;
	esac
}

cfg() {
	jct "$CONFIG_JSON" get "modem.$1" 2>/dev/null | tr -d '"\r\n'
}

qmi() {
	uqmi -s -t 3000 -d "$dev" "$@" 2>/dev/null
}

sysfs() {
	cat "$1" 2>/dev/null | tr -d '\r\n'
}

sim_id() {
	local v
	v=$(qmi "$1" | tr -d '"\r\n')
	case "$v" in
		'' | *[!0-9]*) return 1 ;;
	esac
	printf '"%s"' "$v"
}

lock_qmi() {
	local tries=15
	until flock -n 8; do
		tries=$((tries - 1))
		[ "$tries" -gt 0 ] || return 1
		sleep 1
	done
}

find_iface() {
	local n
	for n in /sys/class/net/*; do
		if [ "$(readlink -f "$n/device")" = "$intf" ]; then
			basename "$n"
			return 0
		fi
	done
	return 1
}

modem_json() {
	local name="$1" dev="/dev/$1" intf usb iface pid cid managed=false
	local versions mode caps imei pin iccid imsi msisdn serving opname sysinfo signal
	local data settings addr state rx tx wds

	intf=$(readlink -f "/sys/class/usbmisc/$name/device")
	usb=${intf%/*}
	iface=$(find_iface)

	pid=$(cat "$RUN_DIR/$name.pid" 2>/dev/null)
	[ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && managed=true
	cid=$(cat "$RUN_DIR/$name.cid" 2>/dev/null)
	case "$cid" in '' | *[!0-9]*) wds="" ;; *) wds="wds,$cid" ;; esac

	mkdir -p "$RUN_DIR"
	exec 8>"$RUN_DIR/$name.qmi"
	if lock_qmi; then
		versions=$(qmi --get-versions)
		mode=$(qmi --get-device-operating-mode)
		caps=$(qmi --get-capabilities)
		imei=$(qmi --get-imei)
		pin=$(qmi --get-pin-status)
		iccid=$(sim_id --uim-get-iccid || sim_id --get-iccid)
		imsi=$(sim_id --uim-get-imsi || sim_id --get-imsi)
		msisdn=$(qmi --get-msisdn)
		serving=$(qmi --get-serving-system)
		opname=$(qmi --get-operator-name)
		sysinfo=$(qmi --get-system-info)
		signal=$(qmi --get-signal-info)
		if [ -n "$wds" ]; then
			data=$(qmi --set-client-id "$wds" --get-data-status)
			settings=$(qmi --set-client-id "$wds" --get-current-settings)
		fi
		flock -u 8
	fi
	exec 8>&-

	if [ -n "$iface" ]; then
		addr=$(ip -4 -o addr show dev "$iface" 2>/dev/null | awk '{print $4; exit}')
		state=$(sysfs "/sys/class/net/$iface/operstate")
		[ "$state" = "unknown" ] && [ "$(sysfs "/sys/class/net/$iface/carrier")" = "1" ] && state=up
		rx=$(sysfs "/sys/class/net/$iface/statistics/rx_bytes")
		tx=$(sysfs "/sys/class/net/$iface/statistics/tx_bytes")
	fi

	printf '{"device":%s,"iface":%s,"managed":%s,' \
		"$(json_str "$name")" "$(json_str "$iface")" "$managed"
	printf '"usb":{"manufacturer":%s,"product":%s,"vendor_id":%s,"product_id":%s,"driver":%s},' \
		"$(json_str "$(sysfs "$usb/manufacturer")")" \
		"$(json_str "$(sysfs "$usb/product")")" \
		"$(json_str "$(sysfs "$usb/idVendor")")" \
		"$(json_str "$(sysfs "$usb/idProduct")")" \
		"$(json_str "$(basename "$(readlink -f "$intf/driver")" 2>/dev/null)")"
	printf '"link":{"state":%s,"address":%s,"rx_bytes":%s,"tx_bytes":%s},' \
		"$(json_str "$state")" "$(json_str "$addr")" "$(json_num "$rx")" "$(json_num "$tx")"
	printf '"versions":%s,"operating_mode":%s,"capabilities":%s,"imei":%s,' \
		"$(json_val "$versions")" "$(json_val "$mode")" "$(json_val "$caps")" "$(json_val "$imei")"
	printf '"sim":{"pin":%s,"iccid":%s,"imsi":%s,"msisdn":%s},' \
		"$(json_val "$pin")" "$(json_val "$iccid")" "$(json_val "$imsi")" "$(json_val "$msisdn")"
	printf '"operator_name":%s,' "$(json_val "$opname")"
	printf '"serving_system":%s,"system_info":%s,"signal":%s,"data_status":%s,"settings":%s}' \
		"$(json_val "$serving")" "$(json_val "$sysinfo")" "$(json_val "$signal")" \
		"$(json_val "$data")" "$(json_val "$settings")"
}

enabled=true
[ "$(cfg enabled)" = "false" ] && enabled=false

printf 'Status: 200 OK\r\n'
printf 'Content-Type: application/json\r\n'
printf 'Cache-Control: no-cache\r\n'
printf 'Connection: close\r\n'
printf '\r\n'
printf '{"code":200,"result":"success","data":{"enabled":%s,"apn":%s,"modems":[' \
	"$enabled" "$(json_str "$(cfg apn)")"
sep=""
for f in /dev/cdc-wdm*; do
	[ -c "$f" ] || continue
	printf '%s' "$sep"
	modem_json "${f#/dev/}"
	sep=","
done
printf ']}}\n'
