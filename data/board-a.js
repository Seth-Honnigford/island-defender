// Board A's land data: terrain, coastal status, adjacency, and
// starting invader pieces. `presence` starts empty and is populated
// per-spirit by applySpiritSetup() in spirits.js.
export const boardAState = {
  1: { terrain: "mountain", coastal: true,  adjacent: [2, 4, 5, 6], pieces: { dahan: 0, city: 0, town: 0, blight: 0, explorer: 0 }, presence: {} },
  2: { terrain: "wetland",  coastal: true,  adjacent: [1, 3, 4],    pieces: { dahan: 1, city: 1, town: 0, blight: 0, explorer: 0 }, presence: {} },
  3: { terrain: "jungle",   coastal: true,  adjacent: [2, 4],       pieces: { dahan: 2, city: 0, town: 0, blight: 0, explorer: 0 }, presence: {} },
  4: { terrain: "sands",    coastal: false, adjacent: [1, 2, 3, 5], pieces: { dahan: 0, city: 0, town: 0, blight: 1, explorer: 0 }, presence: {} },
  5: { terrain: "wetland",  coastal: false, adjacent: [1, 4, 6, 7, 8], pieces: { dahan: 0, city: 0, town: 0, blight: 0, explorer: 0 }, presence: {} },
  6: { terrain: "mountain", coastal: false, adjacent: [1, 5, 8],    pieces: { dahan: 1, city: 0, town: 0, blight: 0, explorer: 0 }, presence: {} },
  7: { terrain: "sands",    coastal: false, adjacent: [5, 8],       pieces: { dahan: 2, city: 0, town: 0, blight: 0, explorer: 0 }, presence: {} },
  8: { terrain: "jungle",   coastal: false, adjacent: [5, 6, 7],    pieces: { dahan: 0, city: 0, town: 1, blight: 0, explorer: 0 }, presence: {} },
};

// Tile dimensions (must match the CSS .land width/height)
export const TILE_W = 120;
export const TILE_H = 110;

// Top-left position of each land tile, arranged to roughly mirror the
// physical Board A layout and avoid adjacency-line crossings.
export const landPositions = {
  1: { left: 190, top: 30 },
  6: { left: 350, top: 50 },
  3: { left: 20,  top: 300 },
  2: { left: 20,  top: 160 },
  4: { left: 170, top: 260 },
  5: { left: 300, top: 175 },
  8: { left: 430, top: 170 },
  7: { left: 370, top: 320 },
};
