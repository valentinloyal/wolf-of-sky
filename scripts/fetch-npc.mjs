// Extrait les prix de revente au PNJ des items vendus au Bazaar et les écrit en JSON sur stdout.
// Exécuté côté serveur par le workflow GitHub Actions : le fichier source d'Hypixel fait ~5 Mo, on n'en garde que
// l'essentiel (~50 Ko) pour que la page reste légère.
//   npc_sell_price = ce que le PNJ paie pour une unité de l'item (aucune taxe, contrairement au Bazaar).

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
  if (!items.success || !bazaar.success) throw new Error("réponse Hypixel invalide");
  for (const it of items.items) {
    if (it.npc_sell_price > 0 && bazaar.products[it.id]) out.items[it.id] = { n: it.name, p: it.npc_sell_price };
  }
  if (Object.keys(out.items).length < 100) throw new Error("trop peu d'items : source suspecte");
} catch (e) {
  console.error(`[fetch-npc] ${e.message}`);
  out = { generatedAt: Date.now(), items: {} };   // la page retombera sur son propre chargement de secours
}
console.log(JSON.stringify(out));
