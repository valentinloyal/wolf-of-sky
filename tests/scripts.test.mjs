// Logique des scripts exécutés par le workflow (fetch-contests / fetch-npc), testée sans réseau.
import test from "node:test";
import assert from "node:assert/strict";
import { SOURCES, isValid, upcoming } from "../scripts/lib/contests.mjs";
import { buildNpcItems } from "../scripts/lib/npc.mjs";

const HOUR = 3600e3;

test("planning Jacob : la source principale (strassburger) est lue, dates déjà en millisecondes", () => {
  const src = SOURCES[0];
  assert.equal(src.name, "jacobs.strassburger.dev");
  const out = src.parse([{ timestamp: 1789899300000, crops: [3, 4, 9], cropNames: ["Melon", "Mushroom", "Wheat"] }]);
  assert.deepEqual(out, [{ t: 1789899300000, crops: ["Melon", "Mushroom", "Wheat"] }]);
});

test("planning Jacob : la source de secours (elitebot) convertit les secondes en millisecondes", () => {
  const src = SOURCES[1];
  assert.equal(src.name, "api.elitebot.dev");
  const out = src.parse({ year: 515, contests: { "1789726500": ["Carrot", "Moonflower", "Wild Rose"], "1789730100": ["Cocoa Beans", "Melon", "Pumpkin"] } });
  assert.deepEqual(out, [
    { t: 1789726500000, crops: ["Carrot", "Moonflower", "Wild Rose"] },
    { t: 1789730100000, crops: ["Cocoa Beans", "Melon", "Pumpkin"] },
  ]);
  // le résultat est bien un instant valide : 18 sept. 2026 10:15 UTC (heure de départ des concours)
  assert.equal(new Date(out[0].t).toISOString(), "2026-09-18T10:15:00.000Z");
});

test("planning Jacob : un concours doit avoir une date valide et exactement 3 cultures", () => {
  const ok = { t: 1e12, crops: ["A", "B", "C"] };
  assert.equal(isValid(ok), true);
  for (const bad of [null, undefined, {}, { t: NaN, crops: ["A", "B", "C"] }, { t: "1e12", crops: ["A", "B", "C"] }, { t: 1e12, crops: ["A", "B"] },
    { t: 1e12, crops: ["A", "B", "C", "D"] }, { t: 1e12, crops: ["A", "B", 3] }, { t: 1e12, crops: ["A", "B", ""] }, { t: 1e12, crops: "ABC" }, { t: Infinity, crops: ["A", "B", "C"] }]) {
    assert.equal(isValid(bad), false, JSON.stringify(bad));
  }
});

test("planning Jacob : garde les concours à venir (1 h de tolérance), triés, sans les invalides", () => {
  const now = 1_000_000 * HOUR;
  const c = (dh, crops = ["A", "B", "C"]) => ({ t: now + dh * HOUR, crops });
  const list = upcoming([c(5), c(-3), c(1), c(-0.5), c(2, ["A"]), c(0)], now);
  assert.deepEqual(list.map(x => (x.t - now) / HOUR), [-0.5, 0, 1, 5]);          // -3 h est passé ; le concours à -0,5 h vient de commencer ; celui à 3 cultures manquantes est écarté
});

test("planning Jacob : refuse un planning trop court plutôt que de publier du vide", () => {
  const now = 1_000_000 * HOUR;
  assert.throws(() => upcoming([], now), /trop court/);
  assert.throws(() => upcoming([{ t: now + HOUR, crops: ["A", "B", "C"] }, { t: now + 2 * HOUR, crops: ["A", "B", "C"] }], now), /trop court/);
  assert.equal(upcoming([1, 2, 3].map(h => ({ t: now + h * HOUR, crops: ["A", "B", "C"] })), now).length, 3);
  assert.equal(upcoming([{ t: now + HOUR, crops: ["A", "B", "C"] }], now, 1).length, 1);   // seuil réglable
});

// ---------------------------------------------------------------------------------------------
const items = list => ({ success: true, items: list });
const bazaar = ids => ({ success: true, products: Object.fromEntries(ids.map(i => [i, {}])) });

test("prix PNJ : ne garde que les items avec un prix > 0 ET un marché au Bazaar", () => {
  const out = buildNpcItems(
    items([
      { id: "COAL", name: "Coal", npc_sell_price: 2 },
      { id: "SWORD", name: "Épée", npc_sell_price: 100 },        // pas au Bazaar
      { id: "GEM", name: "Gem", npc_sell_price: 0 },             // prix nul
      { id: "OLD", name: "Old" },                                // pas de prix PNJ
      { id: "NEG", name: "Neg", npc_sell_price: -5 },
    ]),
    bazaar(["COAL", "GEM", "OLD", "NEG"]),
    { minItems: 1 },
  );
  assert.deepEqual(out, { COAL: { n: "Coal", p: 2 } });
});

test("prix PNJ : refuse une source vide ou suspecte au lieu de publier un fichier vide", () => {
  assert.throws(() => buildNpcItems(items([]), bazaar([])), /trop peu d'items/);
  assert.throws(() => buildNpcItems(items([{ id: "A", name: "A", npc_sell_price: 1 }]), bazaar(["A"])), /trop peu d'items/);   // 1 < 100 par défaut
  assert.throws(() => buildNpcItems({ success: false }, bazaar([])), /invalide/);
  assert.throws(() => buildNpcItems(items([]), { success: false }), /invalide/);
  assert.throws(() => buildNpcItems(null, null), /invalide/);
  const many = Array.from({ length: 100 }, (_, i) => ({ id: `I${i}`, name: `Item ${i}`, npc_sell_price: 1 }));
  assert.equal(Object.keys(buildNpcItems(items(many), bazaar(many.map(m => m.id)))).length, 100);     // la limite elle-même passe
});
