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
// On-screen prompt telling the player what to click next. Without
// this, a multi-click effect (push/pull select piece, then select a
// land) can look like nothing is happening.
// =========================================================
function showEffectStatus(text) {
  const el = document.getElementById("effect-status");
  if (!el) return;
  el.textContent = text;
  el.classList.remove("hidden");
}

function hideEffectStatus() {
  const el = document.getElementById("effect-status");
  if (el) el.classList.add("hidden");
}

// =========================================================
// Generic "highlight some things on the board, wait for a click"
// helper shared by damage assignment, push, and pull. Resolves with
// null (instead of hanging forever) if there's nothing to highlight,
// since that indicates a data/DOM mismatch rather than "the player
// hasn't clicked yet".
// =========================================================
function highlightAndAwaitClick(elements) {
  if (!elements || elements.length === 0) {
    console.warn("highlightAndAwaitClick called with no elements - skipping this step.");
    return Promise.resolve(null);
  }

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

    if (badges.length === 0) {
      console.warn(`No matching badges found for damageable stacks in land ${landId} - stopping damage assignment.`);
      break;
    }

    showEffectStatus(`Assign 1 damage: click an invader in Land ${landId}.`);
    const chosenEl = await highlightAndAwaitClick(badges.map((b) => b.badge));
    if (!chosenEl) break;

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
    if (originBadges.length === 0) {
      console.warn(`Expected a ${pieceType} badge in land ${landId} to push, but none was found in the DOM.`);
      break;
    }

    showEffectStatus(`Push: click the ${pieceType} to push out of Land ${landId}.`);
    const chosenBadge = await highlightAndAwaitClick(originBadges);
    if (!chosenBadge) break;

    const damageLevel = chosenBadge.dataset.damageLevel !== undefined ? Number(chosenBadge.dataset.damageLevel) : undefined;

    const destLandEls = land.adjacent.map((id) => getLandEl(id)).filter(Boolean);
    if (destLandEls.length === 0) {
      console.warn(`Land ${landId} has no adjacent lands rendered - cannot push.`);
      break;
    }

    showEffectStatus(`Push: click a land adjacent to Land ${landId} to push it to.`);
    const chosenLandEl = await highlightAndAwaitClick(destLandEls);
    if (!chosenLandEl) break;

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
    if (candidateBadges.length === 0) {
      console.warn(`Expected ${pieceType} badges adjacent to land ${landId} to pull, but none were found in the DOM.`);
      break;
    }

    showEffectStatus(`Pull: click a ${pieceType} adjacent to Land ${landId} to pull it in.`);
    const chosenBadge = await highlightAndAwaitClick(candidateBadges);
    if (!chosenBadge) break;

    const originLandId = Number(chosenBadge.dataset.landId);
    const damageLevel = chosenBadge.dataset.damageLevel !== undefined ? Number(chosenBadge.dataset.damageLevel) : undefined;

    movePieceUnit(originLandId, landId, pieceType, damageLevel);
    renderBoard(boardAState);
  }
}

// =========================================================
// Effect dispatch. Card effects are plain data: { type, ... }.
// Adding a new effect type means adding one case here.
//
// Wrapped in try/finally so that any unexpected error still resets
// isResolvingEffects and hides the status prompt, instead of leaving
// the whole game permanently locked out of future card interactions.
// =========================================================
export async function resolveCardEffects(card, targetLandId) {
  isResolvingEffects = true;

  try {
    for (const effect of card.effects || []) {
      if (effect.type === "damage") {
        await assignDamage(targetLandId, effect.amount);
      } else if (effect.type === "push") {
        await pushPieces(targetLandId, effect.pieceType, effect.count);
      } else if (effect.type === "pull") {
        await pullPieces(targetLandId, effect.pieceType, effect.count);
      }
    }
  } catch (err) {
    console.error("Error resolving card effects:", err);
  } finally {
    hideEffectStatus();
    isResolvingEffects = false;
  }
}
