import { spirits, activeSpiritId, renderEnergyBadge } from "./spirits.js";
import { boardAState, landMatchesTargetList } from "./board.js";
import { getCurrentPhaseId } from "./phases.js";
import { resolveCardEffects, isResolvingEffects } from "./effects.js";

// =========================================================
// HAND / DISCARD PILE ICONS
// =========================================================
function handIconMarkup() {
  return `<svg viewBox="0 0 100 100">
    <rect x="35" y="40" width="10" height="45" rx="5" fill="white"/>
    <rect x="47" y="30" width="10" height="55" rx="5" fill="white"/>
    <rect x="59" y="35" width="10" height="50" rx="5" fill="white"/>
    <rect x="71" y="42" width="10" height="43" rx="5" fill="white"/>
    <path d="M25 85 Q25 60 45 60 L75 60 Q85 60 85 75 L85 85 Z" fill="white"/>
  </svg>`;
}

function trashIconMarkup() {
  return `<svg viewBox="0 0 100 100">
    <rect x="22" y="25" width="56" height="10" rx="3" fill="white"/>
    <rect x="42" y="10" width="16" height="10" fill="white"/>
    <rect x="30" y="35" width="40" height="50" rx="4" fill="white"/>
    <rect x="38" y="42" width="6" height="35" fill="#26386b"/>
    <rect x="47" y="42" width="6" height="35" fill="#26386b"/>
    <rect x="56" y="42" width="6" height="35" fill="#26386b"/>
  </svg>`;
}

export function renderPileIcons() {
  document.getElementById("hand-icon-overlay").innerHTML = handIconMarkup();
  document.getElementById("discard-icon-overlay").innerHTML = trashIconMarkup();
}

export function renderPileCounts() {
  const spirit = spirits[activeSpiritId];
  document.getElementById("hand-count-badge").textContent = spirit.hand.length;
  document.getElementById("discard-count-badge").textContent = spirit.discard.length;
}

// =========================================================
// CARD VISUALS (image-based, 500x700 aspect ratio) + right-click zoom
// =========================================================
export function createCardElement(card, sizeClass) {
  const el = document.createElement("div");
  el.className = `card-visual ${sizeClass}`;

  const img = document.createElement("img");
  img.src = card.image;
  img.alt = card.name;
  img.onerror = () => {
    img.remove();
    el.classList.add("card-visual-fallback");
    el.textContent = card.name;
  };
  el.appendChild(img);

  el.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    showCardZoom(card);
  });

  return el;
}

export function showCardZoom(card) {
  const content = document.getElementById("card-zoom-content");
  content.innerHTML = "";
  content.appendChild(createCardElement(card, "card-visual-zoom"));
  document.getElementById("card-zoom-overlay").classList.remove("hidden");
}

document.getElementById("card-zoom-close").addEventListener("click", () => {
  document.getElementById("card-zoom-overlay").classList.add("hidden");
});
document.getElementById("card-zoom-overlay").addEventListener("click", (e) => {
  if (e.target.id === "card-zoom-overlay") {
    document.getElementById("card-zoom-overlay").classList.add("hidden");
  }
});

export function renderCardPanel(pileType) {
  const spirit = spirits[activeSpiritId];
  const cards = pileType === "hand" ? spirit.hand : spirit.discard;

  document.getElementById("card-panel-title").textContent = pileType === "hand" ? "Hand" : "Discard Pile";

  const row = document.getElementById("card-panel-row");
  row.innerHTML = "";

  if (cards.length === 0) {
    const emptyText = document.createElement("div");
    emptyText.className = "card-panel-empty-text";
    emptyText.textContent = pileType === "hand" ? "No cards in hand." : "No cards in the discard pile.";
    row.appendChild(emptyText);
  } else {
    cards.forEach((card) => {
      const cardEl = createCardElement(card, "card-visual-large");
      if (pileType === "hand") {
        cardEl.addEventListener("click", () => playCardFromHand(card));
      }
      row.appendChild(cardEl);
    });
  }

  document.getElementById("card-panel-overlay").classList.remove("hidden");
}

document.getElementById("hand-pile-wrapper").addEventListener("click", () => renderCardPanel("hand"));
document.getElementById("discard-pile-wrapper").addEventListener("click", () => renderCardPanel("discard"));
document.getElementById("card-panel-close").addEventListener("click", () => {
  document.getElementById("card-panel-overlay").classList.add("hidden");
});

// =========================================================
// PLAYING / CANCELING CARDS (Power Planning phase only)
// =========================================================
export function playCardFromHand(card) {
  const spirit = spirits[activeSpiritId];
  if (getCurrentPhaseId() !== "power-planning") return;
  if (spirit.energy < card.cost) return;

  const playsAllowed = spirit.cardPlayTrack.values[spirit.cardPlayTrack.uncoveredCount - 1];
  if (spirit.cardPlaysUsedThisRound >= playsAllowed) return;

  const idx = spirit.hand.indexOf(card);
  if (idx === -1) return;

  spirit.hand.splice(idx, 1);
  spirit.energy -= card.cost;
  spirit.cardPlaysUsedThisRound += 1;
  spirit.playedCards.push({ ...card, used: false });

  renderPileCounts();
  renderEnergyBadge();
  renderPlayedCardsRow();
  renderCardPanel("hand");
}

export function cancelPlayedCard(index) {
  const spirit = spirits[activeSpiritId];
  if (getCurrentPhaseId() !== "power-planning") return;

  const playedCard = spirit.playedCards[index];
  if (!playedCard || playedCard.used) return;

  spirit.playedCards.splice(index, 1);
  spirit.energy += playedCard.cost;
  spirit.cardPlaysUsedThisRound = Math.max(0, spirit.cardPlaysUsedThisRound - 1);

  const { used, ...originalCard } = playedCard;
  spirit.hand.push(originalCard);

  renderPileCounts();
  renderEnergyBadge();
  renderPlayedCardsRow();
}

export function moveAllPlayedToDiscard() {
  const spirit = spirits[activeSpiritId];
  spirit.playedCards.forEach((playedCard) => {
    const { used, ...originalCard } = playedCard;
    spirit.discard.push(originalCard);
  });
  spirit.playedCards = [];

  renderPileCounts();
  renderPlayedCardsRow();
}

// =========================================================
// TARGETING (Fast Powers / Slow Powers phases)
// Determines which lands a card may legally target, then lets the
// player drag an arrow from the card to a valid land.
// =========================================================
export function getValidTargets(spiritId, card) {
  const originLands = Object.keys(boardAState)
    .map(Number)
    .filter((id) => {
      const presenceCount = boardAState[id].presence[spiritId] || 0;
      if (presenceCount <= 0) return false;
      if (card.sacredSite && presenceCount < 2) return false;
      return true;
    });

  if (originLands.length === 0) return [];

  // Multi-source BFS from every qualifying origin land at once, so
  // "range" is measured from whichever origin is closest.
  const distances = {};
  originLands.forEach((id) => (distances[id] = 0));
  let frontier = [...originLands];
  let dist = 0;
  while (frontier.length > 0) {
    const nextFrontier = [];
    frontier.forEach((id) => {
      boardAState[id].adjacent.forEach((neighborId) => {
        if (!(neighborId in distances)) {
          distances[neighborId] = dist + 1;
          nextFrontier.push(neighborId);
        }
      });
    });
    frontier = nextFrontier;
    dist += 1;
  }

  return Object.keys(boardAState)
    .map(Number)
    .filter((id) => {
      const d = distances[id];
      if (d === undefined || d > card.range) return false;
      return landMatchesTargetList(boardAState[id], card.target);
    });
}

let targetingState = null;

export function startTargeting(card, cardEl) {
  if (targetingState || isResolvingEffects) return;

  const validTargets = getValidTargets(activeSpiritId, card);
  if (validTargets.length === 0) return;

  const landEls = validTargets
    .map((landId) => document.querySelector(`#board-container .land[data-land-id="${landId}"]`))
    .filter(Boolean);

  landEls.forEach((landEl) => landEl.classList.add("land-targetable"));

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.id = "targeting-arrow-svg";
  svg.innerHTML = `
    <defs>
      <marker id="targeting-arrowhead" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <polygon points="0,0 10,5 0,10" fill="#ffdd33" />
      </marker>
    </defs>
    <line id="targeting-arrow-line" x1="0" y1="0" x2="0" y2="0" stroke="#ffdd33" stroke-width="4" marker-end="url(#targeting-arrowhead)" />
  `;
  document.body.appendChild(svg);

  const cardRect = cardEl.getBoundingClientRect();
  const startX = cardRect.left + cardRect.width / 2;
  const startY = cardRect.top + cardRect.height / 2;
  const line = document.getElementById("targeting-arrow-line");
  line.setAttribute("x1", startX);
  line.setAttribute("y1", startY);
  line.setAttribute("x2", startX);
  line.setAttribute("y2", startY);

  function onMouseMove(e) {
    line.setAttribute("x2", e.clientX);
    line.setAttribute("y2", e.clientY);
  }
  document.addEventListener("mousemove", onMouseMove);

  function onOutsideClick(e) {
    if (!e.target.closest(".land-targetable")) {
      cleanup();
    }
  }

  function cleanup() {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("click", onOutsideClick, true);
    svg.remove();
    landEls.forEach((landEl) => landEl.classList.remove("land-targetable"));
    targetingState = null;
  }

  landEls.forEach((landEl) => {
    landEl.addEventListener(
      "click",
      async (e) => {
        e.stopPropagation();
        const chosenLandId = Number(landEl.dataset.landId);
        cleanup();
        await resolveCardTarget(card, chosenLandId);
      },
      { once: true }
    );
  });

  // Defer listening for outside clicks so the click that opened
  // targeting mode doesn't immediately close it.
  setTimeout(() => {
    document.addEventListener("click", onOutsideClick, true);
  }, 0);

  targetingState = { card, cleanup };
}

async function resolveCardTarget(card, landId) {
  await resolveCardEffects(card, landId);
  card.used = true;
  renderPlayedCardsRow();
}

export function renderPlayedCardsRow() {
  const spirit = spirits[activeSpiritId];
  const container = document.getElementById("played-cards-row");
  container.innerHTML = "";
  const phaseId = getCurrentPhaseId();

  spirit.playedCards.forEach((card, index) => {
    const slot = document.createElement("div");
    slot.className = "played-card-slot";

    const isUsableFast = phaseId === "fast-powers" && card.speed === "fast" && !card.used;
    const isUsableSlow = phaseId === "slow-powers" && card.speed === "slow" && !card.used;

    const cardEl = createCardElement(card, "card-visual-small");
    slot.appendChild(cardEl);

    if (card.used) {
      slot.classList.add("used-card");
    } else if (phaseId === "power-planning") {
      slot.classList.add("cancelable");
      slot.addEventListener("click", () => cancelPlayedCard(index));
    } else if (isUsableFast || isUsableSlow) {
      slot.classList.add("usable-glow");
      cardEl.classList.add("card-highlight");
      slot.addEventListener("click", () => startTargeting(card, cardEl));
    }

    container.appendChild(slot);
  });
}
