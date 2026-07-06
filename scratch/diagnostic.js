const { PLAYERS } = require('../lib/data/players.ts');

const names = [
  "Finn Allen",
  "Angkrish Raghuvanshi",
  "Rahul Tripathi",
  "Sarfaraz Khan",
  "Sunil Narine",
  "Anukul Roy",
  "Rinku Singh",
  "Sam Curran",
  "Ramandeep Singh",
  "Matheesha Pathirana",
  "Mohammed Siraj",
  "Varun Chakravarthy"
];

const selected = names.map(name => {
  const p = PLAYERS.find(pl => pl.name.toLowerCase() === name.toLowerCase());
  return p;
}).filter(Boolean);

console.log("Selected players attributes:");
selected.forEach(p => {
  console.log(`${p.name}: rating=${Math.max(p.currentBatting || 0, p.currentBowling || 0)}, batRating=${p.currentBatting}, bowlRating=${p.currentBowling}, isOpener=${p.isOpener}, isFinisher=${p.isFinisher}, isCore=${p.isCoreBatter}, prefers3=${p.hasBattedAt3}, prefers4=${p.hasBattedAt4}, prefers5=${p.hasBattedAt5}, prefers6=${p.hasBattedAt6}, prefers7=${p.hasBattedAt7}`);
});
