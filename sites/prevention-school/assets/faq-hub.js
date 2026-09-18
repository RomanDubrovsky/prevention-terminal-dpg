(function () {
  var grid = document.getElementById("faq-grid");
  if (!grid) return;

  var search = document.getElementById("faq-search");
  var empty = document.getElementById("faq-empty");
  var localeToggle = document.getElementById("faq-locale-toggle");
  var personaRow = document.getElementById("faq-persona-row");
  var tagRow = document.getElementById("faq-tag-row");
  var items = Array.prototype.slice.call(grid.querySelectorAll(".faq-hub-item"));

  var state = {
    locale: (localeToggle && localeToggle.querySelector('[aria-pressed="true"]')) ?
      localeToggle.querySelector('[aria-pressed="true"]').getAttribute("data-locale") : "en",
    persona: "",
    tag: "",
    q: "",
  };

  function apply() {
    var visible = 0;
    items.forEach(function (el) {
      var ok = true;
      if (state.locale && el.getAttribute("data-locale") !== state.locale) ok = false;
      if (state.persona && el.getAttribute("data-persona") !== state.persona) ok = false;
      if (state.tag) {
        var tags = (el.getAttribute("data-tags") || "").split("|");
        if (tags.indexOf(state.tag) === -1) ok = false;
      }
      if (state.q) {
        var hay = el.getAttribute("data-search") || "";
        if (hay.indexOf(state.q) === -1) ok = false;
      }
      el.classList.toggle("faq-hidden", !ok);
      if (ok) visible += 1;
    });
    if (empty) empty.classList.toggle("faq-hidden", visible > 0);
  }

  if (search) {
    search.addEventListener("input", function () {
      state.q = (search.value || "").trim().toLowerCase();
      apply();
    });
  }

  if (localeToggle) {
    localeToggle.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-locale]");
      if (!btn) return;
      localeToggle.querySelectorAll("button").forEach(function (b) {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      state.locale = btn.getAttribute("data-locale");
      apply();
    });
  }

  function wireChipRow(row, attr) {
    if (!row) return;
    row.addEventListener("click", function (e) {
      var chip = e.target.closest(".faq-chip");
      if (!chip) return;
      row.querySelectorAll(".faq-chip").forEach(function (c) {
        c.setAttribute("aria-pressed", c === chip ? "true" : "false");
      });
      state[attr] = chip.getAttribute("data-" + attr) || "";
      apply();
    });
  }

  wireChipRow(personaRow, "persona");
  wireChipRow(tagRow, "tag");
  apply();
})();
