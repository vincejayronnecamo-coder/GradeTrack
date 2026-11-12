(function () {
  "use strict";
  const GT = window.GradeTrack;
  const dialog = document.getElementById("subjectDialog");
  const form = document.getElementById("subjectForm");
  const editor = document.getElementById("componentEditorList");
  let editingId = null;
  let draft = [];

  const template = [
    ["Quizzes", 10], ["Assignments", 10], ["Laboratory", 10],
    ["Projects", 15], ["Midterm examination", 25], ["Final examination", 30]
  ];

  function defaultComponents() {
    return template.map(([name, weight]) => ({ id: GT.id("component"), name, weight, score: null, total: 100 }));
  }

  function collectDraft() {
    draft = Array.from(editor.querySelectorAll(".component-editor-row")).map((row) => ({
      id: row.dataset.componentId || GT.id("component"),
      name: row.querySelector("[data-field='name']").value.trim(),
      weight: row.querySelector("[data-field='weight']").value,
      total: row.querySelector("[data-field='total']").value,
      score: row.querySelector("[data-field='score']").value
    }));
  }

  function updateWeightTotal() {
    if (!editor) return;
    const total = Array.from(editor.querySelectorAll("[data-field='weight']"))
      .reduce((sum, input) => sum + (Number(input.value) || 0), 0);
    const output = document.getElementById("weightTotal");
    const valid = Math.abs(total - 100) < 0.001;
    output.className = "weight-total " + (valid ? "is-valid" : "is-invalid");
    output.textContent = "Total component weight: " + GT.round(total, 2) + "% " + (valid ? "✓" : "· must equal 100%");
  }

  function renderEditor() {
    editor.innerHTML = draft.map((component) => `
      <div class="component-editor-row" data-component-id="${GT.escape(component.id)}">
        <label class="form-field"><span>Component</span><input data-field="name" maxlength="60" value="${GT.escape(component.name)}" placeholder="e.g. Quizzes" required></label>
        <label class="form-field"><span>Weight %</span><input data-field="weight" type="number" min="0" max="100" step="0.1" value="${GT.escape(component.weight)}" required></label>
        <label class="form-field"><span>Score</span><input data-field="score" type="number" min="0" step="any" value="${component.score === null || component.score === "" ? "" : GT.escape(component.score)}" placeholder="—"></label>
        <label class="form-field"><span>Out of</span><input data-field="total" type="number" min="0.01" step="any" value="${GT.escape(component.total || 100)}" required></label>
        <button class="remove-component" type="button" data-remove-component="${GT.escape(component.id)}" aria-label="Remove ${GT.escape(component.name || "component")}" title="Remove component">×</button>
      </div>`).join("");
    updateWeightTotal();
  }

  GT.openSubjectDialog = function (subjectId) {
    editingId = subjectId || null;
    const subject = editingId ? GT.state.subjects.find((item) => item.id === editingId) : null;
    document.getElementById("subjectDialogTitle").textContent = subject ? "Edit subject" : "Add a subject";
    document.getElementById("subjectName").value = subject?.name || "";
    document.getElementById("subjectCode").value = subject?.code || "";
    document.getElementById("subjectPass").value = subject?.passingGrade ?? GT.state.settings.passingGrade;
    document.getElementById("subjectTarget").value = subject?.targetGrade ?? GT.state.settings.targetGrade;
    document.getElementById("subjectFormError").textContent = "";
    draft = subject ? subject.components.map((item) => ({ ...item })) : defaultComponents();
    renderEditor();
    if (!dialog.open) dialog.showModal();
    document.getElementById("subjectName").focus();
  };

  GT.renderSubjects = function () {
    const host = document.getElementById("subjectGrid");
    const subjects = GT.state.subjects;
    const results = document.getElementById("subjectResults");
    results.textContent = subjects.length + (subjects.length === 1 ? " subject" : " subjects");
    if (!subjects.length) {
      host.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span class="empty-illustration">▤</span><strong>Your subject list is ready</strong><p>Add your first subject, set its assessment weights, and start recording scores.</p><button class="button button-primary" data-create-subject>Add your first subject <span>→</span></button></div>`;
      return;
    }
    host.innerHTML = subjects.map((subject, index) => {
      const calc = GT.calculate(subject);
      const grade = calc.average;
      const status = GT.status(subject, grade);
      const componentRows = subject.components.slice(0, 4).map((component) => {
        const score = component.score === null ? "Not graded" : `${GT.round((component.score / component.total) * 100, 1)}% of ${GT.escape(component.weight)}%`;
        return `<div class="component-preview-row"><span>${GT.escape(component.name)}</span><strong>${score}</strong></div>`;
      }).join("");
      const more = subject.components.length > 4 ? `<div class="component-preview-row"><span>Additional components</span><strong>+${subject.components.length - 4}</strong></div>` : "";
      return `<article class="subject-card" style="animation-delay:${Math.min(index, 7) * 35}ms">
        <div class="subject-card-top"><div class="subject-identity"><span class="subject-monogram tone-${subject.colorIndex}">${GT.escape((subject.code || subject.name).slice(0, 2).toUpperCase())}</span><div class="subject-title"><h3 title="${GT.escape(subject.name)}">${GT.escape(subject.name)}</h3><p>${GT.escape(subject.code || "No course code")} · Pass ${GT.round(subject.passingGrade, 1)}%</p></div></div>
          <div class="subject-card-actions"><button class="icon-button" type="button" data-edit-subject="${GT.escape(subject.id)}" aria-label="Edit ${GT.escape(subject.name)}" title="Edit subject">✎</button><button class="icon-button" type="button" data-delete-subject="${GT.escape(subject.id)}" aria-label="Delete ${GT.escape(subject.name)}" title="Delete subject">⌫</button></div></div>
        <div class="subject-card-grade"><div><strong>${GT.formatGrade(grade)}</strong><small>${grade === null ? "No completed assessments" : calc.isComplete ? "Final grade" : "Current completed-work grade"}</small></div><span class="status-pill status-${status.key}">${status.label}</span></div>
        <div class="subject-progress"><div class="progress-track"><span style="width:${calc.completion}%"></span></div><div class="subject-meta"><span>${GT.round(calc.completedWeight, 1)}% of weight graded</span><span>Target ${GT.round(subject.targetGrade, 1)}%</span></div></div>
        <div class="component-preview">${componentRows}${more}</div>
        <div class="subject-card-footer"><button type="button" data-open-calculator="${GT.escape(subject.id)}">Enter grades <span>→</span></button><span class="subject-meta">${calc.completedCount}/${subject.components.length} scores in</span></div>
      </article>`;
    }).join("");
  };

  document.getElementById("addSubjectBtn").addEventListener("click", () => GT.openSubjectDialog());
  document.getElementById("closeSubjectDialog").addEventListener("click", () => dialog.close());
  document.getElementById("cancelSubjectDialog").addEventListener("click", () => dialog.close());
  document.getElementById("addComponentBtn").addEventListener("click", () => {
    collectDraft();
    draft.push({ id: GT.id("component"), name: "", weight: 0, score: null, total: 100 });
    renderEditor();
    const inputs = editor.querySelectorAll("[data-field='name']");
    inputs[inputs.length - 1]?.focus();
  });
  editor.addEventListener("input", updateWeightTotal);
  editor.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-component]");
    if (!button) return;
    collectDraft();
    if (draft.length <= 1) {
      GT.toast("A subject needs at least one grading component.", "warning");
      return;
    }
    draft = draft.filter((item) => item.id !== button.dataset.removeComponent);
    renderEditor();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    collectDraft();
    const error = document.getElementById("subjectFormError");
    const totalWeight = draft.reduce((sum, component) => sum + Number(component.weight || 0), 0);
    const name = document.getElementById("subjectName").value.trim();
    if (!name) { error.textContent = "Enter a subject name."; return; }
    if (!draft.length || Math.abs(totalWeight - 100) >= 0.001) { error.textContent = "Component weights must total exactly 100%. Adjust the weights before saving."; return; }
    const normalized = [];
    for (const component of draft) {
      const weight = Number(component.weight);
      const total = Number(component.total);
      const nameValue = String(component.name || "").trim();
      const rawScore = component.score;
      const score = rawScore === "" || rawScore === null || typeof rawScore === "undefined" ? null : Number(rawScore);
      if (!nameValue) { error.textContent = "Give every grading component a name."; return; }
      if (!Number.isFinite(weight) || weight < 0 || weight > 100 || !Number.isFinite(total) || total <= 0) { error.textContent = "Use valid component weights and a total possible score greater than zero."; return; }
      if (score !== null && (!Number.isFinite(score) || score < 0 || score > total)) { error.textContent = "A component score must be between zero and its total possible score."; return; }
      normalized.push({ id: component.id, name: nameValue.slice(0, 60), weight, total, score });
    }
    const passingGrade = Number(document.getElementById("subjectPass").value);
    const targetGrade = Number(document.getElementById("subjectTarget").value);
    if (!Number.isFinite(passingGrade) || passingGrade < 0 || passingGrade > 100 || !Number.isFinite(targetGrade) || targetGrade < 0 || targetGrade > 100) {
      error.textContent = "Passing and target grades must be between 0 and 100."; return;
    }
    const oldIndex = GT.state.subjects.findIndex((item) => item.id === editingId);
    const oldSubject = oldIndex < 0 ? null : GT.state.subjects[oldIndex];
    const previous = oldSubject ? GT.calculate(oldSubject).average : null;
    const subject = {
      id: oldSubject?.id || GT.id("subject"), name, code: document.getElementById("subjectCode").value.trim().slice(0, 24),
      passingGrade, targetGrade, components: normalized,
      colorIndex: oldSubject?.colorIndex ?? GT.state.subjects.length % 4
    };
    if (oldIndex < 0) GT.state.subjects.unshift(subject);
    else GT.state.subjects.splice(oldIndex, 1, subject);
    const current = GT.calculate(subject).average;
    GT.addHistory(subject, previous, current, oldSubject ? "updated" : "added");
    const stored = GT.save();
    dialog.close();
    GT.renderAll();
    const risk = GT.status(subject, current).key === "risk";
    GT.toast(risk ? `${subject.name} is at risk. Review the scores needed to pass.` : stored ? oldSubject ? "Subject updated and saved." : "Subject added to your workspace." : "Subject updated for this session, but your browser could not save it.", risk ? "warning" : stored ? "success" : "warning");
  });

  document.getElementById("subjectGrid").addEventListener("click", (event) => {
    if (event.target.closest("[data-create-subject]")) { GT.openSubjectDialog(); return; }
    const edit = event.target.closest("[data-edit-subject]");
    if (edit) { GT.openSubjectDialog(edit.dataset.editSubject); return; }
    const remove = event.target.closest("[data-delete-subject]");
    if (remove) {
      const subject = GT.state.subjects.find((item) => item.id === remove.dataset.deleteSubject);
      if (!subject || !window.confirm(`Delete “${subject.name}” and its saved scores?`)) return;
      const previous = GT.calculate(subject).average;
      GT.addHistory(subject, previous, null, "deleted");
      GT.state.subjects = GT.state.subjects.filter((item) => item.id !== subject.id);
      const stored = GT.save(); GT.renderAll(); GT.toast(stored ? "Subject deleted." : "Subject deleted for this session, but your browser could not save the change.", stored ? "success" : "warning"); return;
    }
    const calculator = event.target.closest("[data-open-calculator]");
    if (calculator) GT.navigate("calculator", calculator.dataset.openCalculator);
  });
})();
