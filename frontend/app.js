const recommendationEl = document.getElementById("recommendation");
const button = document.getElementById("getRecommendation");
const waterLevelSelect = document.getElementById("waterLevel");
const riverSuggestionEl = document.getElementById("riverSuggestion");
const riverActionsEl = document.getElementById("riverActions");
const confirmRiverBtn = document.getElementById("confirmRiver");
const changeRiverBtn = document.getElementById("changeRiver");
const riverManualEl = document.getElementById("riverManual");
const riverSelect = document.getElementById("riverSelect");

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
        gps: gpsCoords || undefined
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
            ${alt.condition ? `<span class=\"muted\">${alt.condition}</span>` : ""}
          </li>
        `
      )
      .join("");

    recommendationEl.innerHTML = `
      <div>
        <p class="eyebrow">${data.riverSuggestion}</p>
        <h3>${data.primaryFly.pattern}</h3>
        <p>${data.primaryFly.type} · size ${data.primaryFly.size}</p>
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
requestLocation();
