(function () {
  "use strict";
  const GT = window.GradeTrack;

  GT.renderPerformance = function () {
    const subjects = GT.state.subjects;
    const average = GT.overallAverage();
    const complete = subjects.filter((subject) => GT.calculate(subject).isComplete).length;
    const risks = GT.riskSubjects();
    document.getElementById("performanceOverview").innerHTML = `
      <article class="performance-metric"><span>Current average</span><strong>${GT.formatGrade(average)}</strong></article>
      <article class="performance-metric"><span>Fully graded</span><strong>${complete} <small style="font:500 10px 'Segoe UI',Arial,sans-serif;color:#98a1b1">of ${subjects.length}</small></strong></article>
      <article class="performance-metric"><span>Subjects at risk</span><strong>${risks}</strong></article>`;

    const list = document.getElementById("performanceSubjects");
    if (!subjects.length) {
      list.innerHTML = `<div class="chart-empty"><strong>Your progress appears here</strong>Add a subject and enter scores to start tracking.</div>`;
    } else {
      list.innerHTML = `<div class="performance-subject-list">${subjects.map((subject) => {
        const calc = GT.calculate(subject);
        const status = GT.status(subject, calc.average);
        return `<div class="performance-subject-row"><span title="${GT.escape(subject.name)}">${GT.escape(subject.name)}</span><div class="progress-track" title="${GT.round(calc.completion, 1)}% of assessment weight graded"><span style="width:${calc.completion}%"></span></div><strong>${calc.average === null ? "—" : GT.round(calc.average, 1) + "%"}</strong><span class="status-pill status-${status.key}">${status.label}</span></div>`;
      }).join("")}</div>`;
    }

    const trend = document.getElementById("trendChart");
    const points = GT.state.history.filter((item) => item.current !== null && Number.isFinite(item.current)).slice(0, 8).reverse();
    if (!points.length) {
      trend.innerHTML = `<div class="trend-empty">Your grade changes will form a trend as you update scores.</div>`;
    } else {
      trend.innerHTML = `<div class="trend-chart">${points.map((point) => {
        const percent = GT.clamp(point.current, 0, 100);
        return `<div class="trend-column" title="${GT.escape(point.subjectName)} · ${GT.round(point.current, 1)}% on ${GT.date(point.date)}"><span class="trend-value">${GT.round(point.current, 0)}%</span><div class="trend-bar" style="height:${Math.max(5, percent)}%"></div><span class="trend-date">${GT.date(point.date).replace(/,\s*\d{4}$/, "")}</span></div>`;
      }).join("")}</div>`;
    }
  };

  GT.renderHistory = function () {
    const entries = [...GT.state.history].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    const body = document.getElementById("historyRows");
    const empty = document.getElementById("historyEmpty");
    document.getElementById("historyCount").textContent = entries.length + (entries.length === 1 ? " update" : " updates");
    empty.hidden = entries.length > 0;
    body.innerHTML = entries.slice(0, 100).map((entry) => {
      const previous = entry.previous === null ? "—" : GT.formatGrade(entry.previous);
      const current = entry.current === null ? "—" : GT.formatGrade(entry.current);
      const change = entry.previous === null || entry.current === null ? null : entry.current - entry.previous;
      const shownChange = change === null ? null : GT.state.settings.display === "custom"
        ? (GT.state.settings.scaleTop - GT.state.settings.scaleBottom) * change / 100
        : change;
      const suffix = GT.state.settings.display === "custom" ? " eq." : " pp";
      const changeText = change === null ? entry.kind === "added" ? "New subject" : entry.kind === "deleted" ? "Removed" : "—" : (shownChange > 0 ? "+" : "") + GT.round(shownChange, GT.state.settings.display === "custom" ? 2 : 1) + suffix;
      const changeClass = change === null ? "neutral" : change > 0.001 ? "positive" : change < -0.001 ? "negative" : "neutral";
      return `<tr><td class="history-subject">${GT.escape(entry.subjectName)}</td><td>${previous}</td><td class="history-current">${current}</td><td class="history-change ${changeClass}">${changeText}</td><td>${GT.date(entry.date, true)}</td></tr>`;
    }).join("");
    body.closest(".history-table-wrap").hidden = entries.length === 0;
  };
})();
