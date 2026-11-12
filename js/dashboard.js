(function () {
  "use strict";
  const GT = window.GradeTrack;

  function average(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }

  GT.renderDashboard = function () {
    const subjects = GT.state.subjects;
    const avg = GT.overallAverage();
    const passed = GT.passedSubjects();
    const risks = GT.riskSubjects();
    document.getElementById("dashSubjectCount").textContent = subjects.length;
    document.getElementById("dashAverage").textContent = GT.formatGrade(avg);
    document.getElementById("dashPassed").textContent = passed;
    document.getElementById("dashRisk").textContent = risks;
    document.getElementById("dashSubjectFoot").textContent = subjects.length ? subjects.length + (subjects.length === 1 ? " course in your workspace" : " courses in your workspace") : "Start by adding a subject";
    document.getElementById("dashPassedFoot").textContent = "Fully graded subjects above passing";
    document.getElementById("dashRiskFoot").textContent = risks ? "Review scores and remaining targets" : "No subjects currently at risk";

    const chart = document.getElementById("subjectChart");
    if (!subjects.length) {
      chart.innerHTML = `<div class="chart-empty"><strong>Your chart will grow with you</strong>Add a subject and enter a score to see your progress.</div>`;
    } else {
      chart.innerHTML = subjects.slice(0, 6).map((subject) => {
        const grade = GT.calculate(subject).average;
        const width = grade === null ? 0 : GT.clamp(grade, 0, 100);
        const risk = GT.status(subject, grade).key === "risk";
        return `<div class="chart-row"><span class="chart-row-name" title="${GT.escape(subject.name)}">${GT.escape(subject.name)}</span><div class="chart-track" aria-label="${grade === null ? "No scores" : GT.round(grade, 1) + " percent"}"><div class="chart-fill ${risk ? "is-risk" : ""}" style="width:${width}%"></div></div><span class="chart-value">${grade === null ? "—" : GT.round(grade, 1) + "%"}</span></div>`;
      }).join("") + (subjects.length > 6 ? `<div class="chart-empty">+ ${subjects.length - 6} more subjects in Performance</div>` : "");
    }

    const distribution = document.getElementById("distributionChart");
    const grades = subjects.map((subject) => ({ subject, grade: GT.calculate(subject).average })).filter((entry) => entry.grade !== null);
    if (!grades.length) {
      distribution.innerHTML = `<div class="chart-empty" style="min-height:100%;width:100%">Add scores to see your grade distribution.</div>`;
    } else {
      const buckets = [
        { key: "excellent", label: "90+", count: grades.filter((x) => x.grade >= 90).length },
        { key: "good", label: "80–89", count: grades.filter((x) => x.grade >= 80 && x.grade < 90 && x.grade >= x.subject.passingGrade).length },
        { key: "satisfactory", label: "Pass–79", count: grades.filter((x) => x.grade >= x.subject.passingGrade && x.grade < 80).length },
        { key: "risk", label: "Below pass", count: grades.filter((x) => x.grade < x.subject.passingGrade || (x.grade >= 80 && x.grade < 90 && x.grade < x.subject.passingGrade)).length }
      ];
      const max = Math.max(1, ...buckets.map((item) => item.count));
      distribution.innerHTML = buckets.map((bucket) => {
        const height = bucket.count ? Math.max(12, bucket.count / max * 78) : 4;
        return `<div class="distribution-column"><div class="distribution-bar ${bucket.key}" style="height:${height}%" title="${bucket.count} subject${bucket.count === 1 ? "" : "s"}">${bucket.count || ""}</div><span class="distribution-label">${bucket.label}</span></div>`;
      }).join("");
    }

    const activity = document.getElementById("recentActivity");
    const recent = [...GT.state.history].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 4);
    if (!recent.length) {
      activity.innerHTML = `<div class="activity-empty">No updates yet. Add a subject or record a score to start your activity timeline.</div>`;
    } else {
      activity.innerHTML = recent.map((item) => {
        const labels = { added: "Subject added", updated: "Subject details updated", score: "Assessment score updated", deleted: "Subject removed" };
        const value = item.current === null ? "Saved" : GT.formatGrade(item.current);
        return `<div class="activity-item"><span class="activity-mark">${item.kind === "deleted" ? "−" : item.kind === "added" ? "+" : "↗"}</span><div class="activity-copy"><strong>${GT.escape(item.subjectName)} · ${labels[item.kind] || "Grade updated"}</strong><span>${GT.date(item.date, true)}</span></div><span class="activity-grade">${value}</span></div>`;
      }).join("");
    }

    const completed = subjects.filter((subject) => GT.calculate(subject).isComplete).length;
    const progress = average(subjects.map((subject) => GT.calculate(subject).completion)) || 0;
    const progressHost = document.getElementById("academicProgress");
    progressHost.innerHTML = `<div class="progress-line"><span>Assessment coverage</span><strong>${GT.round(progress, 0)}%</strong></div><div class="progress-track"><span style="width:${progress}%"></span></div><div class="progress-line"><span>Subjects fully graded</span><strong>${completed} of ${subjects.length}</strong></div><div class="progress-track"><span style="width:${subjects.length ? completed / subjects.length * 100 : 0}%"></span></div><div class="progress-footnote">Coverage shows how much assessment weight has been graded across your subjects.</div>`;
  };
})();
