(function () {
  const endpoint = "/x/json-config-firewall.cgi";
  const form = $("#firewallForm");
  const enabledSwitch = $("#firewall_enabled");
  const pingSwitch = $("#firewall_allow_ping");
  const trustedInput = $("#firewall_trusted");
  const statusBadge = $("#firewall_status");
  const clientLabel = $("#firewall_client");
  const addClientButton = $("#firewall_add_client");
  const submitButton = $("#firewall_submit");
  const reloadButton = $("#firewall-reload");
  let clientAddr = "";

  function trustedList() {
    return trustedInput.value
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function toggleBusy(state, label) {
    [
      submitButton,
      enabledSwitch,
      pingSwitch,
      trustedInput,
      addClientButton,
    ].forEach((el) => {
      el.disabled = state;
    });
    if (state) {
      showBusy(label || "Working...");
    } else {
      hideBusy();
    }
  }

  function setStatus(active) {
    statusBadge.textContent = active ? "active" : "inactive";
    statusBadge.className =
      "badge " + (active ? "text-bg-success" : "text-bg-secondary");
  }

  async function loadConfig(options = {}) {
    const preserveBusy = options.preserveBusy === true;
    if (!preserveBusy) toggleBusy(true, "Loading firewall settings...");
    try {
      const response = await fetch(endpoint, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Failed to load firewall settings");
      const data = await response.json();
      enabledSwitch.checked = data.enabled === true;
      pingSwitch.checked = data.allow_ping === true;
      trustedInput.value = (data.trusted || "")
        .split(/\s+/)
        .filter(Boolean)
        .join("\n");
      clientAddr = data.client || "";
      clientLabel.textContent = clientAddr || "unknown";
      addClientButton.hidden = !clientAddr;
      setStatus(data.active === true);
    } catch (err) {
      showAlert("danger", err.message || "Unable to load firewall settings.");
    } finally {
      if (!preserveBusy) toggleBusy(false);
    }
  }

  async function saveConfig(payload) {
    toggleBusy(true, "Saving firewall settings...");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || (result && result.error)) {
        throw new Error(
          result && result.error && result.error.message
            ? result.error.message
            : "Failed to save settings",
        );
      }
      showAlert("", "");
      showOverlayMessage("Firewall settings saved.", "success");
      await loadConfig({ preserveBusy: true });
    } catch (err) {
      showAlert("danger", err.message || "Failed to save firewall settings.");
    } finally {
      toggleBusy(false);
    }
  }

  addClientButton.addEventListener("click", () => {
    if (!clientAddr) return;
    const list = trustedList();
    if (!list.includes(clientAddr)) list.push(clientAddr);
    trustedInput.value = list.join("\n");
  });

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    saveConfig({
      enabled: enabledSwitch.checked,
      allow_ping: pingSwitch.checked,
      trusted: trustedList().join(" "),
    });
  });

  reloadButton.addEventListener("click", async () => {
    reloadButton.disabled = true;
    try {
      await loadConfig();
      showAlert("info", "Firewall settings reloaded from camera.", 3000);
    } finally {
      reloadButton.disabled = false;
    }
  });

  loadConfig();
})();
