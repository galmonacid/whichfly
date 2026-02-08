const recommendationEl = document.getElementById("recommendation");
const button = document.getElementById("getRecommendation");
const waterLevelSelect = document.getElementById("waterLevel");
const riverSuggestionEl = document.getElementById("riverSuggestion");
const riverActionsEl = document.getElementById("riverActions");
const confirmRiverBtn = document.getElementById("confirmRiver");
const changeRiverBtn = document.getElementById("changeRiver");
const riverManualEl = document.getElementById("riverManual");
const riverSelect = document.getElementById("riverSelect");
const riverOptionsEl = document.getElementById("riverOptions");
const confidenceNoteEl = document.getElementById("confidenceNote");
const fishRisingSelect = document.getElementById("fishRising");
const toggleContextBtn = document.getElementById("toggleContext");
const contextPanelEl = document.getElementById("contextPanel");
const modeRiversideBtn = document.getElementById("modeRiverside");
const modePlanningBtn = document.getElementById("modePlanning");
const planningCardEl = document.getElementById("planningCard");
const planningDateInput = document.getElementById("planningDate");
const planningRiverSelect = document.getElementById("planningRiver");
const planningButton = document.getElementById("getPlanningRecommendation");
const rightNowCardEl = document.getElementById("rightNowCard");
const feedbackPanelEl = document.getElementById("feedbackPanel");
const feedbackYesBtn = document.getElementById("feedbackYes");
const feedbackNoBtn = document.getElementById("feedbackNo");
const feedbackMessageEl = document.getElementById("feedbackMessage");

let confirmedRiver = "";
let gpsCoords = null;
const riverOptionMap = new Map();
let lastRecommendation = null;

function showManualRiver(reason) {
  confirmedRiver = "";
  riverSuggestionEl.textContent = reason;
  riverActionsEl.classList.add("hidden");
  riverManualEl.classList.remove("hidden");
}

function setSuggestedRiver(name) {
  riverSuggestionEl.textContent = `Suggested river: ${name}`;
  riverActionsEl.classList.remove("hidden");
  riverManualEl.classList.add("hidden");
}

function formatValue(value, suffix = "") {
  if (value === null || value === undefined) {
    return "Unavailable";
  }
  return `${value}${suffix}`;
}

function renderContextPanel(contextUsed) {
  if (!contextUsed) {
    toggleContextBtn.classList.add("hidden");
    contextPanelEl.classList.add("hidden");
    return;
  }

  const weather = contextUsed.weather || {};
  const daylight = contextUsed.daylight || {};
  const inputs = lastRecommendation || {};
  const fishRisingLabel = inputs.fishRising === "yes"
    ? "Yes"
    : inputs.fishRising === "no"
      ? "No"
      : inputs.fishRising === "unknown"
        ? "Not sure"
        : "Unavailable";
  const riverLabel = inputs.riverLabel || inputs.riverName || "Unavailable";

  contextPanelEl.innerHTML = `
    <div><strong>Inputs</strong></div>
    <div>River: ${riverLabel}</div>
    <div>Fish rising: ${fishRisingLabel}</div>
    ${inputs.mode === "planning"
      ? `<div>Date: ${inputs.plannedDate || "Unavailable"}</div>`
      : ""}
    <div><strong>Weather</strong></div>
    <div>Temperature: ${formatValue(weather.temperature_c, " °C")}</div>
    <div>Precipitation: ${formatValue(weather.precipitation_mm, " mm")}</div>
    <div>Cloud cover: ${formatValue(weather.cloud_cover_pct, " %")}</div>
    <div>Wind: ${formatValue(weather.wind_speed_kph, " km/h")}</div>
    <div><strong>Daylight</strong></div>
    <div>Daylight: ${daylight.is_daylight === null || daylight.is_daylight === undefined
      ? "Unavailable"
      : daylight.is_daylight ? "Yes" : "No"}</div>
    <div>Minutes to sunset: ${formatValue(daylight.minutes_to_sunset)}</div>
  `;

  contextPanelEl.classList.add("hidden");
  toggleContextBtn.textContent = "Show context used";
  toggleContextBtn.classList.remove("hidden");
}

function resetFeedbackPanel() {
  if (!feedbackPanelEl) return;
  feedbackMessageEl.textContent = "";
  feedbackYesBtn.disabled = false;
  feedbackNoBtn.disabled = false;
  feedbackPanelEl.classList.add("hidden");
}

function showFeedbackPanel() {
  if (!feedbackPanelEl) return;
  feedbackPanelEl.classList.remove("hidden");
}

function getSessionId() {
  const key = "whichfly_session_id";
  try {
    let sessionId = localStorage.getItem(key);
    if (!sessionId) {
      sessionId = typeof crypto?.randomUUID === "function"
        ? crypto.randomUUID()
        : `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(key, sessionId);
    }
    return sessionId;
  } catch (error) {
    if (!getSessionId.fallbackId) {
      getSessionId.fallbackId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    return getSessionId.fallbackId;
  }
}

function buildRecommendationId(data) {
  const stamp = data?.meta?.generated_at || new Date().toISOString();
  return `rec_${stamp}_${Math.random().toString(36).slice(2, 8)}`;
}

async function sendFeedback(outcome) {
  if (!lastRecommendation) return;
  feedbackYesBtn.disabled = true;
  feedbackNoBtn.disabled = true;
  feedbackMessageEl.textContent = "Sending...";

  const context = {};
  if (lastRecommendation.mode) context.mode = lastRecommendation.mode;
  if (lastRecommendation.waterLevel) context.waterLevel = lastRecommendation.waterLevel;
  if (lastRecommendation.plannedDate) context.plannedDate = lastRecommendation.plannedDate;
  if (lastRecommendation.confidence) context.confidence = lastRecommendation.confidence;

  try {
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recommendationId: lastRecommendation.id,
        riverName: lastRecommendation.riverName,
        sessionId: getSessionId(),
        outcome,
        context
      })
    });

    if (!response.ok) {
      throw new Error("Feedback failed");
    }
    feedbackMessageEl.textContent = "Thanks for the feedback.";
  } catch (error) {
    feedbackYesBtn.disabled = false;
    feedbackNoBtn.disabled = false;
    feedbackMessageEl.textContent = "Unable to send feedback.";
  }
}

function confirmRiver(name) {
  confirmedRiver = name;
  riverSuggestionEl.textContent = `Suggested river: ${name} (confirmed)`;
  riverActionsEl.classList.add("hidden");
  riverManualEl.classList.add("hidden");
}

async function requestLocation() {
  if (!navigator.geolocation) {
    showManualRiver("Location unavailable. Select a river manually.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      gpsCoords = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy: position.coords.accuracy
      };
      try {
        const response = await fetch("/api/river-suggestion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gps: gpsCoords })
        });
        if (!response.ok) {
          throw new Error("Suggestion failed");
        }
        const data = await response.json();
        const suggestedRiver = data?.river?.name;
        if (!suggestedRiver) {
          showManualRiver("Unable to suggest a river. Select a river manually.");
          return;
        }
        setSuggestedRiver(suggestedRiver);
        confirmRiverBtn.onclick = () => confirmRiver(suggestedRiver);
        changeRiverBtn.onclick = () => showManualRiver("Choose a river.");
      } catch (error) {
        showManualRiver("Unable to suggest a river. Select a river manually.");
      }
    },
    () => {
      showManualRiver("Location denied. Select a river manually.");
    },
    { enableHighAccuracy: false, timeout: 8000 }
  );
}

async function loadRiverOptions() {
  if (!riverOptionsEl) return;
  try {
    const response = await fetch("/api/rivers");
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    if (!Array.isArray(data.options)) {
      return;
    }
    riverOptionsEl.innerHTML = "";
    riverOptionMap.clear();
    const fragment = document.createDocumentFragment();
    data.options.forEach((optionData) => {
      if (!optionData?.label) return;
      const option = document.createElement("option");
      option.value = optionData.label;
      riverOptionMap.set(optionData.label, optionData);
      fragment.appendChild(option);
    });
    riverOptionsEl.appendChild(fragment);
  } catch (error) {
    // Silent: manual entry still works without list.
  }
}

async function fetchRecommendation() {
  recommendationEl.innerHTML = "<p class=\"muted\">Loading recommendation...</p>";
  resetFeedbackPanel();
  lastRecommendation = null;
  confidenceNoteEl.classList.add("hidden");

  try {
    const selectedOption = riverOptionMap.get(riverSelect.value) || null;
    const riverName = confirmedRiver || selectedOption?.river_name || riverSelect.value;
    const selectedRiverLabel = confirmedRiver || selectedOption?.label || riverSelect.value;
    if (!riverName) {
      recommendationEl.innerHTML = "<p class=\"muted\">Select a river to continue.</p>";
      return;
    }

    const response = await fetch("/api/recommendation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        waterLevel: waterLevelSelect.value,
        riverName,
        riverReachId: selectedOption?.reach_id,
        gps: gpsCoords || undefined,
        observations: {
          fishRising: fishRisingSelect.value === "unknown"
            ? null
            : fishRisingSelect.value === "yes"
        }
      })
    });
    if (!response.ok) {
      throw new Error("Request failed");
    }
    const data = await response.json();

    const alternatives = data.alternatives
      .map(
        (alt) => `
          <li>
            <strong>${alt.pattern}</strong> (${alt.type}, size ${alt.size})
            ${alt.when ? `<span class=\"muted\">${alt.when}</span>` : ""}
          </li>
        `
      )
      .join("");

    const responseRiverLabel = data.river?.name || selectedRiverLabel || "Unknown";
    if (data.confidence === "low") {
      confidenceNoteEl.classList.remove("hidden");
    } else {
      confidenceNoteEl.classList.add("hidden");
    }

    lastRecommendation = {
      id: buildRecommendationId(data),
      riverName: data.river?.name || riverName,
      riverLabel: responseRiverLabel,
      mode: data.meta?.mode || "right_now",
      waterLevel: waterLevelSelect.value,
      plannedDate: null,
      confidence: data.confidence,
      fishRising: fishRisingSelect.value
    };
    renderContextPanel(data.context_used);
    showFeedbackPanel();

    recommendationEl.innerHTML = `
      <div>
        <p class="eyebrow">Suggested river: ${responseRiverLabel}</p>
        <h3>${data.primary.pattern}</h3>
        <p>${data.primary.type} · size ${data.primary.size}</p>
        <p class="explanation">${data.explanation}</p>
      </div>
      <div class="alternatives">
        <h4>Alternatives</h4>
        <ul>${alternatives}</ul>
      </div>
    `;
  } catch (error) {
    recommendationEl.innerHTML = "<p class=\"muted\">Unable to load recommendation.</p>";
    resetFeedbackPanel();
    lastRecommendation = null;
  }
}

async function fetchPlanningRecommendation() {
  recommendationEl.innerHTML = "<p class=\"muted\">Loading recommendation...</p>";
  resetFeedbackPanel();
  lastRecommendation = null;
  confidenceNoteEl.classList.add("hidden");

  const plannedDate = planningDateInput.value;
  const planningOption = riverOptionMap.get(planningRiverSelect.value) || null;
  const planningRiver = planningOption?.river_name || planningRiverSelect.value;
  const planningLabel = planningOption?.label || planningRiverSelect.value;

  if (!plannedDate || !planningRiver) {
    recommendationEl.innerHTML = "<p class=\"muted\">Select a date and river to continue.</p>";
    return;
  }

  try {
    const response = await fetch("/api/recommendation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "planning",
        plannedDate,
        riverName: planningRiver,
        riverReachId: planningOption?.reach_id
      })
    });
    if (!response.ok) {
      throw new Error("Request failed");
    }
    const data = await response.json();

    if (data.confidence === "low") {
      confidenceNoteEl.classList.remove("hidden");
    } else {
      confidenceNoteEl.classList.add("hidden");
    }

    lastRecommendation = {
      id: buildRecommendationId(data),
      riverName: data.river?.name || planningRiver,
      riverLabel: planningLabel,
      mode: data.meta?.mode || "planning",
      waterLevel: null,
      plannedDate,
      confidence: data.confidence,
      fishRising: "unknown"
    };
    renderContextPanel(data.context_used);
    showFeedbackPanel();

    const alternatives = data.alternatives
      .map(
        (alt) => `
          <li>
            <strong>${alt.pattern}</strong> (${alt.type}, size ${alt.size})
            ${alt.when ? `<span class=\"muted\">${alt.when}</span>` : ""}
          </li>
        `
      )
      .join("");

    const riverLabel = data.river?.name || "Unknown";
    recommendationEl.innerHTML = `
      <div>
        <p class="eyebrow">Suggested river: ${riverLabel}</p>
        <h3>${data.primary.pattern}</h3>
        <p>${data.primary.type} · size ${data.primary.size}</p>
        <p class="explanation">${data.explanation}</p>
      </div>
      <div class="alternatives">
        <h4>Alternatives</h4>
        <ul>${alternatives}</ul>
      </div>
    `;
  } catch (error) {
    recommendationEl.innerHTML = "<p class=\"muted\">Unable to load recommendation.</p>";
    resetFeedbackPanel();
    lastRecommendation = null;
  }
}

button.addEventListener("click", fetchRecommendation);
planningButton.addEventListener("click", fetchPlanningRecommendation);
function setMode(mode) {
  const isPlanning = mode === "planning";
  planningCardEl.classList.toggle("hidden", !isPlanning);
  rightNowCardEl.classList.toggle("hidden", isPlanning);
  modePlanningBtn.classList.toggle("active", isPlanning);
  modeRiversideBtn.classList.toggle("active", !isPlanning);
  modePlanningBtn.setAttribute("aria-selected", String(isPlanning));
  modeRiversideBtn.setAttribute("aria-selected", String(!isPlanning));
}

modeRiversideBtn.addEventListener("click", () => setMode("right_now"));
modePlanningBtn.addEventListener("click", () => setMode("planning"));
toggleContextBtn.addEventListener("click", () => {
  const isHidden = contextPanelEl.classList.contains("hidden");
  contextPanelEl.classList.toggle("hidden");
  toggleContextBtn.textContent = isHidden ? "Hide context" : "Show context used";
});
if (feedbackYesBtn) {
  feedbackYesBtn.addEventListener("click", () => sendFeedback("up"));
}
if (feedbackNoBtn) {
  feedbackNoBtn.addEventListener("click", () => sendFeedback("down"));
}
requestLocation();
loadRiverOptions();
setMode("right_now");
