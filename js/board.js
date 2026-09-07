import { boardAState, TILE_W, TILE_H, landPositions } from "../data/board-a.js";
import { spirits } from "./spirits.js";

export { boardAState };

export const pieceLabels = { dahan: "Dh", city: "Ci", town: "Tn", blight: "Bl", explorer: "Ex" };

// Colors used for the "burst" animation circle, keyed by piece type.
export const pieceBurstColors = {
  dahan: { bg: "#8b5a2b", fg: "white" },
  city: { bg: "#ffffff", fg: "#222" },
  town: { bg: "#ffffff", fg: "#222" },
  explorer: { bg: "#ffffff", fg: "#222" },
  blight: { bg: "#3b2b4a", fg: "white" },
};

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
  town: (land) => land.pieces.town > 0,
  city: (land) => land.pieces.city > 0,
  explorer: (land) => land.pieces.explorer > 0,
  blight: (land) => land.pieces.blight > 0,
};

export function landMatchesTargetList(land, targetList) {
  return targetList.some((t) => targetPredicates[t] && targetPredicates[t](land));
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

export function removePiece(landId, pieceType) {
  const land = boardAState[landId];
  if (land.pieces[pieceType] > 0) {
    land.pieces[pieceType] -= 1;
  }
  renderBoard(boardAState);
}

export function removePresence(landId, spiritId) {
  const land = boardAState[landId];
  if (land.presence[spiritId] > 0) {
    land.presence[spiritId] -= 1;
  }
  renderBoard(boardAState);
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

    Object.entries(land.pieces).forEach(([pieceType, count]) => {
      if (count > 0) {
        const badge = document.createElement("div");
        badge.className = `piece-badge piece-${pieceType}`;
        badge.textContent = pieceLabels[pieceType];
        badge.title = `Click to remove one ${pieceType}`;
        badge.addEventListener("click", () => removePiece(landId, pieceType));

        const countEl = document.createElement("div");
        countEl.className = "piece-count";
        countEl.textContent = count;
        badge.appendChild(countEl);

        piecesEl.appendChild(badge);
      }
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
        badge.title = `Click to remove one ${spirit.name} presence`;
        badge.addEventListener("click", () => removePresence(landId, spiritId));

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

export function landMatchesTerrainButton(land, terrainType) {
  return terrainType === "coastal" ? land.coastal : land.terrain === terrainType;
}

export function landMatchesCard(land, card) {
  return card.terrains.some((t) => landMatchesTerrainButton(land, t));
}

export function hasInvaderBuilding(land) {
  return land.pieces.city > 0 || land.pieces.town > 0;
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
