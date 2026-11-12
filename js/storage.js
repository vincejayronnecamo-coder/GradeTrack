(function () {
  "use strict";

  const KEY = "gradetrack.workspace.v1";
  const LEGACY_KEY = "gradetrack.v1";
  const defaults = { passingGrade: 75, targetGrade: 85, excellentGrade: 90, goodGrade: 80, display: "percent", scaleTop: 1, scaleBottom: 5 };

  function id(prefix) {
    const value = globalThis.crypto && typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
    return (prefix || "id") + "-" + value;
  }

  function validNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeComponent(raw, index) {
    const component = raw && typeof raw === "object" ? raw : {};
    const total = Math.max(0.01, validNumber(component.total, 100));
    const rawScore = component.score;
    let score = rawScore === null || rawScore === "" || typeof rawScore === "undefined" ? null : validNumber(rawScore, null);
    if (score !== null) score = Math.min(total, Math.max(0, score));
    return {
      id: String(component.id || id("component")),
      name: String(component.name || "Component " + (index + 1)).slice(0, 60),
      weight: Math.min(100, Math.max(0, validNumber(component.weight, 0))),
      score,
      total
    };
  }

  function normalizeSubject(raw, index) {
    if (!raw || typeof raw !== "object") return null;
    let components = Array.isArray(raw.components) ? raw.components : Array.isArray(raw.parts) ? raw.parts.map((part) => ({
      id: part.id, name: part.name, weight: part.weight, score: part.score, total: 100
    })) : [];
    components = components.map(normalizeComponent);
    return {
      id: String(raw.id || id("subject")),
      name: String(raw.name || "Untitled subject").trim().slice(0, 70),
      code: String(raw.code || "").trim().slice(0, 24),
      passingGrade: Math.min(100, Math.max(0, validNumber(raw.passingGrade ?? raw.pass, defaults.passingGrade))),
      targetGrade: Math.min(100, Math.max(0, validNumber(raw.targetGrade ?? raw.target, defaults.targetGrade))),
      components,
      colorIndex: Math.abs(validNumber(raw.colorIndex, index)) % 4
    };
  }

  function normalizeHistory(item) {
    if (!item || typeof item !== "object") return null;
    return {
      id: String(item.id || id("history")),
      subjectId: String(item.subjectId || ""),
      subjectName: String(item.subjectName || "Subject").slice(0, 70),
      previous: item.previous === null || typeof item.previous === "undefined" ? null : validNumber(item.previous, null),
      current: item.current === null || typeof item.current === "undefined" ? null : validNumber(item.current, null),
      kind: String(item.kind || "updated"),
      date: Number.isFinite(Date.parse(item.date)) ? new Date(item.date).toISOString() : new Date().toISOString()
    };
  }

  function normalizeState(raw) {
    const value = raw && typeof raw === "object" ? raw : {};
    const settings = value.settings && typeof value.settings === "object" ? value.settings : {};
    return {
      version: 1,
      settings: {
        passingGrade: Math.min(100, Math.max(0, validNumber(settings.passingGrade, defaults.passingGrade))),
        targetGrade: Math.min(100, Math.max(0, validNumber(settings.targetGrade, defaults.targetGrade))),
        excellentGrade: Math.min(100, Math.max(0, validNumber(settings.excellentGrade, defaults.excellentGrade))),
        goodGrade: Math.min(100, Math.max(0, validNumber(settings.goodGrade, defaults.goodGrade))),
        display: settings.display === "custom" ? "custom" : "percent",
        scaleTop: validNumber(settings.scaleTop, defaults.scaleTop),
        scaleBottom: validNumber(settings.scaleBottom, defaults.scaleBottom)
      },
      subjects: (Array.isArray(value.subjects) ? value.subjects : []).map(normalizeSubject).filter(Boolean),
      history: (Array.isArray(value.history) ? value.history : []).map(normalizeHistory).filter(Boolean).slice(0, 250)
    };
  }

  function readSaved() {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) return normalizeState(JSON.parse(saved));
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const migrated = normalizeState({ subjects: JSON.parse(legacy) });
        try { localStorage.setItem(KEY, JSON.stringify(migrated)); } catch (_) { /* Keep migrated data available for this session. */ }
        return migrated;
      }
    } catch (_) {
      return normalizeState(null);
    }
    return normalizeState(null);
  }

  const GT = window.GradeTrack = {
    key: KEY,
    defaults,
    state: readSaved(),
    id,
    clamp(value, min, max) { return Math.min(max, Math.max(min, value)); },
    escape(value) {
      return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
      })[character]);
    },
    round(value, places) {
      const scale = 10 ** (places ?? 1);
      return Math.round((value + Number.EPSILON) * scale) / scale;
    },
    save() {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.state));
        return true;
      } catch (_) {
        return false;
      }
    },
    addHistory(subject, previous, current, kind) {
      this.state.history.unshift({
        id: id("history"), subjectId: subject.id, subjectName: subject.name,
        previous: previous === null || !Number.isFinite(previous) ? null : this.round(previous, 2),
        current: current === null || !Number.isFinite(current) ? null : this.round(current, 2),
        kind: kind || "updated", date: new Date().toISOString()
      });
      this.state.history = this.state.history.slice(0, 250);
    },
    formatGrade(value, precision) {
      if (!Number.isFinite(value)) return "—";
      if (this.state.settings.display !== "custom") return this.round(value, precision ?? 1).toFixed(precision ?? 1) + "%";
      const top = this.state.settings.scaleTop;
      const bottom = this.state.settings.scaleBottom;
      const equivalent = bottom + (top - bottom) * value / 100;
      return this.round(equivalent, 2).toFixed(2) + " eq.";
    },
    date(value, withTime) {
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) return "—";
      const options = { year: "numeric", month: "short", day: "numeric" };
      if (withTime) { options.hour = "numeric"; options.minute = "2-digit"; }
      return new Intl.DateTimeFormat(undefined, options).format(date);
    },
    status(subject, grade) {
      const calc = this.calculate(subject);
      if (calc.completedWeight >= calc.totalWeight - 0.001 && calc.completedWeight > 0) {
        if (grade < subject.passingGrade) return { label: "At risk", key: "risk" };
        if (grade >= this.state.settings.excellentGrade) return { label: "Excellent", key: "excellent" };
        if (grade >= this.state.settings.goodGrade) return { label: "Good", key: "good" };
        if (grade >= subject.passingGrade) return { label: "Satisfactory", key: "satisfactory" };
        return { label: "At risk", key: "risk" };
      }
      if (calc.completedWeight > 0 && this.requiredAverage(subject, subject.passingGrade) > 100.0001) {
        return { label: "At risk", key: "risk" };
      }
      if (calc.average !== null && calc.average >= this.state.settings.excellentGrade) return { label: "Excellent", key: "excellent" };
      if (calc.average !== null && calc.average >= this.state.settings.goodGrade) return { label: "Good", key: "good" };
      if (calc.average !== null && calc.average >= subject.passingGrade) return { label: "On track", key: "satisfactory" };
      return { label: calc.average === null ? "No scores yet" : "In progress", key: "ungraded" };
    }
  };
})();
