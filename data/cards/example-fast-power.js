export const card = {
  id: "example-fast-power",
  name: "Example Fast Power",
  image: "Card Images/Example Fast Power.jpg",
  speed: "fast",
  cost: 1,
  range: 1,
  sacredSite: true,
  target: ["dahan"],
  effects: [
    { type: "damage", amount: 1 },
    { type: "push", pieceType: "dahan", count: 1 },
  ],
};
