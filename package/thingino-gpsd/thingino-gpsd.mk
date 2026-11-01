THINGINO_GPSD_VERSION = 1.0
THINGINO_GPSD_SITE_METHOD = local
THINGINO_GPSD_SITE = $(THINGINO_GPSD_PKGDIR)/files
THINGINO_GPSD_LICENSE = MIT

# Installed after gpsd so this S50gpsd replaces the stock Buildroot one.
THINGINO_GPSD_DEPENDENCIES = gpsd

define THINGINO_GPSD_INSTALL_TARGET_CMDS
	$(INSTALL) -D -m 0755 $(THINGINO_GPSD_PKGDIR)/files/S50gpsd \
		$(TARGET_DIR)/etc/init.d/S50gpsd
	$(SED) 's|^DEVICES=.*|DEVICES="$(call qstrip,$(BR2_PACKAGE_GPSD_DEVICES))"|' \
		$(TARGET_DIR)/etc/init.d/S50gpsd
endef

$(eval $(generic-package))
