################################################################################
#
# thingino-uqmi
#
################################################################################

THINGINO_UQMI_VERSION = 7914da43cddaaf6cfba116260c81e6e9adffd5ab
THINGINO_UQMI_SITE = https://git.openwrt.org/project/uqmi.git
THINGINO_UQMI_SITE_METHOD = git
THINGINO_UQMI_LICENSE = LGPL-2.0+
THINGINO_UQMI_LICENSE_FILES = uqmi/uqmi.c

# Buildroot's uqmi pulls in Buildroot's libubox, whose libubox.so then
# replaces thingino-libubox in the target. uhttpd is built against
# thingino-libubox, and struct ustream differs between the two, so uhttpd
# misreads its descriptors. Building against thingino-libubox keeps one copy.
THINGINO_UQMI_DEPENDENCIES = thingino-libubox thingino-jct

$(eval $(cmake-package))
