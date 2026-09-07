import { boardAState, TILE_W, TILE_H, landPositions } from "../data/board-a.js";
import { spirits } from "./spirits.js";

export { boardAState };

export const pieceLabels = { dahan: "Dh", city: "Ci", town: "Tn", blight: "Bl", explorer: "Ex" };

// Colors used for the piece-add/piece-remove burst animation, keyed by
// piece type.
export const pieceBurstColors = {
  dahan: { bg: "#8b5a2b", fg: "white" },
  city: { bg: "#ffffff", fg: "#222" },
  town: { bg: "#ffffff", fg: "#222" },
  explorer: { bg: "#ffffff", fg: "#222" },
  blight: { bg: "#3b2b4a", fg: "white" },
};

// Invader types that use the damage-stack system, and how much damage
// each can take before being destroyed.
export const invaderHealth = { explorer: 1, town: 2, city: 3 };

export function isInvaderType(pieceType) {
  return pieceType in invaderHealth;
}

// Keyword -> predicate, used by cards.js to check whether a land is a
// legal target. Add a new keyword here whenever a new card needs a
// target restriction that isn't covered yet.
export const targetPredicates = {
  jungle: (land) => land.terrain === "jungle",
  wetland: (land) => land.terrain === "wetland",
  sands: (land) => land.terrain === "sands",
  mountain: (land) => land.terrain === "mountain",
  coastal: (land) => land.coastal,
  dahan: (land) => land.pieces.dahan > 0,
  town: (land) => getPieceTotal(land, "town") > 0,
  city: (land) => getPieceTotal(land, "city") > 0,
  explorer: (land) => getPieceTotal(land, "explorer") > 0,
  blight: (land) => land.pieces.blight > 0,
};

export function landMatchesTargetList(land, targetList) {
  return targetList.some((t) => targetPredicates[t] && targetPredicates[t](land));
}

// =========================================================
// PIECE COUNT HELPERS
// Dahan/Blight are plain numbers. Explorer/Town/City are objects
// mapping damage-level -> count (see boardAState comment in
// data/board-a.js).
// =========================================================
export function getPieceTotal(land, pieceType) {
  if (isInvaderType(pieceType)) {
    return Object.values(land.pieces[pieceType]).reduce((sum, n) => sum + n, 0);
  }
  return land.pieces[pieceType];
}

// Adds `count` fresh (undamaged) units of an invader type to a land.
export function addInvaderPiece(land, pieceType, count = 1) {
  land.pieces[pieceType][0] = (land.pieces[pieceType][0] || 0) + count;
}

// Returns every non-empty {type, damageLevel} stack of invader pieces
// present in a land - used to know what can be assigned damage.
export function getDamageableStacks(land) {
  const stacks = [];
  Object.keys(invaderHealth).forEach((type) => {
    Object.entries(land.pieces[type]).forEach(([levelStr, count]) => {
      if (count > 0) {
        stacks.push({ type, damageLevel: Number(levelStr) });
      }
    });
  });
  return stacks;
}

export function centerOf(landId) {
  const pos = landPositions[landId];
  return { x: pos.left + TILE_W / 2, y: pos.top + TILE_H / 2 };
}

export function renderAdjacencyLines(state) {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("id", "adjacency-svg");
  const drawn = new Set();

  Object.entries(state).forEach(([landId, land]) => {
    const from = Number(landId);
    land.adjacent.forEach((to) => {
      const key = [from, to].sort((a, b) => a - b).join("-");
      if (drawn.has(key)) return;
      drawn.add(key);

      const c1 = centerOf(from);
      const c2 = centerOf(to);
      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", c1.x);
      line.setAttribute("y1", c1.y);
      line.setAttribute("x2", c2.x);
      line.setAttribute("y2", c2.y);
      line.setAttribute("stroke", "black");
      line.setAttribute("stroke-width", "3");
      svg.appendChild(line);
    });
  });

  return svg;
}

export function renderBoard(state) {
  const container = document.getElementById("board-container");
  container.innerHTML = "";
  container.appendChild(renderAdjacencyLines(state));

  Object.entries(state).forEach(([landId, land]) => {
    const pos = landPositions[landId];
    const landEl = document.createElement("div");
    landEl.className = `land terrain-${land.terrain}`;
    landEl.dataset.landId = landId;
    landEl.style.left = `${pos.left}px`;
    landEl.style.top = `${pos.top}px`;

    const numberEl = document.createElement("div");
    numberEl.className = "land-number";
    numberEl.textContent = landId;
    landEl.appendChild(numberEl);

    if (land.coastal) {
      const coastalEl = document.createElement("div");
      coastalEl.className = "coastal-tag";
      coastalEl.textContent = "Coastal";
      landEl.appendChild(coastalEl);
    }

    const piecesEl = document.createElement("div");
    piecesEl.className = "land-pieces";

    function appendBadge(pieceType, count, damageLevel) {
      const badge = document.createElement("div");
      badge.className = `piece-badge piece-${pieceType}`;
      badge.textContent = pieceLabels[pieceType];
      badge.dataset.landId = landId;
      badge.dataset.pieceType = pieceType;
      if (damageLevel !== undefined) {
        badge.dataset.damageLevel = damageLevel;
        if (damageLevel > 0) {
          const dots = document.createElement("div");
          dots.className = "damage-dots";
          for (let i = 0; i < damageLevel; i++) {
            const dot = document.createElement("div");
            dot.className = "damage-dot";
            dots.appendChild(dot);
          }
          badge.appendChild(dots);
        }
      }

      const countEl = document.createElement("div");
      countEl.className = "piece-count";
      countEl.textContent = count;
      badge.appendChild(countEl);

      piecesEl.appendChild(badge);
    }

    // Dahan and Blight: simple counts, one badge each.
    if (land.pieces.dahan > 0) appendBadge("dahan", land.pieces.dahan);
    if (land.pieces.blight > 0) appendBadge("blight", land.pieces.blight);

    // Explorer/Town/City: one badge per non-empty damage-level stack.
    Object.keys(invaderHealth).forEach((type) => {
      Object.entries(land.pieces[type])
        .sort(([a], [b]) => Number(a) - Number(b))
        .forEach(([levelStr, count]) => {
          if (count > 0) appendBadge(type, count, Number(levelStr));
        });
    });

    // Spirit presence badges (color varies per spirit).
    Object.entries(land.presence).forEach(([spiritId, count]) => {
      if (count > 0) {
        const spirit = spirits[spiritId];
        const badge = document.createElement("div");
        badge.className = "piece-badge";
        badge.style.background = spirit.color;
        badge.style.color = "white";
        badge.textContent = count >= 2 ? "\u2605" : "";

        const countEl = document.createElement("div");
        countEl.className = "piece-count";
        countEl.textContent = count;
        badge.appendChild(countEl);

        piecesEl.appendChild(badge);
      }
    });

    landEl.appendChild(piecesEl);
    container.appendChild(landEl);
  });
}

// Shows a big circle over the given land, then shrinks/fades it away.
// Only AFTER the animation finishes do we mutate state and re-render,
// so the badge visually "lands" once the burst disappears.
export function animatePieceAdd(landId, pieceType, mutateFn) {
  return new Promise((resolve) => {
    const container = document.getElementById("board-container");
    const landEl = container.querySelector(`.land[data-land-id="${landId}"]`);

    if (!landEl) {
      mutateFn();
      renderBoard(boardAState);
      resolve();
      return;
    }

    const centerX = landEl.offsetLeft + landEl.offsetWidth / 2;
    const centerY = landEl.offsetTop + landEl.offsetHeight / 2;

    const colors = pieceBurstColors[pieceType];
    const burst = document.createElement("div");
    burst.className = "piece-burst";
    burst.style.left = `${centerX}px`;
    burst.style.top = `${centerY}px`;
    burst.style.background = colors.bg;
    burst.style.color = colors.fg;
    burst.textContent = pieceLabels[pieceType];
    container.appendChild(burst);

    // Force the browser to register the burst's initial (full-size,
    // full-opacity) state before we change it. Without this, on some
    // frames the append and the "shrink" class change get batched
    // into the same paint, and the transition never visibly plays.
    void burst.offsetWidth;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        burst.classList.add("shrink");
      });
    });

    setTimeout(() => {
      burst.remove();
      mutateFn();
      renderBoard(boardAState);
      resolve();
    }, 1640);
  });
}

// Reverse of animatePieceAdd: starts small/opaque (mimicking the piece
// that's about to disappear) and grows/fades outward, then AFTER the
// animation finishes, mutates state and re-renders.
export function animatePieceRemove(landId, pieceType, mutateFn) {
  return new Promise((resolve) => {
    const container = document.getElementById("board-container");
    const landEl = container.querySelector(`.land[data-land-id="${landId}"]`);

    if (!landEl) {
      mutateFn();
      renderBoard(boardAState);
      resolve();
      return;
    }

    const centerX = landEl.offsetLeft + landEl.offsetWidth / 2;
    const centerY = landEl.offsetTop + landEl.offsetHeight / 2;

    const colors = pieceBurstColors[pieceType];
    const burst = document.createElement("div");
    burst.className = "piece-burst piece-burst-remove-start";
    burst.style.left = `${centerX}px`;
    burst.style.top = `${centerY}px`;
    burst.style.background = colors.bg;
    burst.style.color = colors.fg;
    burst.textContent = pieceLabels[pieceType];
    container.appendChild(burst);

    void burst.offsetWidth;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        burst.classList.add("grow-fade");
      });
    });

    setTimeout(() => {
      burst.remove();
      mutateFn();
      renderBoard(boardAState);
      resolve();
    }, 1640);
  });
}

// Assigns 1 point of damage to a specific invader stack. If this kills
// it (damage reaches its health), plays the destroy animation and
// removes one unit; otherwise moves one unit to the next damage-level
// stack (no special animation - just a re-render showing the new dot).
export async function applyDamageToStack(landId, pieceType, damageLevel) {
  const land = boardAState[landId];
  const newLevel = damageLevel + 1;
  const health = invaderHealth[pieceType];

  if (newLevel >= health) {
    await animatePieceRemove(landId, pieceType, () => {
      land.pieces[pieceType][damageLevel] -= 1;
    });
  } else {
    land.pieces[pieceType][damageLevel] -= 1;
    land.pieces[pieceType][newLevel] = (land.pieces[pieceType][newLevel] || 0) + 1;
    renderBoard(boardAState);
  }
}

// Moves one unit of a piece type from one land to another. For
// invader types, `damageLevel` says which stack to move from/to
// (damage state is preserved across the move).
export function movePieceUnit(fromLandId, toLandId, pieceType, damageLevel) {
  const fromLand = boardAState[fromLandId];
  const toLand = boardAState[toLandId];

  if (isInvaderType(pieceType)) {
    fromLand.pieces[pieceType][damageLevel] -= 1;
    toLand.pieces[pieceType][damageLevel] = (toLand.pieces[pieceType][damageLevel] || 0) + 1;
  } else {
    fromLand.pieces[pieceType] -= 1;
    toLand.pieces[pieceType] += 1;
  }
}

export function landMatchesTerrainButton(land, terrainType) {
  return terrainType === "coastal" ? land.coastal : land.terrain === terrainType;
}

export function landMatchesCard(land, card) {
  return card.terrains.some((t) => landMatchesTerrainButton(land, t));
}

export function hasInvaderBuilding(land) {
  return getPieceTotal(land, "city") > 0 || getPieceTotal(land, "town") > 0;
}

export function isAdjacentToInvaderBuilding(land) {
  return land.adjacent.some((neighborId) => hasInvaderBuilding(boardAState[neighborId]));
}

export function shouldExplore(land) {
  return land.coastal || hasInvaderBuilding(land) || isAdjacentToInvaderBuilding(land);
}

export function sortedLandIds(predicate) {
  return Object.keys(boardAState)
    .map(Number)
    .filter((id) => predicate(boardAState[id]))
    .sort((a, b) => a - b);
}
