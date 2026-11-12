(function () {
  "use strict";
  const GT = window.GradeTrack;

  GT.calculate = function (subject) {
    const components = Array.isArray(subject?.components) ? subject.components : [];
    let earnedPoints = 0;
    let completedWeight = 0;
    let completedCount = 0;
    let weightedCount = 0;
    let totalWeight = 0;
    for (const component of components) {
      const weight = Number.isFinite(+component.weight) ? Math.max(0, +component.weight) : 0;
      totalWeight += weight;
      if (weight > 0) weightedCount += 1;
      if (component.score === null || component.score === "" || !Number.isFinite(+component.score)) continue;
      const total = Number(component.total);
      const score = Number(component.score);
      if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(score)) continue;
      const boundedScore = GT.clamp(score, 0, total);
      completedCount += 1;
      if (weight > 0) {
        earnedPoints += (boundedScore / total) * weight;
        completedWeight += weight;
      }
    }
    const remainingWeight = Math.max(0, totalWeight - completedWeight);
    const average = completedWeight > 0 ? (earnedPoints / completedWeight) * 100 : null;
    const isComplete = weightedCount > 0 && remainingWeight < 0.001;
    const finalGrade = isComplete ? (earnedPoints / totalWeight) * 100 : null;
    const projected = average === null ? null : isComplete ? finalGrade : earnedPoints + remainingWeight * (average / 100);
    return {
      earnedPoints, completedWeight, remainingWeight, totalWeight,
      completedCount, weightedCount, average, finalGrade, projected,
      completion: totalWeight > 0 ? GT.clamp((completedWeight / totalWeight) * 100, 0, 100) : 0,
      isComplete
    };
  };

  GT.requiredAverage = function (subject, target) {
    const calc = GT.calculate(subject);
    const desired = Number(target);
    if (!Number.isFinite(desired) || !Number.isFinite(calc.totalWeight) || calc.totalWeight <= 0) return null;
    const neededPoints = desired * calc.totalWeight / 100 - calc.earnedPoints;
    if (calc.remainingWeight < 0.001) return neededPoints <= 0.001 ? 0 : Infinity;
    return (neededPoints / calc.remainingWeight) * 100;
  };

  GT.overallAverage = function () {
    const grades = GT.state.subjects.map((subject) => GT.calculate(subject).average).filter((grade) => grade !== null);
    return grades.length ? grades.reduce((sum, grade) => sum + grade, 0) / grades.length : null;
  };

  GT.passedSubjects = function () {
    return GT.state.subjects.filter((subject) => {
      const calc = GT.calculate(subject);
      return calc.isComplete && calc.finalGrade >= subject.passingGrade;
    }).length;
  };

  GT.riskSubjects = function () {
    return GT.state.subjects.filter((subject) => GT.status(subject, GT.calculate(subject).average).key === "risk").length;
  };

  function subjectOptions(select, preferredId) {
    if (!select) return null;
    const subjects = GT.state.subjects;
    const selectedId = subjects.some((subject) => subject.id === preferredId) ? preferredId : subjects[0]?.id;
    select.innerHTML = subjects.length
      ? subjects.map((subject) => `<option value="${GT.escape(subject.id)}" ${subject.id === selectedId ? "selected" : ""}>${GT.escape(subject.name)}${subject.code ? " · " + GT.escape(subject.code) : ""}</option>`).join("")
      : `<option value="">Add a subject first</option>`;
    select.disabled = subjects.length === 0;
    return subjects.find((subject) => subject.id === selectedId) || null;
  }

  function summaryHTML(subject, calc) {
    const grade = calc.average;
    const status = GT.status(subject, grade);
    const primary = grade === null ? "—" : GT.formatGrade(grade);
    const finalLine = calc.isComplete
      ? GT.formatGrade(calc.finalGrade)
      : calc.projected === null ? "Add a score" : GT.formatGrade(calc.projected);
    const label = calc.isComplete ? "Final grade" : "Projected final*";
    return `<div class="summary-label">CURRENT COMPLETED-WORK GRADE</div>
      <div class="summary-grade">${primary}</div>
      <div class="summary-subtext">${grade === null ? "Enter an assessment score to begin." : status.label + " · Passing grade " + GT.round(subject.passingGrade, 1) + "%"}</div>
      <div class="summary-divider"></div>
      <div class="summary-detail"><span>Weight completed</span><strong>${GT.round(calc.completedWeight, 1)}%</strong></div>
      <div class="summary-detail"><span>Weighted points earned</span><strong>${GT.round(calc.earnedPoints, 1)} / ${GT.round(calc.totalWeight, 1)}</strong></div>
      <div class="summary-detail"><span>${label}</span><strong>${finalLine}</strong></div>
      <div class="summary-detail"><span>Assessments scored</span><strong>${calc.completedCount} / ${subject.components.length}</strong></div>
      ${calc.isComplete ? "" : `<div class="summary-subtext">*Projection assumes your current average continues.</div>`}`;
  }

  GT.renderCalculatorSummary = function (subject) {
    const host = document.getElementById("calculatorSummary");
    if (!subject) {
      host.innerHTML = `<div class="summary-label">GRADE SUMMARY</div><div class="summary-grade">—</div><div class="summary-subtext">Add a subject to calculate your grades.</div>`;
      return;
    }
    host.innerHTML = summaryHTML(subject, GT.calculate(subject));
  };

  GT.renderCalculator = function (preferredId) {
    const select = document.getElementById("calculatorSubject");
    const subject = subjectOptions(select, preferredId || select.value);
    const host = document.getElementById("calculatorContent");
    if (!subject) {
      host.innerHTML = `<div class="empty-state" style="margin-top:16px"><span class="empty-illustration">∑</span><strong>No subjects to calculate yet</strong><p>Add a subject and its grading components first.</p><button class="button button-primary" data-create-subject>Add a subject</button></div>`;
      GT.renderCalculatorSummary(null);
      return;
    }
    host.innerHTML = `<div class="calculator-list">${subject.components.map((component) => {
      const componentGrade = component.score === null ? null : GT.round((component.score / component.total) * 100, 1);
      const weighted = component.score === null ? null : (component.score / component.total) * component.weight;
      return `<div class="calculator-row" data-component-id="${GT.escape(component.id)}">
        <div class="calculator-component"><strong>${GT.escape(component.name)}</strong><small>${GT.round(component.weight, 1)}% of final grade · ${component.score === null ? "Not graded" : GT.round(componentGrade, 1) + "% score"}</small></div>
        <label class="calculator-score"><span class="sr-only">${GT.escape(component.name)} score out of ${GT.escape(component.total)}</span><input type="number" min="0" max="${GT.escape(component.total)}" step="any" value="${component.score === null ? "" : GT.escape(component.score)}" placeholder="—" data-score-input aria-label="${GT.escape(component.name)} score"><span>/ ${GT.escape(component.total)}</span></label>
        <div class="calculator-earned ${weighted === null ? "is-pending" : ""}" data-earned>${weighted === null ? "Pending" : GT.round(weighted, 2) + " pts"}</div>
      </div>`;
    }).join("")}</div><div class="calculator-help">Enter a score from 0 to the assessment total. Scores save when you leave the field.</div>`;
    GT.renderCalculatorSummary(subject);
  };

  const selector = document.getElementById("calculatorSubject");
  selector.addEventListener("change", () => GT.renderCalculator(selector.value));
  document.getElementById("calculatorContent").addEventListener("click", (event) => {
    if (event.target.closest("[data-create-subject]")) GT.openSubjectDialog();
  });
  document.getElementById("calculatorContent").addEventListener("input", (event) => {
    const input = event.target.closest("[data-score-input]");
    if (!input) return;
    const subject = GT.state.subjects.find((item) => item.id === selector.value);
    const component = subject?.components.find((item) => item.id === input.closest(".calculator-row").dataset.componentId);
    if (!component) return;
    const value = input.value === "" ? null : Number(input.value);
    const earned = input.closest(".calculator-row").querySelector("[data-earned]");
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > component.total)) {
      input.setAttribute("aria-invalid", "true");
      earned.textContent = "Check score";
      earned.classList.add("is-pending");
      return;
    }
    input.removeAttribute("aria-invalid");
    const preview = { ...subject, components: subject.components.map((item) => item.id === component.id ? { ...item, score: value } : item) };
    const previewComponent = preview.components.find((item) => item.id === component.id);
    const weighted = value === null ? null : value / component.total * component.weight;
    earned.textContent = weighted === null ? "Pending" : GT.round(weighted, 2) + " pts";
    earned.classList.toggle("is-pending", weighted === null);
    const row = input.closest(".calculator-row");
    const small = row.querySelector(".calculator-component small");
    small.textContent = GT.round(component.weight, 1) + "% of final grade · " + (value === null ? "Not graded" : GT.round(value / component.total * 100, 1) + "% score");
    GT.renderCalculatorSummary(preview);
  });
  document.getElementById("calculatorContent").addEventListener("change", (event) => {
    const input = event.target.closest("[data-score-input]");
    if (!input || input.getAttribute("aria-invalid") === "true") return;
    const subject = GT.state.subjects.find((item) => item.id === selector.value);
    const component = subject?.components.find((item) => item.id === input.closest(".calculator-row").dataset.componentId);
    if (!component) return;
    const value = input.value === "" ? null : Number(input.value);
    if (value === component.score) return;
    const previous = GT.calculate(subject).average;
    component.score = value;
    const current = GT.calculate(subject).average;
    GT.addHistory(subject, previous, current, "score");
    const stored = GT.save();
    GT.renderAll({ calculatorSubject: subject.id });
    const status = GT.status(subject, current);
    GT.toast(status.key === "risk" ? `${subject.name} is at risk. The passing target may no longer be reachable.` : stored ? "Score saved. Your grade has been updated." : "Score updated for this session, but your browser could not save it.", status.key === "risk" || !stored ? "warning" : "success");
  });
})();
