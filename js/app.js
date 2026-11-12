(function () {
  "use strict";
  const GT = window.GradeTrack;
  const pageNames = {
    dashboard: "Dashboard", subjects: "My subjects", calculator: "Grade calculator",
    targets: "Target planner", performance: "Performance", history: "Grade history", settings: "Settings"
  };
  const sidebar = document.getElementById("sidebar");
  const scrim = document.getElementById("mobileScrim");

  GT.toast = function (message, kind) {
    const region = document.getElementById("toastRegion");
    if (!region) return;
    const toast = document.createElement("div");
    toast.className = "toast " + (kind === "warning" ? "toast-warning" : "toast-success");
    toast.textContent = message;
    region.appendChild(toast);
    window.setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(5px)";
      window.setTimeout(() => toast.remove(), 220);
    }, 3400);
  };

  function setMobileMenu(open) {
    sidebar.classList.toggle("is-open", open);
    scrim.hidden = !open;
    document.getElementById("menuToggle").setAttribute("aria-expanded", String(open));
    document.getElementById("menuToggle").setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  }

  GT.navigate = function (page, subjectId) {
    const targetPage = pageNames[page] ? page : "dashboard";
    document.querySelectorAll(".page").forEach((element) => element.classList.toggle("is-visible", element.id === "page-" + targetPage));
    document.querySelectorAll(".nav-item[data-page]").forEach((element) => {
      const active = element.dataset.page === targetPage;
      element.classList.toggle("is-active", active);
      if (active) element.setAttribute("aria-current", "page");
      else element.removeAttribute("aria-current");
    });
    document.getElementById("pageCrumb").textContent = pageNames[targetPage];
    setMobileMenu(false);
    GT.renderAll(targetPage === "calculator" ? { calculatorSubject: subjectId } : targetPage === "targets" ? { targetSubject: subjectId } : undefined);
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  GT.renderAll = function (options) {
    const opts = options || {};
    document.getElementById("navSubjectCount").textContent = GT.state.subjects.length;
    GT.renderSubjects();
    GT.renderDashboard();
    GT.renderCalculator(opts.calculatorSubject);
    GT.renderTargetPlanner(opts.targetSubject);
    GT.renderPerformance();
    GT.renderHistory();
  };

  function renderSettings() {
    const settings = GT.state.settings;
    document.getElementById("settingPass").value = settings.passingGrade;
    document.getElementById("settingTarget").value = settings.targetGrade;
    document.getElementById("settingDisplay").value = settings.display;
    document.getElementById("settingScaleTop").value = settings.scaleTop;
    document.getElementById("settingScaleBottom").value = settings.scaleBottom;
    document.getElementById("scaleFields").classList.toggle("is-visible", settings.display === "custom");
  }

  function exportBackup() {
    const data = JSON.stringify({ app: "GradeTrack", version: 1, exportedAt: new Date().toISOString(), data: GT.state }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "gradetrack-backup.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    GT.toast("Backup downloaded to this device.", "success");
  }

  function normalizeImport(payload) {
    const bundle = Array.isArray(payload) ? { subjects: payload } : payload?.data && typeof payload.data === "object" ? payload.data : payload;
    if (!bundle || !Array.isArray(bundle.subjects)) throw new Error("This file does not contain a GradeTrack subject list.");
    const subjects = bundle.subjects.map((raw, index) => {
      if (!raw || typeof raw.name !== "string" || !raw.name.trim()) throw new Error("A subject is missing its name.");
      const parts = Array.isArray(raw.components) ? raw.components : Array.isArray(raw.parts) ? raw.parts : null;
      if (!parts?.length) throw new Error(`“${raw.name}” needs at least one grading component.`);
      const components = parts.map((part, componentIndex) => {
        const total = Number(part.total ?? 100);
        const weight = Number(part.weight);
        const score = part.score === null || part.score === "" || typeof part.score === "undefined" ? null : Number(part.score);
        if (!Number.isFinite(weight) || weight < 0 || weight > 100 || !Number.isFinite(total) || total <= 0) throw new Error(`A grading component in “${raw.name}” has an invalid weight or total.`);
        if (score !== null && (!Number.isFinite(score) || score < 0 || score > total)) throw new Error(`A score in “${raw.name}” must be between zero and its total possible score.`);
        return { id: String(part.id || GT.id("component")), name: String(part.name || `Component ${componentIndex + 1}`).slice(0, 60), weight, total, score };
      });
      const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
      if (Math.abs(totalWeight - 100) >= 0.001) throw new Error(`Weights for “${raw.name}” must total 100%.`);
      const passingGrade = Number(raw.passingGrade ?? raw.pass ?? bundle.settings?.passingGrade ?? GT.defaults.passingGrade);
      const targetGrade = Number(raw.targetGrade ?? raw.target ?? bundle.settings?.targetGrade ?? GT.defaults.targetGrade);
      if (![passingGrade, targetGrade].every((value) => Number.isFinite(value) && value >= 0 && value <= 100)) throw new Error(`“${raw.name}” has an invalid passing or target grade.`);
      return {
        id: String(raw.id || GT.id("subject")), name: raw.name.trim().slice(0, 70), code: String(raw.code || "").trim().slice(0, 24),
        passingGrade, targetGrade, components, colorIndex: Math.floor(Math.abs(Number(raw.colorIndex) || index) % 4)
      };
    });
    const rawSettings = bundle.settings && typeof bundle.settings === "object" ? bundle.settings : {};
    const passingGrade = Number(rawSettings.passingGrade ?? GT.defaults.passingGrade);
    const targetGrade = Number(rawSettings.targetGrade ?? GT.defaults.targetGrade);
    const scaleTop = Number(rawSettings.scaleTop ?? GT.defaults.scaleTop);
    const scaleBottom = Number(rawSettings.scaleBottom ?? GT.defaults.scaleBottom);
    if (![passingGrade, targetGrade].every((value) => Number.isFinite(value) && value >= 0 && value <= 100) || !Number.isFinite(scaleTop) || !Number.isFinite(scaleBottom) || (rawSettings.display === "custom" && scaleTop === scaleBottom)) {
      throw new Error("This backup contains invalid grading preferences.");
    }
    const history = (Array.isArray(bundle.history) ? bundle.history : []).slice(0, 250).map((item) => ({
      id: String(item.id || GT.id("history")), subjectId: String(item.subjectId || ""), subjectName: String(item.subjectName || "Subject").slice(0, 70),
      previous: item.previous === null || typeof item.previous === "undefined" ? null : Number(item.previous),
      current: item.current === null || typeof item.current === "undefined" ? null : Number(item.current),
      kind: String(item.kind || "updated"), date: Number.isFinite(Date.parse(item.date)) ? new Date(item.date).toISOString() : new Date().toISOString()
    }));
    return {
      version: 1,
      settings: {
        passingGrade, targetGrade, display: rawSettings.display === "custom" ? "custom" : "percent", scaleTop, scaleBottom
      },
      subjects,
      history: history.filter((item) => (item.previous === null || Number.isFinite(item.previous)) && (item.current === null || Number.isFinite(item.current)))
    };
  }

  document.getElementById("mainNav").addEventListener("click", (event) => {
    const item = event.target.closest("[data-page]");
    if (item) GT.navigate(item.dataset.page);
  });
  document.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => GT.navigate(button.dataset.go)));
  document.getElementById("menuToggle").addEventListener("click", () => setMobileMenu(!sidebar.classList.contains("is-open")));
  scrim.addEventListener("click", () => setMobileMenu(false));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") setMobileMenu(false); });
  document.getElementById("printButton").addEventListener("click", () => window.print());
  document.getElementById("footerYear").textContent = new Date().getFullYear();
  document.getElementById("todayLabel").textContent = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date());

  document.getElementById("settingDisplay").addEventListener("change", (event) => {
    document.getElementById("scaleFields").classList.toggle("is-visible", event.target.value === "custom");
  });
  document.getElementById("settingsForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const passingGrade = Number(document.getElementById("settingPass").value);
    const targetGrade = Number(document.getElementById("settingTarget").value);
    const display = document.getElementById("settingDisplay").value;
    const scaleTop = Number(document.getElementById("settingScaleTop").value);
    const scaleBottom = Number(document.getElementById("settingScaleBottom").value);
    if (![passingGrade, targetGrade].every((value) => Number.isFinite(value) && value >= 0 && value <= 100)) {
      GT.toast("Passing and target grades must be between 0 and 100.", "warning"); return;
    }
    if (display === "custom" && (!Number.isFinite(scaleTop) || !Number.isFinite(scaleBottom) || scaleTop === scaleBottom)) {
      GT.toast("Enter two different numeric scale endpoints.", "warning"); return;
    }
    GT.state.settings = { passingGrade, targetGrade, display, scaleTop, scaleBottom };
    const stored = GT.save();
    document.getElementById("settingsSaved").textContent = stored ? "Preferences saved" : "Could not save preferences";
    window.setTimeout(() => { document.getElementById("settingsSaved").textContent = ""; }, 2800);
    GT.renderAll();
    GT.toast(stored ? "Your grading preferences are saved." : "Preferences updated for this session, but your browser could not save them.", stored ? "success" : "warning");
  });

  document.getElementById("exportBackupBtn").addEventListener("click", exportBackup);
  document.getElementById("importBackupBtn").addEventListener("click", () => document.getElementById("backupFile").click());
  document.getElementById("backupFile").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const imported = normalizeImport(payload);
      if (!window.confirm(`Replace this workspace with ${imported.subjects.length} imported subject${imported.subjects.length === 1 ? "" : "s"}?`)) return;
      GT.state = imported;
      const stored = GT.save();
      renderSettings();
      GT.renderAll();
      GT.toast(stored ? "Backup restored successfully." : "Backup loaded for this session, but your browser could not save it.", stored ? "success" : "warning");
    } catch (error) {
      GT.toast(error instanceof SyntaxError ? "That file is not valid JSON." : error.message || "Could not read this GradeTrack backup.", "warning");
    } finally {
      event.target.value = "";
    }
  });
  document.getElementById("clearDataBtn").addEventListener("click", () => {
    if (!window.confirm("Clear every GradeTrack subject, preference, and history entry saved in this browser? This cannot be undone unless you have a backup.")) return;
    try {
      localStorage.removeItem(GT.key);
      localStorage.removeItem("gradetrack.v1");
      window.location.reload();
    } catch (_) {
      GT.toast("The browser did not allow local data to be cleared.", "warning");
    }
  });

  renderSettings();
  GT.renderAll();
})();
