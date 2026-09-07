import { boardAState } from "../data/board-a.js";
import { getRelativePos } from "./utils.js";
import {
  animatePieceAdd,
  landMatchesCard,
  shouldExplore,
  sortedLandIds,
} from "./board.js";

// =========================================================
// INVADER CARD DEFINITIONS — EDIT THIS SECTION PER GAME
// Each entry is a list of 1-2 terrain types that card affects.
// Valid terrain values: "jungle", "wetland", "sands", "mountain", "coastal"
// Cards are drawn stage 1 first, then stage 2, then stage 3 -
// all cards in a stage are drawn before moving to the next stage.
// =========================================================
const invaderCardDefinitions = {
  stage1: [
    ["jungle"], ["wetland"], ["sands"], ["mountain"],
  ],
  stage2: [
    ["jungle"], ["wetland"], ["sands"], ["mountain"], ["coastal"],
  ],
  stage3: [
    ["jungle", "wetland"], ["jungle", "sands"], ["jungle", "mountain"],
    ["wetland", "sands"], ["wetland", "mountain"], ["sands", "mountain"],
  ],
};

const terrainColors = {
  mountain: "#9aa0a6",
  wetland: "#4a9b96",
  jungle: "#3a7a46",
  sands: "#b8973f",
  coastal: "#2a6fa8",
};

function capitalizeTerrain(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildInvaderDeck() {
  let idCounter = 1;
  const makeCards = (terrainLists) =>
    shuffle(terrainLists).map((terrains) => ({
      id: idCounter++,
      terrains,
      label: terrains.map(capitalizeTerrain).join(" + "),
    }));

  return [
    ...makeCards(invaderCardDefinitions.stage1),
    ...makeCards(invaderCardDefinitions.stage2),
    ...makeCards(invaderCardDefinitions.stage3),
  ];
}

let deck = buildInvaderDeck();
let discardPile = [];
let buildSlotCard = null;
let ravageSlotCard = null;
let isAnimating = false;

function populateCardFace(el, card) {
  el.innerHTML = "";
  el.className = "card-face";
  card.terrains.forEach((t) => {
    const half = document.createElement("div");
    half.className = "card-face-half";
    half.style.background = terrainColors[t];
    half.textContent = capitalizeTerrain(t);
    el.appendChild(half);
  });
}

function createCardFace(card) {
  const el = document.createElement("div");
  populateCardFace(el, card);
  return el;
}

export function renderInvaderTrack() {
  document.getElementById("deck-count-badge").textContent = deck.length;

  const oldBuildVisual = document.getElementById("build-slot-visual");
  const newBuildVisual = renderSlotVisual("build-slot-visual", buildSlotCard);
  oldBuildVisual.replaceWith(newBuildVisual);

  const oldRavageVisual = document.getElementById("ravage-slot-visual");
  const newRavageVisual = renderSlotVisual("ravage-slot-visual", ravageSlotCard);
  oldRavageVisual.replaceWith(newRavageVisual);

  const traveling = document.getElementById("traveling-card");
  if (traveling) traveling.remove();
}

function renderSlotVisual(id, card) {
  let el;
  if (card) {
    el = createCardFace(card);
  } else {
    el = document.createElement("div");
    el.className = "card-placeholder";
    el.textContent = "Empty";
  }
  el.id = id;
  return el;
}

// Creates the traveling card element at the deck's position, showing
// its face-down back, then flips it to reveal the drawn card.
function flipCardAnimation(card) {
  return new Promise((resolve) => {
    document.getElementById("deck-count-badge").textContent = deck.length;

    const track = document.getElementById("invader-track");
    const deckEl = document.getElementById("deck-visual");
    const pos = getRelativePos(deckEl, track);

    const traveling = document.createElement("div");
    traveling.id = "traveling-card";
    traveling.className = "deck-card";
    traveling.style.left = `${pos.left}px`;
    traveling.style.top = `${pos.top}px`;
    traveling.style.transition = "transform 0.5s ease";
    track.appendChild(traveling);

    requestAnimationFrame(() => {
      traveling.style.transform = "scaleX(0.05)";
    });

    setTimeout(() => {
      populateCardFace(traveling, card);
      traveling.id = "traveling-card";
      traveling.style.position = "absolute";
      traveling.style.left = `${pos.left}px`;
      traveling.style.top = `${pos.top}px`;
      traveling.style.transition = "transform 0.5s ease";
      traveling.style.transform = "scaleX(1)";
    }, 520);

    setTimeout(resolve, 1120);
  });
}

// Slides the (still-visible) old Build and Ravage cards into their
// new positions, and the freshly-flipped traveling card into the
// Build slot, then finalizes state and re-renders cleanly.
// The track is vertical, so movement is on the Y axis.
function slideCardsAfterActions(drawnCard, oldBuildCard, hadOldRavageCard) {
  return new Promise((resolve) => {
    const buildVisual = document.getElementById("build-slot-visual");
    const ravageVisual = document.getElementById("ravage-slot-visual");
    const traveling = document.getElementById("traveling-card");

    const buildRect = buildVisual.getBoundingClientRect();
    const ravageRect = ravageVisual.getBoundingClientRect();

    if (hadOldRavageCard) {
      ravageVisual.style.transition = "transform 1s ease, opacity 1s ease";
      ravageVisual.style.transform = "translateY(120px)";
      ravageVisual.style.opacity = "0";
    }

    if (oldBuildCard) {
      const dy = ravageRect.top - buildRect.top;
      buildVisual.style.transition = "transform 1s ease";
      buildVisual.style.transform = `translateY(${dy}px)`;
    }

    if (traveling) {
      const dy = buildRect.top - traveling.getBoundingClientRect().top;
      traveling.style.transition = "transform 1s ease";
      traveling.style.transform = `translateY(${dy}px)`;
    }

    setTimeout(() => {
      ravageSlotCard = oldBuildCard;
      buildSlotCard = drawnCard;
      renderInvaderTrack();
      resolve();
    }, 1040);
  });
}

async function exploreCard(card) {
  const landIds = sortedLandIds((land) => landMatchesCard(land, card) && shouldExplore(land));
  for (const landId of landIds) {
    await animatePieceAdd(landId, "explorer", () => {
      boardAState[landId].pieces.explorer += 1;
    });
  }
}

async function buildCard(card) {
  const landIds = sortedLandIds((land) => {
    if (!landMatchesCard(land, card)) return false;
    return land.pieces.explorer > 0 || land.pieces.town > 0 || land.pieces.city > 0;
  });

  for (const landId of landIds) {
    const land = boardAState[landId];
    const pieceType = land.pieces.town > land.pieces.city ? "city" : "town";
    await animatePieceAdd(landId, pieceType, () => {
      land.pieces[pieceType] += 1;
    });
  }
}

function promptCascadeAsync(landId, message) {
  return new Promise((resolve) => {
    const land = boardAState[landId];
    const overlay = document.getElementById("cascade-overlay");
    const messageEl = document.getElementById("cascade-message");
    const optionsEl = document.getElementById("cascade-options");

    messageEl.textContent = message;
    optionsEl.innerHTML = "";

    land.adjacent.forEach((adjId) => {
      const btn = document.createElement("button");
      btn.className = "cascade-option-btn";
      btn.textContent = `Land ${adjId}`;
      btn.addEventListener("click", () => {
        overlay.classList.add("hidden");
        resolve(adjId);
      });
      optionsEl.appendChild(btn);
    });

    overlay.classList.remove("hidden");
  });
}

async function addBlightWithCascadeAsync(landId) {
  const land = boardAState[landId];

  if (land.pieces.blight >= 2) {
    const chosenId = await promptCascadeAsync(
      landId,
      `Land ${landId} is already at maximum Blight (2). Pick an adjacent land to receive this Blight instead.`
    );
    await addBlightWithCascadeAsync(chosenId);
    return;
  }

  const wasAtOne = land.pieces.blight === 1;
  await animatePieceAdd(landId, "blight", () => {
    land.pieces.blight += 1;
  });

  if (wasAtOne) {
    const chosenId = await promptCascadeAsync(
      landId,
      `Land ${landId} just reached 2 Blight. Pick an adjacent land to cascade an additional Blight to.`
    );
    await addBlightWithCascadeAsync(chosenId);
  }
}

async function ravageCard(card) {
  const landIds = sortedLandIds((land) => landMatchesCard(land, card));
  for (const landId of landIds) {
    const land = boardAState[landId];
    const damage = land.pieces.explorer * 1 + land.pieces.town * 2 + land.pieces.city * 3;
    if (damage >= 2) {
      await addBlightWithCascadeAsync(landId);
    }
  }
}

// =========================================================
// INVADER ACTIONS — advances the whole card track one step:
//   1. Ravage the card in the Ravage slot (board animations play,
//      card stays visually in place), then it will be discarded.
//   2. Build the card in the Build slot (board animations play,
//      card stays visually in place).
//   3. Draw the top deck card, flip it face up, Explore it (board
//      animations play).
//   4. Only now do the cards slide into their new slots.
// Any empty slot simply skips that action. Called automatically by
// phases.js when the Invader Phase begins.
// =========================================================
export async function runInvaderActions() {
  if (isAnimating) return;
  isAnimating = true;

  const hadOldRavageCard = Boolean(ravageSlotCard);
  const oldBuildCard = buildSlotCard;

  if (ravageSlotCard) {
    await ravageCard(ravageSlotCard);
    discardPile.push(ravageSlotCard);
  }

  if (buildSlotCard) {
    await buildCard(buildSlotCard);
  }

  let drawnCard = null;
  if (deck.length > 0) {
    drawnCard = deck.shift();
    await flipCardAnimation(drawnCard);
    await exploreCard(drawnCard);
  }

  await slideCardsAfterActions(drawnCard, oldBuildCard, hadOldRavageCard);

  isAnimating = false;
}
window.runInvaderActions = runInvaderActions;
