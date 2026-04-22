import { els, calEls } from "./dom-refs.js";
import { studioState, calendarState } from "./state.js";
import { escapeHtml } from "./app-helpers.js";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getWeekStart(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1 - day) + offset * 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatDate(d) { return d.toISOString().slice(0, 10); }
function formatDateShort(d) { return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }
function getWeekDates(offset) {
  const start = getWeekStart(offset);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
}

function showCalendarStatus(text) { calEls.calendarStatus.classList.remove("hidden"); calEls.calendarStatus.textContent = text; }
function hideCalendarStatus() { calEls.calendarStatus.classList.add("hidden"); }

export async function loadCalendar() {
  const [slotsRes, pillarsRes] = await Promise.all([fetch("/api/calendar"), fetch("/api/pillars")]);
  calendarState.slots = await slotsRes.json();
  calendarState.pillars = await pillarsRes.json();
  calendarState.selectedSlotIds.clear();
  renderCalendar();
  renderPillars();
}

function renderCalendar() {
  const dates = getWeekDates(calendarState.weekOffset);
  calEls.weekLabel.textContent = `${formatDateShort(dates[0])} — ${formatDateShort(dates[6])}`;
  const today = formatDate(new Date());
  const brandFilter = calEls.brandSelect.value;

  calEls.grid.innerHTML = dates.map((date) => {
    const dateStr = formatDate(date);
    const isToday = dateStr === today;
    const daySlots = calendarState.slots.filter((s) => {
      if (s.date !== dateStr) return false;
      return !brandFilter || s.brandProfileId === brandFilter;
    });
    const slotsHtml = daySlots.map((slot) => {
      const selected = calendarState.selectedSlotIds.has(slot.id);
      const brand = studioState.brands.find((b) => b.id === slot.brandProfileId);
      return `<div class="calendar-slot${selected ? " is-selected" : ""}" data-slot-id="${slot.id}">
        <div class="calendar-slot__meta">
          <span class="calendar-slot__status" data-status="${slot.status}"></span>
          <span>${brand?.name || slot.brandProfileId}</span><span>· ${slot.platform || "—"}</span>
        </div>
        <div class="calendar-slot__idea">${escapeHtml(slot.idea || "No idea yet")}</div>
      </div>`;
    }).join("");
    return `<div class="calendar-day${isToday ? " is-today" : ""}">
      <div class="calendar-day__header">
        <span class="calendar-day__name">${DAY_NAMES[date.getDay() === 0 ? 6 : date.getDay() - 1]}</span>
        <span class="calendar-day__date">${date.getDate()}</span>
        <button class="calendar-day__add" data-add-date="${dateStr}" type="button" title="Add slot">+</button>
      </div>${slotsHtml}</div>`;
  }).join("");
}

function renderPillars() {
  calEls.pillarsList.innerHTML = calendarState.pillars.map((p) =>
    `<span class="pillar-chip" data-pillar-id="${p.id}">${escapeHtml(p.name)} <span class="pillar-chip__freq">${p.frequency}</span></span>`
  ).join("");
}

export function initCalendarListeners() {
  calEls.weekPrev.addEventListener("click", () => { calendarState.weekOffset--; renderCalendar(); });
  calEls.weekNext.addEventListener("click", () => { calendarState.weekOffset++; renderCalendar(); });
  calEls.brandSelect.addEventListener("change", renderCalendar);

  // Click slot to select or edit
  calEls.grid.addEventListener("click", (e) => {
    const slotEl = e.target.closest("[data-slot-id]");
    const addBtn = e.target.closest("[data-add-date]");
    if (addBtn) {
      calendarState.editingSlotId = null;
      calendarState.editingSlotDate = addBtn.dataset.addDate;
      calEls.slotModalTitle.textContent = `Add content — ${addBtn.dataset.addDate}`;
      calEls.slotIdea.value = "";
      calEls.slotPillar.innerHTML = `<option value="">None</option>` + calendarState.pillars.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
      calEls.slotPlatform.value = "instagram"; calEls.slotStatus.value = "idea";
      calEls.slotModal.classList.remove("hidden");
      return;
    }
    if (slotEl) {
      if (e.shiftKey) {
        const id = slotEl.dataset.slotId;
        calendarState.selectedSlotIds.has(id) ? calendarState.selectedSlotIds.delete(id) : calendarState.selectedSlotIds.add(id);
        renderCalendar();
      } else {
        const slot = calendarState.slots.find((s) => s.id === slotEl.dataset.slotId);
        if (!slot) return;
        calendarState.editingSlotId = slot.id;
        calendarState.editingSlotDate = slot.date;
        calEls.slotModalTitle.textContent = `Edit — ${slot.date}`;
        calEls.slotIdea.value = slot.idea || "";
        calEls.slotPillar.innerHTML = `<option value="">None</option>` + calendarState.pillars.map((p) => `<option value="${p.id}"${p.id === slot.pillar ? " selected" : ""}>${p.name}</option>`).join("");
        calEls.slotPlatform.value = slot.platform || "instagram";
        calEls.slotStatus.value = slot.status || "idea";
        calEls.slotModal.classList.remove("hidden");
      }
    }
  });

  // Slot modal save
  calEls.slotForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {
      date: calendarState.editingSlotDate,
      brandProfileId: calEls.brandSelect.value || els.studioProductSelect.value || "peppera",
      platform: calEls.slotPlatform.value, pillar: calEls.slotPillar.value,
      idea: calEls.slotIdea.value.trim(), status: calEls.slotStatus.value, tags: []
    };
    if (calendarState.editingSlotId) {
      await fetch(`/api/calendar/${calendarState.editingSlotId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } else {
      await fetch("/api/calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    calEls.slotModal.classList.add("hidden");
    await loadCalendar();
  });

  calEls.slotDelete.addEventListener("click", async () => {
    if (!calendarState.editingSlotId) return;
    await fetch(`/api/calendar/${calendarState.editingSlotId}`, { method: "DELETE" });
    calEls.slotModal.classList.add("hidden");
    await loadCalendar();
  });

  calEls.slotModalClose.addEventListener("click", () => calEls.slotModal.classList.add("hidden"));
  calEls.slotModal.addEventListener("click", (e) => { if (e.target.dataset.closeSlotModal) calEls.slotModal.classList.add("hidden"); });

  // Pillar modal
  calEls.addPillarBtn.addEventListener("click", () => {
    calendarState.editingPillarId = null;
    calEls.pillarName.value = ""; calEls.pillarDescription.value = "";
    calEls.pillarFrequency.value = "weekly"; calEls.pillarPlatform.value = "instagram"; calEls.pillarIdeas.value = "";
    calEls.pillarModal.classList.remove("hidden");
  });

  calEls.pillarsList.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-pillar-id]");
    if (!chip) return;
    const pillar = calendarState.pillars.find((p) => p.id === chip.dataset.pillarId);
    if (!pillar) return;
    calendarState.editingPillarId = pillar.id;
    calEls.pillarName.value = pillar.name; calEls.pillarDescription.value = pillar.description || "";
    calEls.pillarFrequency.value = pillar.frequency || "weekly"; calEls.pillarPlatform.value = pillar.platforms?.[0] || "instagram";
    calEls.pillarIdeas.value = (pillar.exampleIdeas || []).join("\n");
    calEls.pillarModal.classList.remove("hidden");
  });

  calEls.pillarForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {
      id: calendarState.editingPillarId || undefined,
      brandProfileId: calEls.brandSelect.value || els.studioProductSelect.value || "peppera",
      name: calEls.pillarName.value.trim(), description: calEls.pillarDescription.value.trim(),
      frequency: calEls.pillarFrequency.value, platforms: [calEls.pillarPlatform.value],
      exampleIdeas: calEls.pillarIdeas.value.split("\n").map((l) => l.trim()).filter(Boolean)
    };
    await fetch("/api/pillars", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    calEls.pillarModal.classList.add("hidden");
    await loadCalendar();
  });

  calEls.pillarDelete.addEventListener("click", async () => {
    if (!calendarState.editingPillarId) return;
    await fetch(`/api/pillars/${calendarState.editingPillarId}`, { method: "DELETE" });
    calEls.pillarModal.classList.add("hidden");
    await loadCalendar();
  });

  calEls.pillarModalClose.addEventListener("click", () => calEls.pillarModal.classList.add("hidden"));
  calEls.pillarModal.addEventListener("click", (e) => { if (e.target.dataset.closePillarModal) calEls.pillarModal.classList.add("hidden"); });

  // Batch generate
  calEls.batchGenerate.addEventListener("click", async () => {
    const ids = [...calendarState.selectedSlotIds];
    if (!ids.length) { showCalendarStatus("Shift-click slots to select them for batch generation."); setTimeout(hideCalendarStatus, 2500); return; }
    showCalendarStatus(`Generating ${ids.length} slot${ids.length > 1 ? "s" : ""}…`);
    try {
      const res = await fetch("/api/calendar/batch-generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slotIds: ids }) });
      const { results } = await res.json();
      const ok = results.filter((r) => r.jobId).length;
      const failed = results.filter((r) => r.error).length;
      showCalendarStatus(`Queued ${ok} job${ok !== 1 ? "s" : ""}${failed ? `, ${failed} failed` : ""}.`);
      calendarState.selectedSlotIds.clear();
      await loadCalendar();
      setTimeout(hideCalendarStatus, 3000);
    } catch (err) { showCalendarStatus(err instanceof Error ? err.message : String(err)); }
  });

  // Auto-fill from pillars
  calEls.autoFill.addEventListener("click", async () => {
    if (!calendarState.pillars.length) { showCalendarStatus("Add content pillars first."); setTimeout(hideCalendarStatus, 2000); return; }
    const dates = getWeekDates(calendarState.weekOffset);
    const brandId = calEls.brandSelect.value || els.studioProductSelect.value || "peppera";
    const existingDates = new Set(calendarState.slots.filter((s) => s.brandProfileId === brandId).map((s) => s.date));
    let created = 0;
    for (const pillar of calendarState.pillars) {
      if (pillar.brandProfileId && pillar.brandProfileId !== brandId) continue;
      const ideas = pillar.exampleIdeas || [];
      if (!ideas.length) continue;
      for (const date of dates) {
        const dateStr = formatDate(date);
        if (existingDates.has(dateStr) || date.getDay() === 0 || date.getDay() === 6) continue;
        await fetch("/api/calendar", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: dateStr, brandProfileId: brandId, platform: pillar.platforms?.[0] || "instagram", pillar: pillar.id, idea: ideas[Math.floor(Math.random() * ideas.length)], status: "idea", tags: [pillar.name] })
        });
        existingDates.add(dateStr); created++; break;
      }
    }
    showCalendarStatus(created ? `Added ${created} slot${created > 1 ? "s" : ""} from pillars.` : "No empty weekday slots available.");
    await loadCalendar();
    setTimeout(hideCalendarStatus, 2500);
  });
}
