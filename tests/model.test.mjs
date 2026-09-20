import test from "node:test";
import assert from "node:assert/strict";
import { loadApp, product } from "./helpers/app.mjs";

const app = loadApp();
const close = (a, b, eps = 1e-6, msg = "") => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} ≠ ${b} (±${eps})`);
const setCfg = o => app.run(`Object.assign(cfg, ${JSON.stringify(o)})`);
const DEFAULTS = { tax: 0.0125, share: 0.2, cycleH: 1, minVol: 20, maxRisk: 50, q: "" };
const build = (products, npc = {}) => { app.run(`bzMap = {}; npcMap = ${JSON.stringify(npc)};`); return app.eval(`buildBases(${JSON.stringify(products)})`); };
const load = products => { app.run(`bases = buildBases(${JSON.stringify(products)})`); };

// ---------------------------------------------------------------------------------------------
// Construction des prix : ce qu'on paie et ce qu'on touche réellement quand on pose des ordres
// ---------------------------------------------------------------------------------------------
test("buildBases : ordre d'achat = meilleur ordre + 0,1 ; offre de vente = meilleure offre − 0,1", () => {
  const [b] = build({ X: product("X", { bids: [[1000, 50], [990, 10]], asks: [[1200, 50], [1210, 5]] }) });
  assert.equal(b.entry, 1000.1);
  assert.equal(b.exit, 1199.9);
  assert.equal(b.bidTop, 1000);
  assert.equal(b.askTop, 1200);
  close(b.grossPct, 1199.9 / 1000.1 - 1, 1e-12);
});

test("buildBases : volumes par heure = volume de la semaine ÷ 168, et ils remplissent le bon côté", () => {
  // sellMovingWeek = ventes instantanées (elles remplissent TON ordre d'achat) ; buyMovingWeek = achats instantanés (remplissent TA vente)
  const [b] = build({ X: product("X", { bids: [[1000, 50]], asks: [[1200, 50]], sellWeek: 16800, buyWeek: 8400 }) });
  assert.equal(b.is, 100);
  assert.equal(b.ib, 50);
});

test("buildBases : écarte ce qui ne peut pas donner un flip", () => {
  const cases = {
    "pas d'ordres d'achat": product("A", { bids: [], asks: [[1200, 5]] }),
    "pas d'offres de vente": product("B", { bids: [[1000, 5]], asks: [] }),
    "carnet croisé (achat ≥ vente)": product("C", { bids: [[1000, 5]], asks: [[999, 5]] }),
    "écart d'un seul tick (pas de place pour deux ordres)": product("D", { bids: [[1000, 5]], asks: [[1000.1, 5]] }),
    "aucune vente instantanée": product("E", { bids: [[1000, 5]], asks: [[1200, 5]], sellWeek: 0 }),
    "aucun achat instantané": product("F", { bids: [[1000, 5]], asks: [[1200, 5]], buyWeek: 0 }),
  };
  for (const [why, p] of Object.entries(cases)) assert.equal(build({ [p.product_id]: p }).length, 0, why);
});

test("buildBases : un livre d'enchantement prend son nom de jeu", () => {
  const id = "ENCHANTMENT_ULTIMATE_SUNSET_1";
  const [b] = build({ [id]: product(id, { bids: [[1000, 5]], asks: [[1200, 5]] }) });
  assert.equal(b.name, "Sunset I");
  assert.equal(b.search, "Sunset");
});

test("buildBases : les candidats PNJ sont construits AVANT les filtres de spread", () => {
  // un item dont le carnet est croisé n'est pas un flip Bazaar, mais peut rester un flip PNJ
  const p = product("NPCX", { bids: [[1000, 5]], asks: [[999, 5]] });
  const bases = build({ NPCX: p }, { NPCX: { n: "Npc X", p: 1500 } });
  assert.equal(bases.length, 0);
  const cands = app.eval("npcBases");
  assert.equal(cands.length, 1);
  assert.equal(cands[0].npc, 1500);
  assert.equal(cands[0].entry, 1000.1);
});

// ---------------------------------------------------------------------------------------------
// derive : profit, quantité, durées
// ---------------------------------------------------------------------------------------------
const FIX = () => {
  setCfg(DEFAULTS);
  app.run(`bzMap = {}; npcMap = {}; globalThis.__b = buildBases(${JSON.stringify({ X: product("X", { bids: [[1000, 50]], asks: [[1200, 50]], sellWeek: 16800, buyWeek: 8400 }) })})[0];`);
};

test("derive : profit, quantité et durées (valeurs calculées à la main)", () => {
  FIX();
  const d = app.eval("derive(__b, 1e6)");
  // net/unité = 1199,9 × (1 − 1,25 %) − 1000,1 = 184,80125
  close(d.net, 184.80125, 1e-9); close(d.roi, 184.80125 / 1000.1, 1e-12);
  // tu captes 20 % du flux : 20 achats/h remplis, 10 ventes/h. Plafond de cycle 1 h → min(20, 10) × 1 = 10 unités.
  assert.equal(d.cap, 10); assert.equal(d.units, 10);
  close(d.tBuy, 0.5); close(d.tSell, 1); close(d.tHours, 1.5);
  close(d.profit, 1848.0125, 1e-9); close(d.pph, 1232.008333, 1e-6);
  close(d.invested, 10001, 1e-9);
  assert.equal(d.limitedBy, "marché");
});

test("derive : le budget peut limiter la quantité", () => {
  FIX();
  const d = app.eval("derive(__b, 3000)");          // 3000 / 1000,1 = 2 unités
  assert.equal(d.units, 2);
  assert.equal(d.limitedBy, "budget");
});

test("derive : un cycle dure au moins 15 minutes (le temps de gérer ses ordres)", () => {
  FIX();
  const d = app.eval("derive(__b, 1100)");          // 1 unité : 0,05 h + 0,1 h = 0,15 h < 0,25 h
  assert.equal(d.units, 1);
  assert.equal(d.tHours, 0.25);
});

test("derive : trop cher pour le budget → tooExpensive ; marge nulle après taxe → null", () => {
  FIX();
  const d = app.eval("derive(__b, 500)");
  assert.equal(d.tooExpensive, true);
  const [tight] = build({ T: product("T", { bids: [[1000, 5]], asks: [[1010, 5]] }) });   // 1009,9 × 0,9875 = 997,3 < 1000,1
  app.run(`globalThis.__t = ${JSON.stringify(tight)}`);
  assert.equal(app.eval("derive(__t, 1e6)"), null);
});

test("derive : la taxe réduit le profit, la part de marché raccourcit les durées", () => {
  FIX();
  const base = app.eval("derive(__b, 1e9)");
  setCfg({ tax: 0.01 });
  const lowTax = app.eval("derive(__b, 1e9)");
  assert.ok(lowTax.net > base.net);
  close(lowTax.net, 1199.9 * 0.99 - 1000.1, 1e-9);
  setCfg({ tax: 0.0125, share: 0.4 });
  const big = app.eval("derive(__b, 1e9)");
  assert.equal(big.cap, 20);                                    // deux fois plus d'unités traitables dans le cycle
  close(big.tBuy, base.tBuy, 1e-9);                            // mais durée inchangée : le flux double aussi
  setCfg({ share: 0.2, cycleH: 2 });
  assert.equal(app.eval("derive(__b, 1e9)").cap, 20);          // cycle plus long → plus de quantité
});

// ---------------------------------------------------------------------------------------------
// Score de risque : conformité à la formule documentée dans le guide
// ---------------------------------------------------------------------------------------------
// Oracle indépendant : 4 facteurs (30/25/20/25 %), le maillon faible pèse 40 %, plancher de 5.
function specRisk({ gross, outlier, tHours, roi, ib, is }) {
  const c01 = x => Math.max(0, Math.min(1, x));
  const manip = Math.max(c01((gross - 0.15) / 0.4), c01((outlier - 0.02) / 0.13)) * 100;
  const liq = c01(Math.log(tHours / 0.25) / Math.log(16)) * 100;
  const fragile = c01((0.08 - roi) / 0.075) * 100;
  const volat = c01((Math.abs(Math.log(ib / is)) - Math.log(1.3)) / (Math.log(4) - Math.log(1.3))) * 100;
  const weighted = 0.3 * manip + 0.25 * liq + 0.2 * fragile + 0.25 * volat;
  return { total: Math.max(5, Math.round(0.6 * weighted + 0.4 * Math.max(manip, liq, fragile, volat))), parts: { manip, liq, fragile, volat } };
}

test("computeRisk : identique à la formule documentée sur 720 combinaisons", () => {
  const combos = [];
  for (const gross of [0.05, 0.2, 0.5, 1])
    for (const outlier of [0, 0.05, 0.2])
      for (const tHours of [0.25, 0.5, 1, 3, 8])
        for (const roi of [0.01, 0.03, 0.1])
          for (const r of [0.5, 1, 2, 5]) combos.push({ gross, outlier, tHours, roi, ib: 100 * r, is: 100 });
  const got = app.eval(`(${JSON.stringify(combos)}).map(c => {
    const b = {id: "NOHIST", grossPct: c.gross, outlier: c.outlier, ib: c.ib, is: c.is, entry: 1000, exit: 1200};
    const r = computeRisk(b, {roi: c.roi, tHours: c.tHours, units: 1});
    return {total: r.total, parts: r.parts};
  })`);
  assert.equal(got.length, 720);
  combos.forEach((c, i) => {
    const want = specRisk(c);
    assert.equal(got[i].total, want.total, JSON.stringify(c));
    for (const k of Object.keys(want.parts)) close(got[i].parts[k], want.parts[k], 1e-6, `${k} ${JSON.stringify(c)}`);
  });
});

test("computeRisk : valeurs de référence et raisons affichées", () => {
  const mk = (over) => app.eval(`computeRisk(${JSON.stringify({ id: "NOHIST", grossPct: 0.2, outlier: 0, ib: 50, is: 100, entry: 1000, exit: 1200, ...over.b })}, ${JSON.stringify({ roi: 0.18, tHours: 1.5, units: 10, ...over.d })})`);
  const healthy = mk({ b: {}, d: {} });
  assert.equal(healthy.total, specRisk({ gross: 0.2, outlier: 0, tHours: 1.5, roi: 0.18, ib: 50, is: 100 }).total);
  // marge « trop belle » : signalée comme suspecte
  const trap = mk({ b: { grossPct: 0.9 }, d: {} });
  assert.equal(trap.parts.manip, 100);
  assert.ok(trap.reasons.some(r => r.includes("Marge brute de 90 %")), trap.reasons.join(" | "));
  // marge nette minuscule : fragile
  const thin = mk({ b: {}, d: { roi: 0.01 } });
  assert.ok(thin.parts.fragile > 90);
  assert.ok(thin.reasons.some(r => r.includes("Marge nette de seulement")));
  // cycle très long : liquidité
  assert.ok(mk({ b: {}, d: { tHours: 6 } }).parts.liq > 90);
});

test("computeRisk : plancher de 5, plafond de 100, et monotone (plus de défauts → plus de risque)", () => {
  const calm = app.eval(`computeRisk({id:"NOHIST",grossPct:0.05,outlier:0,ib:100,is:100}, {roi:0.2,tHours:0.25,units:1}).total`);
  assert.equal(calm, 5);
  const worst = app.eval(`computeRisk({id:"NOHIST",grossPct:2,outlier:1,ib:1000,is:10}, {roi:0,tHours:40,units:1}).total`);
  assert.equal(worst, 100);
  const totals = [0.25, 0.5, 1, 2, 4, 8].map(t => app.eval(`computeRisk({id:"NOHIST",grossPct:0.1,outlier:0,ib:100,is:100}, {roi:0.1,tHours:${t},units:1}).total`));
  for (let i = 1; i < totals.length; i++) assert.ok(totals[i] >= totals[i - 1], `non monotone : ${totals}`);
});

test("derive : score = profit/h × ((100 − risque) / 100)², un risque élevé écrase le score", () => {
  FIX();
  const d = app.eval("derive(__b, 1e6)");
  close(d.score, d.pph * Math.pow((100 - d.risk.total) / 100, 2), 1e-9);
  assert.ok(d.score < d.pph);
});

// ---------------------------------------------------------------------------------------------
// candidates : les filtres de l'utilisateur
// ---------------------------------------------------------------------------------------------
test("candidates : volume minimum, risque max, recherche et budget", () => {
  setCfg(DEFAULTS);
  load({
    GOOD: product("GOOD", { bids: [[1000, 50]], asks: [[1120, 50]], sellWeek: 168 * 500, buyWeek: 168 * 500 }),        // liquide, marge ~ 11 %
    THIN: product("THIN", { bids: [[1000, 50]], asks: [[1120, 50]], sellWeek: 168 * 5, buyWeek: 168 * 5 }),           // 5 échanges/h
    TRAP: product("TRAP", { bids: [[1000, 50]], asks: [[3000, 50]], sellWeek: 168 * 500, buyWeek: 168 * 500 }),       // +200 % : piège
    ROCK: product("ROCK", { bids: [[9e8, 5]], asks: [[9.5e8, 5]], sellWeek: 168 * 500, buyWeek: 168 * 500 }),         // hors budget
  });
  const ids = (budget, o = "") => app.eval(`candidates(${budget}${o}).map(d => d.b.id).sort()`);
  assert.deepEqual(ids(1e6), ["GOOD"]);                                   // THIN < 20/h, TRAP > risque 50, ROCK trop cher
  setCfg({ minVol: 5 });
  assert.deepEqual(ids(1e6), ["GOOD", "THIN"]);                           // volume min abaissé
  assert.deepEqual(ids(1e6, ", {ignoreRisk: true}"), ["GOOD", "THIN", "TRAP"]);
  setCfg({ minVol: 20, q: "goo" });
  assert.deepEqual(ids(1e6, ", {ignoreRisk: true}"), ["GOOD"]);           // recherche par nom
  setCfg({ q: "" });
  assert.deepEqual(ids(1e12, ", {ignoreRisk: true}"), ["GOOD", "ROCK", "TRAP"]);   // avec un très gros budget ROCK devient abordable
  setCfg(DEFAULTS);
});
