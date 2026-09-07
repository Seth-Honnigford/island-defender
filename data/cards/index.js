// Aggregates every individual card file into one lookup object keyed
// by card id. To add a new card: create its own file in this folder
// (following the same shape as the examples), then import + register
// it below. No other engine code needs to change.
import { card as exampleFastPower } from "./example-fast-power.js";
import { card as exampleSlowPower } from "./example-slow-power.js";

export const cardDefinitions = {
  [exampleFastPower.id]: exampleFastPower,
  [exampleSlowPower.id]: exampleSlowPower,
};
