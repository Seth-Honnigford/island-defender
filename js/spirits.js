import { boardAState } from "../data/board-a.js";
import { cardDefinitions } from "../data/cards/index.js";

// =========================================================
// SPIRIT DATA — EDIT / ADD SPIRITS HERE
// This shape is meant to stay generic: adding a new spirit should
// mostly mean adding a new entry here, not new engine code. Growth
// option "effect" behavior isn't implemented yet (display only).
// =========================================================
export const spirits = {
  "vital-strength-earth": {
    id: "vital-strength-earth",
    name: "Vital Strength of the Earth",
    color: "#ff3030",
    energy: 0,
    hand: [cardDefinitions["example-fast-power"], cardDefinitions["example-slow-power"]],
    discard: [],
    playedCards: [],
    cardPlaysUsedThisRound: 0,
    energyTrack: { values: [2, 3, 4, 6, 7, 8], uncoveredCount: 1 },
    cardPlayTrack: { values: [1, 1, 2, 2, 3, 4], uncoveredCount: 1 },
    growthOptions: [
      "Reclaim all cards to hand and add a presence at range 2",
      "Gain a power card and add a presence at range 0",
      "Gain 2 energy and add a presence at range 1",
    ],
    innatePowers: [
      "Innate Power 1 (coming soon)",
      "Innate Power 2 (coming soon)",
      "Special Rules (coming soon)",
    ],
  },
};

// Initial presence placement per spirit. Easily editable per game -
// each entry is { landId, count }.
const spiritSetups = {
  "vital-strength-earth": [
    { landId: 6, count: 2 }, // highest-numbered Mountain
    { landId: 8, count: 1 }, // highest-numbered Jungle
  ],
};

export function applySpiritSetup(spiritId) {
  const placements = spiritSetups[spiritId] || [];
  placements.forEach(({ landId, count }) => {
    const land = boardAState[landId];
    land.presence[spiritId] = (land.presence[spiritId] || 0) + count;
  });
}

export const activeSpiritId = "vital-strength-earth";

function renderTrack(containerEl, trackData) {
  containerEl.innerHTML = "";
  trackData.values.forEach((val, i) => {
    const covered = i >= trackData.uncoveredCount;
    const slot = document.createElement("div");
    slot.className = "track-slot";

    if (covered) {
      const token = document.createElement("div");
      token.className = "track-token";
      const hiddenValue = document.createElement("div");
      hiddenValue.className = "track-hidden-value";
      hiddenValue.textContent = val;
      slot.appendChild(token);
      slot.appendChild(hiddenValue);
    } else {
      const box = document.createElement("div");
      box.className = "track-value-box";
      box.textContent = val;
      slot.appendChild(box);
    }

    containerEl.appendChild(slot);
  });
}

export function renderSpiritBoard() {
  const spirit = spirits[activeSpiritId];

  document.getElementById("spirit-board-title").textContent = spirit.name;

  const growthEl = document.getElementById("growth-options");
  growthEl.innerHTML = "";
  spirit.growthOptions.forEach((text, i) => {
    const optionEl = document.createElement("div");
    optionEl.className = "growth-option";
    optionEl.innerHTML = `<span class="growth-option-number">${i + 1}.</span>${text}`;
    growthEl.appendChild(optionEl);
  });

  renderTrack(document.getElementById("energy-track-row"), spirit.energyTrack);
  renderTrack(document.getElementById("cardplay-track-row"), spirit.cardPlayTrack);

  const innateEl = document.getElementById("innate-powers-list");
  innateEl.innerHTML = "";
  spirit.innatePowers.forEach((text) => {
    const el = document.createElement("div");
    el.className = "innate-placeholder";
    el.textContent = text;
    innateEl.appendChild(el);
  });
}

export function renderEnergyBadge() {
  const spirit = spirits[activeSpiritId];
  const income = spirit.energyTrack.values[spirit.energyTrack.uncoveredCount - 1];
  document.getElementById("spirit-energy-badge").textContent = `${spirit.energy}+${income}`;
}

document.getElementById("spirit-board-toggle").addEventListener("click", () => {
  renderSpiritBoard();
  document.getElementById("spirit-board-overlay").classList.remove("hidden");
});
document.getElementById("spirit-board-close").addEventListener("click", () => {
  document.getElementById("spirit-board-overlay").classList.add("hidden");
});
