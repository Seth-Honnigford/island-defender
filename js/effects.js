import {
  boardAState,
  getPieceTotal,
  getDamageableStacks,
  applyDamageToStack,
  movePieceUnit,
  renderBoard,
} from "./board.js";

// True while a card's effects are being resolved (damage assignment,
// push, or pull are all interactive and take real time). Other parts
// of the app can check this to avoid starting something else, like a
// second card's targeting, mid-resolution.
export let isResolvingEffects = false;

// =========================================================
// Generic "highlight some things on the board, wait for a click"
// helper shared by damage assignment, push, and pull.
// =========================================================
function highlightAndAwaitClick(elements) {
  return new Promise((resolve) => {
    elements.forEach((el) => el.classList.add("card-highlight"));

    function cleanup() {
      elements.forEach((el) => el.classList.remove("card-highlight"));
    }

    elements.forEach((el) => {
      el.addEventListener(
        "click",
        (e) => {
          e.stopPropagation();
          cleanup();
          resolve(el);
        },
        { once: true }
      );
    });
  });
}

function getPieceBadgesInLand(landId, pieceType) {
  return Array.from(
    document.querySelectorAll(
      `#board-container .land[data-land-id="${landId}"] .piece-badge[data-piece-type="${pieceType}"]`
    )
  );
}

function getLandEl(landId) {
  return document.querySelector(`#board-container .land[data-land-id="${landId}"]`);
}

// =========================================================
// DAMAGE
// =========================================================
async function assignDamage(landId, amount) {
  for (let i = 0; i < amount; i++) {
    const land = boardAState[landId];
    const stacks = getDamageableStacks(land);
    if (stacks.length === 0) break; // no invaders left - remaining damage is wasted

    const badges = stacks
      .map(({ type, damageLevel }) => {
        const badge = getPieceBadgesInLand(landId, type).find(
          (el) => Number(el.dataset.damageLevel) === damageLevel
        );
        return badge ? { badge, type, damageLevel } : null;
      })
      .filter(Boolean);

    const chosenEl = await highlightAndAwaitClick(badges.map((b) => b.badge));
    const chosen = badges.find((b) => b.badge === chosenEl);

    await applyDamageToStack(landId, chosen.type, chosen.damageLevel);
  }
}

// =========================================================
// PUSH — select a piece in the (fixed) origin land, then select an
// adjacent land as the destination.
// =========================================================
async function pushPieces(landId, pieceType, count) {
  for (let i = 0; i < count; i++) {
    const land = boardAState[landId];
    if (getPieceTotal(land, pieceType) <= 0) break; // nothing left to push

    const originBadges = getPieceBadgesInLand(landId, pieceType);
    const chosenBadge = await highlightAndAwaitClick(originBadges);
    const damageLevel = chosenBadge.dataset.damageLevel !== undefined ? Number(chosenBadge.dataset.damageLevel) : undefined;

    const destLandEls = land.adjacent.map((id) => getLandEl(id)).filter(Boolean);
    const chosenLandEl = await highlightAndAwaitClick(destLandEls);
    const destLandId = Number(chosenLandEl.dataset.landId);

    movePieceUnit(landId, destLandId, pieceType, damageLevel);
    renderBoard(boardAState);
  }
}

// =========================================================
// PULL — select a piece from any land adjacent to the (fixed)
// destination land; it moves straight there, no extra step.
// =========================================================
async function pullPieces(landId, pieceType, count) {
  for (let i = 0; i < count; i++) {
    const land = boardAState[landId];
    const candidateLandIds = land.adjacent.filter((id) => getPieceTotal(boardAState[id], pieceType) > 0);
    if (candidateLandIds.length === 0) break; // nothing adjacent to pull

    const candidateBadges = candidateLandIds.flatMap((id) => getPieceBadgesInLand(id, pieceType));
    const chosenBadge = await highlightAndAwaitClick(candidateBadges);
    const originLandId = Number(chosenBadge.dataset.landId);
    const damageLevel = chosenBadge.dataset.damageLevel !== undefined ? Number(chosenBadge.dataset.damageLevel) : undefined;

    movePieceUnit(originLandId, landId, pieceType, damageLevel);
    renderBoard(boardAState);
  }
}

// =========================================================
// Effect dispatch. Card effects are plain data: { type, ... }.
// Adding a new effect type means adding one case here.
// =========================================================
export async function resolveCardEffects(card, targetLandId) {
  isResolvingEffects = true;

  for (const effect of card.effects || []) {
    if (effect.type === "damage") {
      await assignDamage(targetLandId, effect.amount);
    } else if (effect.type === "push") {
      await pushPieces(targetLandId, effect.pieceType, effect.count);
    } else if (effect.type === "pull") {
      await pullPieces(targetLandId, effect.pieceType, effect.count);
    }
  }

  isResolvingEffects = false;
}
