// Récupère le planning du Jacob's Farming Contest (dates + 3 cultures) et l'écrit en JSON sur stdout.
// Exécuté côté serveur par le workflow GitHub Actions (les API sources n'autorisent pas les appels depuis un navigateur).
// Sources, dans l'ordre : jacobs.strassburger.dev (réutilisation autorisée avec mention de la source), puis api.elitebot.dev en secours.
// La logique (lecture des formats, validation) est dans lib/contests.mjs et testée.
import { SOURCES, upcoming } from "./lib/contests.mjs";

async function fromSource(src) {
  const res = await fetch(src.url, { headers: { "User-Agent": "wolf-of-sky-pages (github.com/valentinloyal/wolf-of-sky)" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return upcoming(src.parse(await res.json()));
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
