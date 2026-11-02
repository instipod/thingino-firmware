(function () {
  "use strict";

  const endpoint = "/x/json-wwan.cgi";
  const interval = 15000;
  const signalUnits = {
    rssi: "dBm",
    rsrp: "dBm",
    rscp: "dBm",
    rsrq: "dB",
    snr: "dB",
    sinr: "dB",
    ecio: "dB",
    io: "dBm",
  };
  let timer = null;
  let busy = false;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function badge(ok, yes, no) {
    return el(
      "span",
      "badge " + (ok ? "text-bg-success" : "text-bg-secondary"),
      ok ? yes : no,
    );
  }

  function text(value) {
    if (value === undefined || value === null || value === "") return "-";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return value.join(", ") || "-";
    return String(value);
  }

  function bytes(value) {
    if (typeof value !== "number") return "-";
    const units = ["B", "KiB", "MiB", "GiB", "TiB"];
    let n = value;
    let i = 0;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i++;
    }
    return (i ? n.toFixed(1) : n) + " " + units[i];
  }

  function table(title, rows) {
    const col = el("div", "col-md-6 col-xl-3");
    col.appendChild(el("h6", "", title));
    const tbl = el("table", "table table-sm mb-0");
    const tbody = el("tbody");
    rows.forEach(([label, value]) => {
      const tr = el("tr");
      tr.appendChild(el("th", "text-secondary fw-normal", label));
      const td = el("td", "text-break");
      if (value instanceof Node) td.appendChild(value);
      else td.textContent = text(value);
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    col.appendChild(tbl);
    return col;
  }

  function flatten(value, prefix, rows) {
    if (value && typeof value === "object") {
      Object.keys(value).forEach((key) => {
        const name = Array.isArray(value)
          ? prefix + "[" + key + "]"
          : prefix
            ? prefix + "." + key
            : key;
        flatten(value[key], name, rows);
      });
    } else if (prefix) {
      rows.push([prefix, value]);
    }
    return rows;
  }

  function obj(value) {
    return value && typeof value === "object" ? value : {};
  }

  function servingCell(info) {
    const rats = obj(info);
    const names = Object.keys(rats);
    const name =
      names.find((n) => obj(rats[n]).cell_id !== undefined) || names[0];
    return { rat: name, cell: obj(rats[name]) };
  }

  function signalRows(signal) {
    const s = obj(signal);
    const rows = [["Radio", s.type ? String(s.type).toUpperCase() : "-"]];
    Object.keys(s).forEach((key) => {
      if (key === "type") return;
      const v = s[key];
      const unit = signalUnits[key];
      rows.push([
        key.toUpperCase(),
        typeof v === "number" && unit ? v + " " + unit : v,
      ]);
    });
    return rows;
  }

  function modemCard(m) {
    const usb = obj(m.usb);
    const link = obj(m.link);
    const sim = obj(m.sim);
    const pin = obj(sim.pin);
    const serving = obj(m.serving_system);
    const opname = obj(m.operator_name);
    const simNames = Array.isArray(opname.operator_plmn_names)
      ? opname.operator_plmn_names
      : [];
    const networkName =
      opname.nitz_long_name ||
      opname.nitz_short_name ||
      serving.plmn_description;
    const simProvider =
      opname.service_provider_name ||
      opname.operator_string_name ||
      obj(simNames[0]).long_name ||
      obj(simNames[0]).short_name;
    const caps = obj(m.capabilities);
    const settings = obj(m.settings);
    const ipv4 = obj(settings.ipv4);
    const { rat, cell } = servingCell(m.system_info);
    const registered = serving.registration === "registered";
    const connected = m.data_status === "connected";

    const card = el("div", "border rounded p-3 mb-3");
    const head = el("div", "d-flex flex-wrap gap-2 align-items-center mb-3");
    head.appendChild(
      el(
        "h6",
        "mb-0 me-2",
        [usb.manufacturer, usb.product].filter(Boolean).join(" ") || m.device,
      ),
    );
    head.appendChild(badge(registered, "Registered", "Not registered"));
    head.appendChild(badge(connected, "Connected", "Disconnected"));
    card.appendChild(head);

    const row = el("div", "row g-4");
    row.appendChild(
      table("Modem", [
        ["Control device", m.device],
        ["Interface", m.iface],
        ["USB ID", usb.vendor_id ? usb.vendor_id + ":" + usb.product_id : "-"],
        ["Driver", usb.driver],
        ["IMEI", m.imei],
        ["Operating mode", m.operating_mode],
        ["Networks", caps.networks],
        ["Supervisor", badge(m.managed, "Running", "Not running")],
      ]),
    );

    let mccMnc = "-";
    if (serving.plmn_mcc !== undefined) {
      mccMnc =
        serving.plmn_mcc +
        "-" +
        String(serving.plmn_mnc).padStart(
          serving.plmn_mnc_is_3_digit ? 3 : 2,
          "0",
        );
    }
    row.appendChild(
      table("SIM", [
        ["PIN1", pin.pin1_status],
        ["PIN1 tries left", pin.pin1_verify_tries],
        ["PUK1 tries left", pin.pin1_unblock_tries],
        ["ICCID", sim.iccid],
        ["IMSI", sim.imsi],
        ["Phone number", sim.msisdn],
      ]),
    );
    row.appendChild(
      table(
        "Network",
        [
          ["Registration", serving.registration],
          ["Network name", networkName],
          ["SIM provider", simProvider],
          ["MCC-MNC", mccMnc],
          ["Roaming", serving.roaming],
          ["Service", rat ? rat.toUpperCase() : "-"],
          ["Cell ID", cell.cell_id],
          [
            "TAC / LAC",
            cell.tracking_area_code !== undefined
              ? cell.tracking_area_code
              : cell.location_area_code,
          ],
        ].concat(signalRows(m.signal)),
      ),
    );

    const dns = [ipv4.dns1, ipv4.dns2].filter(Boolean).join(", ");
    row.appendChild(
      table("Data", [
        ["Session", m.data_status],
        ["Link", link.state],
        ["Address", link.address || ipv4.ip],
        ["Gateway", ipv4.gateway],
        ["Subnet", ipv4.subnet],
        ["DNS", dns],
        ["MTU", settings.mtu],
        ["Received", bytes(link.rx_bytes)],
        ["Sent", bytes(link.tx_bytes)],
      ]),
    );
    card.appendChild(row);

    const details = el("details", "mt-3");
    details.appendChild(el("summary", "small text-secondary", "All QMI data"));
    const raw = el("table", "table table-sm small mt-2 mb-0");
    const tbody = el("tbody");
    flatten(
      {
        capabilities: m.capabilities,
        versions: m.versions,
        operator_name: m.operator_name,
        serving_system: m.serving_system,
        system_info: m.system_info,
        signal: m.signal,
        settings: m.settings,
      },
      "",
      [],
    ).forEach(([key, value]) => {
      const tr = el("tr");
      tr.appendChild(el("th", "text-secondary fw-normal w-25", key));
      tr.appendChild(el("td", "text-break", text(value)));
      tbody.appendChild(tr);
    });
    raw.appendChild(tbody);
    details.appendChild(raw);
    card.appendChild(details);
    return card;
  }

  function render(data) {
    const enabled = $("#wwan-enabled");
    enabled.innerHTML = "";
    enabled.appendChild(badge(data.enabled, "Enabled", "Disabled"));
    $("#wwan-apn").textContent = data.apn || "(modem default)";

    const modems = Array.isArray(data.modems) ? data.modems : [];
    const box = $("#wwan-modems");
    const open = new Set();
    box.querySelectorAll("details[open]").forEach((d) => {
      open.add(d.dataset.device);
    });
    box.innerHTML = "";
    modems.forEach((m) => {
      const card = modemCard(m);
      const details = card.querySelector("details");
      details.dataset.device = m.device;
      if (open.has(m.device)) details.open = true;
      box.appendChild(card);
    });
    $("#wwan-none").classList.toggle("d-none", modems.length > 0);
    $("#wwan-updated-at").textContent =
      "Updated " + new Date().toLocaleString();
  }

  function showError(message) {
    const node = $("#wwan-error");
    node.textContent = message || "";
    node.classList.toggle("d-none", !message);
  }

  async function load() {
    if (busy) return;
    busy = true;
    const button = $("#wwan-refresh");
    if (button) button.disabled = true;
    try {
      const response = await fetch(endpoint, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Request failed with status " + response.status);
      }
      const payload = await response.json();
      if (!payload || !payload.data) {
        throw new Error("Malformed WWAN response.");
      }
      render(payload.data);
      showError("");
      $("#wwan-content").classList.remove("d-none");
    } catch (err) {
      showError(
        err && err.message ? err.message : "Unable to read modem status.",
      );
    } finally {
      $("#wwan-spinner").classList.add("d-none");
      if (button) button.disabled = false;
      busy = false;
    }
  }

  function schedule() {
    clearInterval(timer);
    timer = null;
    const auto = $("#wwan-auto");
    if (auto && auto.checked) timer = setInterval(load, interval);
  }

  function init() {
    const button = $("#wwan-refresh");
    if (button) button.addEventListener("click", load);
    const auto = $("#wwan-auto");
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
