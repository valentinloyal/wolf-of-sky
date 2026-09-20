// Récupère le planning du Jacob's Farming Contest (dates + 3 cultures) et l'écrit en JSON sur stdout.
// Exécuté côté serveur par le workflow GitHub Actions (les API sources n'autorisent pas les appels depuis un navigateur).
// Sources, dans l'ordre : jacobs.strassburger.dev (réutilisation autorisée avec mention de la source), puis api.elitebot.dev en secours.

const SOURCES = [
  {
    name: "jacobs.strassburger.dev",
    url: "https://jacobs.strassburger.dev/api/jacobcontests",
    parse: a => a.map(x => ({ t: x.timestamp, crops: x.cropNames })),
  },
  {
    name: "api.elitebot.dev",
    url: "https://api.elitebot.dev/contests/at/now",
    parse: j => Object.entries(j.contests).map(([s, crops]) => ({ t: Number(s) * 1000, crops })),
  },
];

const valid = c => Number.isFinite(c.t) && Array.isArray(c.crops) && c.crops.length === 3 && c.crops.every(x => typeof x === "string");

async function fromSource(src) {
  const res = await fetch(src.url, { headers: { "User-Agent": "wolf-of-sky-pages (github.com/valentinloyal/wolf-of-sky)" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contests = src.parse(await res.json()).filter(valid);
  const from = Date.now() - 3600e3;
  const upcoming = contests.filter(c => c.t >= from).sort((a, b) => a.t - b.t);
  if (upcoming.length < 3) throw new Error("planning vide ou trop court");
  return upcoming;
}

let out = { generatedAt: Date.now(), source: null, contests: [] };
for (const src of SOURCES) {
  try {
    out = { generatedAt: Date.now(), source: src.name, contests: await fromSource(src) };
    break;
  } catch (e) {
    console.error(`[fetch-contests] ${src.name} : ${e.message}`);
  }
}
console.log(JSON.stringify(out));
