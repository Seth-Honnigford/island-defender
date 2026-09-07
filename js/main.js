import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { boardAState, renderBoard } from "./board.js";
import { applySpiritSetup, activeSpiritId, renderEnergyBadge } from "./spirits.js";
import { renderInvaderTrack } from "./invaders.js";
import { renderPileIcons, renderPileCounts, renderPlayedCardsRow } from "./cards.js";
import { renderPhaseTrack, updatePhaseHighlight } from "./phases.js";

// TODO: paste your Firebase project config here
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
// Board state will be wired up to Firebase in a later step.

// =========================================================
// INITIAL SETUP & RENDER
// =========================================================
applySpiritSetup(activeSpiritId);
renderBoard(boardAState);
renderInvaderTrack();
renderEnergyBadge();
renderPileIcons();
renderPileCounts();
renderPlayedCardsRow();
renderPhaseTrack();
updatePhaseHighlight();
