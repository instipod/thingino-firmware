THINGINO_GPSD_VERSION = 1.0
THINGINO_GPSD_SITE_METHOD = local
THINGINO_GPSD_SITE = $(THINGINO_GPSD_PKGDIR)/files
THINGINO_GPSD_LICENSE = MIT

# Installed after gpsd so this S50gpsd replaces the stock Buildroot one.
THINGINO_GPSD_DEPENDENCIES = gpsd

define THINGINO_GPSD_INSTALL_TARGET_CMDS
	$(INSTALL) -D -m 0755 $(THINGINO_GPSD_PKGDIR)/files/S50gpsd \
		$(TARGET_DIR)/etc/init.d/S50gpsd
	$(INSTALL) -D -m 0755 $(THINGINO_GPSD_PKGDIR)/files/gps-select \
		$(TARGET_DIR)/usr/sbin/gps-select
	$(INSTALL) -D -m 0755 $(THINGINO_GPSD_PKGDIR)/files/udhcpc-gpsd \
		$(TARGET_DIR)/usr/share/udhcpc/default.script.d/gpsd
	$(SED) 's|^MIFI_SOURCE=.*|MIFI_SOURCE="$(call qstrip,$(BR2_PACKAGE_GPSD_DEVICES))"|' \
		$(TARGET_DIR)/usr/sbin/gps-select
endef

ifeq ($(BR2_PACKAGE_THINGINO_WEBUI),y)
THINGINO_GPSD_DEPENDENCIES += thingino-webui
define THINGINO_GPSD_INSTALL_WWW
	$(INSTALL) -D -m 0644 $(THINGINO_GPSD_PKGDIR)/files/www/info-gps.html \
		$(TARGET_DIR)/var/www/info-gps.html
	$(INSTALL) -D -m 0644 $(THINGINO_GPSD_PKGDIR)/files/www/a/info-gps.js \
		$(TARGET_DIR)/var/www/a/info-gps.js
	$(INSTALL) -D -m 0755 $(THINGINO_GPSD_PKGDIR)/files/www/x/json-gps.cgi \
		$(TARGET_DIR)/var/www/x/json-gps.cgi
	$(INSTALL) -D -m 0644 $(THINGINO_GPSD_PKGDIR)/files/gps.webui.json \
		$(TARGET_DIR)/var/www/a/plugins/gps.webui.json
endef
THINGINO_GPSD_POST_INSTALL_TARGET_HOOKS += THINGINO_GPSD_INSTALL_WWW
endif

# Modem NMEA ports: option (Quectel and generic Qualcomm) and qcserial (Sierra).
ifeq ($(BR2_PACKAGE_USBNET_QMI_WWAN),y)
define THINGINO_GPSD_LINUX_CONFIG_FIXUPS
	$(call KCONFIG_SET_OPT,CONFIG_USB_SERIAL,m)
	$(call KCONFIG_SET_OPT,CONFIG_USB_SERIAL_WWAN,m)
	$(call KCONFIG_SET_OPT,CONFIG_USB_SERIAL_OPTION,m)
	$(call KCONFIG_SET_OPT,CONFIG_USB_SERIAL_QUALCOMM,m)
endef

define THINGINO_GPSD_INSTALL_MODEM_MODULES
	mkdir -p $(TARGET_DIR)/etc/modules.d
	printf '%s\n' option qcserial > $(TARGET_DIR)/etc/modules.d/55-gpsd-modem
endef
THINGINO_GPSD_POST_INSTALL_TARGET_HOOKS += THINGINO_GPSD_INSTALL_MODEM_MODULES
endif

$(eval $(generic-package))
