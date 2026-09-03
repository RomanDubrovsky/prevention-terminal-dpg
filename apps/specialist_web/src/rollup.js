(function () {
  const meta = document.querySelector('meta[name="app-api-base"]');
  const apiBase = (meta && meta.content) || "https://api.prevention.school";
  const params = new URLSearchParams(window.location.search);
  const input = document.getElementById("terminal-user-id");
  const statusEl = document.getElementById("rollup-status");
  const grid = document.getElementById("rollup-grid");
  const form = document.getElementById("rollup-form");

  if (params.get("terminal_user_id") && input) {
    input.value = params.get("terminal_user_id");
    loadRollup(params.get("terminal_user_id"));
  }

  const labels = {
    consultation_count: "Консультации",
    case_count: "Кейсы",
    ipr_count: "ИПР",
    group_session_count: "Группы",
    work_minutes: "Минуты",
  };

  async function loadRollup(tid) {
    if (statusEl) statusEl.textContent = "Загрузка…";
    if (grid) {
      grid.hidden = true;
      grid.innerHTML = "";
    }
    try {
      const q = encodeURIComponent(tid);
      const res = await fetch(apiBase.replace(/\/$/, "") + "/api/terminal/federation/rollup?terminal_user_id=" + q);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "rollup_failed");
      const r = data.rollup || {};
      if (statusEl) {
        statusEl.textContent =
          "Узлов: " + (r.contributing_nodes || 0) + (r.suppressed ? " · подавление <" + (r.k_floor || 5) : "");
      }
      const items = [
        ["Узлов", r.contributing_nodes],
        ["k-anon", r.suppressed ? "< " + (r.k_floor || 5) : "OK"],
      ];
      const metrics = r.metrics || {};
      Object.keys(metrics).forEach(function (k) {
        items.push([labels[k] || k, metrics[k]]);
      });
      if (grid) {
        items.forEach(function (pair) {
          const wrap = document.createElement("div");
          const dt = document.createElement("dt");
          dt.textContent = pair[0];
          const dd = document.createElement("dd");
          dd.textContent = String(pair[1]);
          wrap.appendChild(dt);
          wrap.appendChild(dd);
          grid.appendChild(wrap);
        });
        grid.hidden = false;
      }
    } catch (e) {
      if (statusEl) statusEl.textContent = String(e.message || e);
    }
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const tid = (input && input.value || "").trim();
      if (!tid) return;
      const url = new URL(window.location.href);
      url.searchParams.set("terminal_user_id", tid);
      window.history.replaceState({}, "", url);
      loadRollup(tid);
    });
  }
})();
