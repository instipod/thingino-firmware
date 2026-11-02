THINGINO_FIREWALL_VERSION = 1.0
THINGINO_FIREWALL_SITE_METHOD = local
THINGINO_FIREWALL_SITE = $(THINGINO_FIREWALL_PKGDIR)/files
THINGINO_FIREWALL_DEPENDENCIES = iptables

define THINGINO_FIREWALL_INSTALL_TARGET_CMDS
	$(INSTALL) -D -m 0755 $(THINGINO_FIREWALL_PKGDIR)/files/S35firewall \
		$(TARGET_DIR)/etc/init.d/S35firewall
endef

ifeq ($(BR2_PACKAGE_THINGINO_WEBUI),y)
THINGINO_FIREWALL_DEPENDENCIES += thingino-webui
define THINGINO_FIREWALL_INSTALL_WWW
	$(INSTALL) -D -m 0644 $(THINGINO_FIREWALL_PKGDIR)/files/www/config-firewall.html \
		$(TARGET_DIR)/var/www/config-firewall.html
	$(INSTALL) -D -m 0644 $(THINGINO_FIREWALL_PKGDIR)/files/www/a/config-firewall.js \
		$(TARGET_DIR)/var/www/a/config-firewall.js
	$(INSTALL) -D -m 0755 $(THINGINO_FIREWALL_PKGDIR)/files/www/x/json-config-firewall.cgi \
		$(TARGET_DIR)/var/www/x/json-config-firewall.cgi
	$(INSTALL) -D -m 0644 $(THINGINO_FIREWALL_PKGDIR)/files/firewall.webui.json \
		$(TARGET_DIR)/var/www/a/plugins/firewall.webui.json
endef
THINGINO_FIREWALL_POST_INSTALL_TARGET_HOOKS += THINGINO_FIREWALL_INSTALL_WWW
endif

$(eval $(generic-package))
