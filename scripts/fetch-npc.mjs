// Extrait les prix de revente au PNJ des items vendus au Bazaar et les écrit en JSON sur stdout.
// Exécuté côté serveur par le workflow GitHub Actions : le fichier source d'Hypixel fait ~5 Mo, on n'en garde que
// l'essentiel (~40 Ko) pour que la page reste légère.
// La logique (filtrage, contrôle de vraisemblance) est dans lib/npc.mjs et testée.
import { buildNpcItems } from "./lib/npc.mjs";

const ITEMS = "https://api.hypixel.net/v2/resources/skyblock/items";
const BAZAAR = "https://api.hypixel.net/skyblock/bazaar";

const get = async url => {
  const res = await fetch(url, { headers: { "User-Agent": "wolf-of-sky-pages (github.com/valentinloyal/wolf-of-sky)" }, signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw new Error(`${url} : HTTP ${res.status}`);
  return res.json();
};

let out = { generatedAt: Date.now(), items: {} };
try {
  const [items, bazaar] = await Promise.all([get(ITEMS), get(BAZAAR)]);
  out.items = buildNpcItems(items, bazaar);
} catch (e) {
  console.error(`[fetch-npc] ${e.message}`);
  out = { generatedAt: Date.now(), items: {} };   // la page retombera sur son propre chargement de secours
}
console.log(JSON.stringify(out));
