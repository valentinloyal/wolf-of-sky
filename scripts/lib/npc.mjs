// Logique pure des prix de revente au PNJ (séparée du réseau pour pouvoir être testée).
//   npc_sell_price = ce que le PNJ paie pour une unité (aucune taxe, contrairement au Bazaar).

// items   : réponse de /v2/resources/skyblock/items
// bazaar  : réponse de /skyblock/bazaar
// On ne garde que les items qui ont un prix PNJ positif ET un marché au Bazaar.
export function buildNpcItems(items, bazaar, { minItems = 100 } = {}) {
  if (!items || !bazaar || !items.success || !bazaar.success) throw new Error("réponse Hypixel invalide");
  const out = {};
  for (const it of items.items || []) {
    if (it.npc_sell_price > 0 && bazaar.products && bazaar.products[it.id]) out[it.id] = { n: it.name, p: it.npc_sell_price };
  }
  if (Object.keys(out).length < minItems) throw new Error("trop peu d'items : source suspecte");
  return out;
}
