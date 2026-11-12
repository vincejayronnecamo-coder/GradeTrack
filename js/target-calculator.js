(function () {
  "use strict";
  const GT = window.GradeTrack;
  const subjectSelect = document.getElementById("targetSubject");
  const targetInput = document.getElementById("targetGradeInput");
  const output = document.getElementById("targetResult");

  function selectedSubject(preferredId) {
    const previous = preferredId || subjectSelect.value;
    const subjects = GT.state.subjects;
    const id = subjects.some((subject) => subject.id === previous) ? previous : subjects[0]?.id;
    subjectSelect.innerHTML = subjects.length
      ? subjects.map((subject) => `<option value="${GT.escape(subject.id)}" ${subject.id === id ? "selected" : ""}>${GT.escape(subject.name)}${subject.code ? " · " + GT.escape(subject.code) : ""}</option>`).join("")
      : `<option value="">Add a subject first</option>`;
    subjectSelect.disabled = !subjects.length;
    return subjects.find((subject) => subject.id === id) || null;
  }

  GT.renderTargetPlanner = function (preferredId) {
    const subject = selectedSubject(preferredId);
    if (!subject) {
      targetInput.value = GT.state.settings.targetGrade;
      targetInput.disabled = true;
      document.getElementById("calculateTargetBtn").disabled = true;
      output.innerHTML = `<div class="result-placeholder"><span class="result-orbit">◎</span><h3>Add a subject to make a plan</h3><p>Your remaining assessments will appear here.</p><button class="button button-primary" data-create-subject>Add a subject</button></div>`;
      return;
    }
    targetInput.disabled = false;
    document.getElementById("calculateTargetBtn").disabled = false;
    targetInput.value = subject.targetGrade ?? GT.state.settings.targetGrade;
  };

  function calculateTarget() {
    const subject = GT.state.subjects.find((item) => item.id === subjectSelect.value);
    if (!subject) { GT.toast("Add a subject before calculating a target.", "warning"); return; }
    const desired = targetInput.value.trim() === "" ? NaN : Number(targetInput.value);
    if (!Number.isFinite(desired) || desired < 0 || desired > 100) {
      targetInput.setAttribute("aria-invalid", "true");
      targetInput.focus();
      GT.toast("Enter a target between 0% and 100%.", "warning");
      return;
    }
    targetInput.removeAttribute("aria-invalid");
    const calc = GT.calculate(subject);
    const required = GT.requiredAverage(subject, desired);
    const remaining = subject.components.filter((component) => (Number(component.weight) || 0) > 0 && (component.score === null || component.score === ""));
    let message;
    let messageClass = "";
    let main;
    let subtitle;
    if (calc.isComplete) {
      const achieved = calc.finalGrade >= desired;
      main = achieved ? "Target reached" : "No assessments remaining";
      subtitle = achieved ? "You have already reached this target." : "Your final grade is already set for this subject.";
      message = achieved
        ? `Your final grade is ${GT.formatGrade(calc.finalGrade)}, which meets your ${GT.round(desired, 1)}% target.`
        : `Your final grade is ${GT.formatGrade(calc.finalGrade)}. The target was ${GT.round(desired, 1)}%.`;
      messageClass = achieved ? "is-success" : "is-warning";
    } else if (required === null || calc.remainingWeight <= 0) {
      main = "Target unavailable";
      subtitle = "Check this subject’s grading component weights.";
      message = "The remaining grading weights need to total more than zero.";
      messageClass = "is-warning";
    } else if (required <= 0) {
      main = "Target already secured";
      subtitle = "Your completed work has already earned enough weighted points.";
      message = `Your completed scores have secured the ${GT.round(desired, 1)}% target. Keep completing the remaining assessments.`;
      messageClass = "is-success";
    } else if (required > 100.000001) {
      main = "This target is out of reach";
      subtitle = "Even a perfect score on every remaining component would not be enough.";
      message = `The best possible final grade is ${GT.formatGrade(calc.earnedPoints + calc.remainingWeight)}. Your target is ${GT.round(desired, 1)}%.`;
      messageClass = "is-warning";
    } else {
      const roundedRequired = Math.ceil(required * 10 - 0.0000001) / 10;
      main = "You need at least";
      subtitle = "average across your remaining weighted assessments";
      message = `Aim for at least ${roundedRequired.toFixed(1)}% on the remaining components to reach your ${GT.round(desired, 1)}% target.`;
      messageClass = roundedRequired >= 90 ? "is-warning" : "";
    }
    const remainingText = remaining.length
      ? remaining.map((component) => `<span>${GT.escape(component.name)} <strong>${GT.round(component.weight, 1)}%</strong></span>`).join("")
      : `<span>No remaining assessments <strong>—</strong></span>`;
    const needDisplay = calc.isComplete ? "✓" : required <= 0 ? "0" : required > 100.000001 ? "100%+" : (Math.ceil(required * 10 - 0.0000001) / 10).toFixed(1);
    const needCaption = calc.isComplete ? (calc.finalGrade >= desired ? "Goal met" : "Complete") : required > 100.000001 ? "needed" : "% needed";
    output.innerHTML = `<div class="result-content"><span class="result-kicker">YOUR TARGET PLAN</span><h3>${GT.escape(main)}</h3><div class="result-needed">${needDisplay}<small>${needCaption}</small></div><div class="result-subtitle">${GT.escape(subtitle)}</div><div class="result-current"><span>Current performance<strong>${GT.formatGrade(calc.average)}</strong></span><span>Target grade<strong>${GT.round(desired, 1)}%</strong></span><span>Remaining weight<strong>${GT.round(calc.remainingWeight, 1)}%</strong></span></div><div class="remaining-list">${remainingText}</div><p class="result-message ${messageClass}">${GT.escape(message)}</p></div>`;
  }

  subjectSelect.addEventListener("change", () => {
    const subject = GT.state.subjects.find((item) => item.id === subjectSelect.value);
    if (subject) targetInput.value = subject.targetGrade ?? GT.state.settings.targetGrade;
    output.innerHTML = `<div class="result-placeholder"><span class="result-orbit">◎</span><h3>Ready when you are</h3><p>Calculate the remaining scores for ${GT.escape(subject?.name || "this subject")}.</p></div>`;
  });
  document.getElementById("calculateTargetBtn").addEventListener("click", calculateTarget);
  targetInput.addEventListener("input", () => targetInput.removeAttribute("aria-invalid"));
  output.addEventListener("click", (event) => {
    if (event.target.closest("[data-create-subject]")) GT.openSubjectDialog();
  });
})();
