// Logique pure du planning du Jacob's Contest (séparée du réseau pour pouvoir être testée).

// Chaque source décrit comment lire sa réponse. `t` est toujours en millisecondes.
export const SOURCES = [
  {
    name: "jacobs.strassburger.dev",
    url: "https://jacobs.strassburger.dev/api/jacobcontests",
    parse: a => a.map(x => ({ t: x.timestamp, crops: x.cropNames })),
  },
  {
    name: "api.elitebot.dev",
    url: "https://api.elitebot.dev/contests/at/now",
    parse: j => Object.entries(j.contests).map(([s, crops]) => ({ t: Number(s) * 1000, crops })),   // clés en secondes
  },
];

// un concours valide : une date finie et exactement 3 cultures (chaînes)
export const isValid = c =>
  !!c && Number.isFinite(c.t) && Array.isArray(c.crops) && c.crops.length === 3 && c.crops.every(x => typeof x === "string" && x.length > 0);

// concours à venir (avec 1 h de tolérance pour celui qui vient de commencer), triés ; refuse un planning trop court
export function upcoming(contests, now = Date.now(), min = 3) {
  const from = now - 3600e3;
  const list = contests.filter(isValid).filter(c => c.t >= from).sort((a, b) => a.t - b.t);
  if (list.length < min) throw new Error("planning vide ou trop court");
  return list;
}
