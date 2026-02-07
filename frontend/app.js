const recommendationEl = document.getElementById("recommendation");
const button = document.getElementById("getRecommendation");
const waterLevelSelect = document.getElementById("waterLevel");
const riverSuggestionEl = document.getElementById("riverSuggestion");
const riverActionsEl = document.getElementById("riverActions");
const confirmRiverBtn = document.getElementById("confirmRiver");
const changeRiverBtn = document.getElementById("changeRiver");
const riverManualEl = document.getElementById("riverManual");
const riverSelect = document.getElementById("riverSelect");
const confidenceGateEl = document.getElementById("confidenceGate");
const fishRisingSelect = document.getElementById("fishRising");
const toggleContextBtn = document.getElementById("toggleContext");
const contextPanelEl = document.getElementById("contextPanel");

let confirmedRiver = "";
let gpsCoords = null;

function showManualRiver(reason) {
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

  contextPanelEl.innerHTML = `
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
    (position) => {
      gpsCoords = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy: position.coords.accuracy
      };
      // TODO: Replace placeholder suggestion with real river inference.
      const suggestedRiver = "River Wye";
      setSuggestedRiver(suggestedRiver);
      confirmRiverBtn.onclick = () => confirmRiver(suggestedRiver);
      changeRiverBtn.onclick = () => showManualRiver("Choose a river.");
    },
    () => {
      showManualRiver("Location denied. Select a river manually.");
    },
    { enableHighAccuracy: false, timeout: 8000 }
  );
}

async function fetchRecommendation() {
  recommendationEl.innerHTML = "<p class=\"muted\">Loading recommendation...</p>";

  try {
    const riverName = confirmedRiver || riverSelect.value;
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

    const riverLabel = data.river?.name || "Unknown";
    if (data.confidence === "low") {
      confidenceGateEl.classList.remove("hidden");
    } else {
      confidenceGateEl.classList.add("hidden");
    }

    renderContextPanel(data.context_used);

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
  }
}

button.addEventListener("click", fetchRecommendation);
toggleContextBtn.addEventListener("click", () => {
  const isHidden = contextPanelEl.classList.contains("hidden");
  contextPanelEl.classList.toggle("hidden");
  toggleContextBtn.textContent = isHidden ? "Hide context" : "Show context used";
});
requestLocation();
