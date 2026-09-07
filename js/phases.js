import { delay, getRelativePos } from "./utils.js";
import { spirits, activeSpiritId, renderEnergyBadge } from "./spirits.js";
import { runInvaderActions } from "./invaders.js";
import { moveAllPlayedToDiscard, renderPlayedCardsRow } from "./cards.js";

export const phases = [
  { id: "growth", name: "Growth Phase" },
  { id: "energy", name: "Energy Phase" },
  { id: "power-planning", name: "Power Planning Phase" },
  { id: "fast-powers", name: "Fast Powers" },
  { id: "fear-effects", name: "Fear Effects" },
  { id: "invader", name: "Invader Phase" },
  { id: "slow-powers", name: "Slow Powers" },
  { id: "time-passes", name: "Time Passes" },
];

let currentPhaseIndex = 0;
let isReady = false;
let isPhaseAnimating = false;

export function getCurrentPhaseId() {
  return phases[currentPhaseIndex].id;
}

function getPhaseIconMarkup(phaseId) {
  switch (phaseId) {
    case "growth":
      return `<svg viewBox="0 0 100 100"><circle cx="50" cy="38" r="30" fill="#3a7a46"/><rect x="43" y="60" width="14" height="32" fill="#7a4a25"/></svg>`;
    case "energy":
      return `<svg viewBox="0 0 100 100"><polygon points="55,5 25,55 45,55 35,95 78,45 55,45" fill="#f1c40f"/></svg>`;
    case "power-planning":
      return `<div class="phase-cardback-icon"></div>`;
    case "fast-powers":
      return `<svg viewBox="0 0 100 100"><ellipse cx="48" cy="55" rx="26" ry="17" fill="#e74c3c"/><polygon points="28,50 4,33 32,42" fill="#e74c3c"/><polygon points="74,48 26,48 40,33" fill="#e74c3c"/><circle cx="70" cy="44" r="6" fill="#e74c3c"/></svg>`;
    case "fear-effects":
      return `<svg viewBox="0 0 100 100"><circle cx="50" cy="42" r="32" fill="#9155ad"/><circle cx="38" cy="38" r="8" fill="#2b1a33"/><circle cx="62" cy="38" r="8" fill="#2b1a33"/><rect x="30" y="62" width="10" height="14" fill="#9155ad"/><rect x="45" y="65" width="10" height="16" fill="#9155ad"/><rect x="60" y="62" width="10" height="14" fill="#9155ad"/></svg>`;
    case "invader":
      return `<svg viewBox="0 0 100 100"><circle cx="50" cy="25" r="15" fill="#ffffff" stroke="#333" stroke-width="3"/><path d="M30 90 L30 60 Q30 45 50 45 Q70 45 70 60 L70 90 Z" fill="#ffffff" stroke="#333" stroke-width="3"/></svg>`;
    case "slow-powers":
      return `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="55" rx="34" ry="22" fill="#2980b9"/><circle cx="82" cy="52" r="10" fill="#2980b9"/><ellipse cx="25" cy="72" rx="7" ry="10" fill="#2980b9"/><ellipse cx="45" cy="78" rx="7" ry="10" fill="#2980b9"/><ellipse cx="65" cy="78" rx="7" ry="10" fill="#2980b9"/><ellipse cx="20" cy="45" rx="7" ry="10" fill="#2980b9"/></svg>`;
    case "time-passes":
      return `<svg viewBox="0 0 100 100"><circle cx="50" cy="55" r="33" fill="none" stroke="#333" stroke-width="6"/><line x1="50" y1="55" x2="50" y2="32" stroke="#333" stroke-width="5"/><line x1="50" y1="55" x2="68" y2="60" stroke="#333" stroke-width="5"/><rect x="42" y="8" width="16" height="10" fill="#333"/></svg>`;
    default:
      return "";
  }
}

export function renderPhaseTrack() {
  const track = document.getElementById("phase-track");
  track.innerHTML = "";

  phases.forEach((phase, i) => {
    const slot = document.createElement("div");
    slot.className = "phase-slot";
    slot.dataset.phase = phase.id;
    slot.title = phase.name;
    slot.innerHTML = getPhaseIconMarkup(phase.id);
    track.appendChild(slot);

    if (i < phases.length - 1) {
      const arrow = document.createElement("div");
      arrow.className = "phase-arrow";
      arrow.textContent = "\u2192";
      track.appendChild(arrow);
    }
  });

  const highlight = document.createElement("div");
  highlight.id = "phase-highlight";
  track.appendChild(highlight);
}

export function updatePhaseHighlight() {
  const track = document.getElementById("phase-track");
  const activeSlot = track.querySelector(`.phase-slot[data-phase="${phases[currentPhaseIndex].id}"]`);
  const pos = getRelativePos(activeSlot, track);
  const centerX = pos.left + activeSlot.offsetWidth / 2;
  const centerY = pos.top + activeSlot.offsetHeight / 2;

  const highlight = document.getElementById("phase-highlight");
  highlight.style.left = `${centerX}px`;
  highlight.style.top = `${centerY}px`;
}

// Big icon + label fading into the center of the screen, blocking
// interaction underneath for its duration.
function showPhaseFadeAnimation(phase) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.id = "phase-fade-overlay";
    overlay.innerHTML = `
      <div class="phase-fade-icon">${getPhaseIconMarkup(phase.id)}</div>
      <div class="phase-fade-text">${phase.name}</div>
    `;
    document.body.appendChild(overlay);

    void overlay.offsetWidth;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.classList.add("visible");
      });
    });

    setTimeout(() => {
      overlay.classList.remove("visible");
    }, 1400);

    setTimeout(() => {
      overlay.remove();
      resolve();
    }, 1900);
  });
}

async function advancePhase() {
  isPhaseAnimating = true;

  const nextIndex = (currentPhaseIndex + 1) % phases.length;
  const nextPhase = phases[nextIndex];

  await showPhaseFadeAnimation(nextPhase);

  currentPhaseIndex = nextIndex;
  updatePhaseHighlight();

  const spirit = spirits[activeSpiritId];

  if (nextPhase.id === "energy") {
    const income = spirit.energyTrack.values[spirit.energyTrack.uncoveredCount - 1];
    spirit.energy += income;
    renderEnergyBadge();
  }

  if (nextPhase.id === "power-planning") {
    spirit.cardPlaysUsedThisRound = 0;
  }

  if (nextPhase.id === "invader") {
    await runInvaderActions();
  }

  if (nextPhase.id === "time-passes") {
    moveAllPlayedToDiscard();
  }

  renderPlayedCardsRow();

  isReady = false;
  const btn = document.getElementById("ready-btn");
  btn.textContent = "\u2717 Ready?";
  btn.classList.remove("ready");
  btn.disabled = false;

  isPhaseAnimating = false;
}

document.getElementById("ready-btn").addEventListener("click", async () => {
  if (isPhaseAnimating || isReady) return;

  isReady = true;
  const btn = document.getElementById("ready-btn");
  btn.textContent = "\u2713 Ready!";
  btn.classList.add("ready");
  btn.disabled = true;

  // Single player for now, so "all players ready" is immediate.
  await delay(500);
  await advancePhase();
});
