(function () {
  "use strict";

  const endpoint = "/x/json-gps.cgi";
  const interval = 5000;
  const fixNames = ["Unknown", "No fix", "2D", "3D"];
  const modeNames = { modem: "WWAN modem", mifi: "MiFi" };
  let timer = null;
  let busy = false;

  function setText(id, value) {
    const el = $("#" + id);
    if (el) el.textContent = value;
  }

  function num(value, digits, unit) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "-";
    return value.toFixed(digits) + (unit ? " " + unit : "");
  }

  function badge(id, ok, yes, no) {
    const el = $("#" + id);
    if (!el) return;
    el.innerHTML = "";
    const span = document.createElement("span");
    span.className = "badge " + (ok ? "text-bg-success" : "text-bg-secondary");
    span.textContent = ok ? yes : no;
    el.appendChild(span);
  }

  function showError(message) {
    const el = $("#gps-error");
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("d-none", !message);
  }

  function render(data) {
    const tpv = data.tpv || {};
    const sky = data.sky || {};
    const fix = Number(tpv.mode) || 0;
    const hasFix = fix >= 2;

    badge("gps-enabled", data.enabled, "Yes", "No");
    badge("gps-running", data.running, "Running", "Stopped");
    setText(
      "gps-mode",
      modeNames[data.mode] || data.mode || "None (no modem or MiFi)",
    );
    setText("gps-source", data.source || "-");

    badge("gps-fix", hasFix, fixNames[fix], fixNames[fix] || "Unknown");
    setText("gps-time", tpv.time ? tpv.time.replace("T", " ") : "-");
    setText("gps-lat", hasFix ? num(tpv.lat, 6, "°") : "-");
    setText("gps-lon", hasFix ? num(tpv.lon, 6, "°") : "-");
    setText(
      "gps-alt",
      fix === 3
        ? num(tpv.altMSL !== undefined ? tpv.altMSL : tpv.alt, 1, "m")
        : "-",
    );
    setText(
      "gps-speed",
      typeof tpv.speed === "number" ? num(tpv.speed * 3.6, 1, "km/h") : "-",
    );
    setText("gps-track", num(tpv.track, 1, "°"));

    let sats = "-";
    if (Array.isArray(sky.satellites)) {
      const used = sky.satellites.filter((s) => s.used).length;
      sats = used + " used / " + sky.satellites.length + " visible";
    } else if (typeof sky.nSat === "number") {
      sats = (sky.uSat || 0) + " used / " + sky.nSat + " visible";
    }
    setText("gps-sats", sats);
    setText("gps-hdop", num(sky.hdop, 2));
    setText("gps-pdop", num(sky.pdop, 2));
    setText("gps-eph", num(tpv.eph, 1, "m"));
    setText("gps-epv", num(tpv.epv, 1, "m"));

    const map = $("#gps-map");
    if (map) {
      if (
        hasFix &&
        typeof tpv.lat === "number" &&
        typeof tpv.lon === "number"
      ) {
        map.href =
          "https://www.openstreetmap.org/?mlat=" +
          tpv.lat +
          "&mlon=" +
          tpv.lon +
          "#map=16/" +
          tpv.lat +
          "/" +
          tpv.lon;
        map.classList.remove("d-none");
      } else {
        map.classList.add("d-none");
      }
    }

    let note = "Updated " + new Date().toLocaleString();
    if (data.running && !data.tpv) note += " - gpsd sent no position report";
    setText("gps-updated-at", note);
  }

  async function load() {
    if (busy) return;
    busy = true;
    const button = $("#gps-refresh");
    if (button) button.disabled = true;
    try {
      const response = await fetch(endpoint, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error("Request failed with status " + response.status);
      }
      const payload = await response.json();
      if (!payload || !payload.data) throw new Error("Malformed GPS response.");
      render(payload.data);
      showError("");
      $("#gps-content").classList.remove("d-none");
    } catch (err) {
      showError(err && err.message ? err.message : "Unable to read GPS.");
    } finally {
      $("#gps-spinner").classList.add("d-none");
      if (button) button.disabled = false;
      busy = false;
    }
  }

  function schedule() {
    clearInterval(timer);
    timer = null;
    const auto = $("#gps-auto");
    if (auto && auto.checked) timer = setInterval(load, interval);
  }

  function init() {
    const button = $("#gps-refresh");
    if (button) button.addEventListener("click", load);
    const auto = $("#gps-auto");
    if (auto) auto.addEventListener("change", schedule);
    load();
    schedule();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
