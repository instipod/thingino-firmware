(function () {
  "use strict";

  const endpoint = "/x/mifi-status.cgi";
  const interval = 10000;
  let timer = null;
  let busy = false;

  function setText(id, value) {
    const el = $("#" + id);
    if (el) el.textContent = value;
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
    const el = $("#mifi-error");
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("d-none", !message);
  }

  function flatten(value, prefix, rows) {
    if (value && typeof value === "object") {
      const keys = Object.keys(value);
      if (!keys.length) rows.push([prefix, Array.isArray(value) ? "[]" : "{}"]);
      keys.forEach((key) => {
        const name = Array.isArray(value)
          ? prefix + "[" + key + "]"
          : prefix
            ? prefix + "." + key
            : key;
        flatten(value[key], name, rows);
      });
    } else {
      rows.push([prefix, value === null ? "null" : String(value)]);
    }
    return rows;
  }

  function renderStatus(text) {
    const tbody = $("#mifi-status");
    const raw = $("#mifi-raw");
    tbody.innerHTML = "";
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = undefined;
    }
    if (data && typeof data === "object") {
      flatten(data, "", []).forEach(([key, value]) => {
        const tr = document.createElement("tr");
        const th = document.createElement("th");
        th.className = "text-secondary fw-normal w-25";
        th.textContent = key;
        const td = document.createElement("td");
        td.className = "text-break";
        td.textContent = value;
        tr.append(th, td);
        tbody.appendChild(tr);
      });
      raw.classList.add("d-none");
    } else {
      raw.textContent = text;
      raw.classList.remove("d-none");
    }
    $("#mifi-details").classList.remove("d-none");
  }

  async function load() {
    if (busy) return;
    busy = true;
    const button = $("#mifi-refresh");
    if (button) button.disabled = true;
    try {
      const response = await fetch(endpoint, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const text = await response.text();
      if (response.status === 400) {
        badge("mifi-attached", false, "Yes", "No");
        $("#mifi-details").classList.add("d-none");
      } else if (!response.ok) {
        throw new Error("Request failed with status " + response.status);
      } else {
        badge("mifi-attached", true, "Yes", "No");
        renderStatus(text);
      }
      setText("mifi-updated-at", "Updated " + new Date().toLocaleString());
      showError("");
      $("#mifi-content").classList.remove("d-none");
    } catch (err) {
      showError(
        err && err.message ? err.message : "Unable to read MiFi status.",
      );
    } finally {
      $("#mifi-spinner").classList.add("d-none");
      if (button) button.disabled = false;
      busy = false;
    }
  }

  function schedule() {
    clearInterval(timer);
    timer = null;
    const auto = $("#mifi-auto");
    if (auto && auto.checked) timer = setInterval(load, interval);
  }

  function init() {
    const button = $("#mifi-refresh");
    if (button) button.addEventListener("click", load);
    const auto = $("#mifi-auto");
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
