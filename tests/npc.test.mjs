import test from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./helpers/app.mjs";

const app = loadApp();
const close = (a, b, eps = 1e-6, msg = "") => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} ≠ ${b}`);
const setCfg = o => app.run(`Object.assign(cfg, ${JSON.stringify(o)})`);
const cand = (o = {}) => ({ id: "X", name: "X", npc: 120, bidTop: 100, entry: 100.1, is: 100, ib: 50, asks: [{ p: 100, a: 5 }], ...o });
const instant = (c, budget) => app.eval(`npcInstant(${JSON.stringify(c)}, ${budget})`);
const order = (c, budget) => app.eval(`npcOrder(${JSON.stringify(c)}, ${budget})`);

test("npcInstant : achète les offres moins chères que le PNJ, dans l'ordre du carnet", () => {
  const c = cand({ asks: [{ p: 100, a: 5 }, { p: 105, a: 10 }, { p: 130, a: 20 }] });     // PNJ = 120 : la 3e offre est trop chère
  const r = instant(c, 10000);
  assert.equal(r.units, 15);
  close(r.cost, 5 * 100 + 10 * 105);                          // 1550
  close(r.avg, 1550 / 15);
  close(r.profit, 15 * 120 - 1550);                           // 250 : revente au PNJ sans taxe
  close(r.roi, 250 / 1550);
  assert.deepEqual(r.used, [{ p: 100, a: 5 }, { p: 105, a: 10 }]);
});

test("npcInstant : le budget limite la quantité et arrête la descente du carnet", () => {
  const c = cand({ asks: [{ p: 100, a: 5 }, { p: 105, a: 10 }, { p: 110, a: 10 }] });
  const r = instant(c, 700);                                   // 5 × 100 = 500, reste 200 → 1 × 105
  assert.equal(r.units, 6);
  close(r.cost, 605);
  close(r.profit, 6 * 120 - 605);
});

test("npcInstant : aucune offre rentable → null ; tolérance de 0,05 coin sous le prix PNJ", () => {
  assert.equal(instant(cand({ asks: [{ p: 130, a: 5 }] }), 1e6), null);
  assert.equal(instant(cand({ asks: [{ p: 120, a: 5 }] }), 1e6), null);          // égal au PNJ : aucun gain
  assert.equal(instant(cand({ asks: [{ p: 119.96, a: 5 }] }), 1e6), null);       // dans les 0,05 : arrondi, pas un vrai gain
  assert.equal(instant(cand({ asks: [{ p: 119.9, a: 5 }] }), 1e6).units, 5);
  assert.equal(instant(cand({ asks: [{ p: 100, a: 5 }] }), 50), null);           // budget < 1 unité
});

test("npcOrder : ordre d'achat puis revente au PNJ (valeurs calculées à la main)", () => {
  setCfg({ share: 0.2, cycleH: 1 });
  const r = order(cand(), 1e6);
  // tu captes 20 % de 100 ventes/h = 20/h → plafond de cycle 20 unités → remplies en 1 h
  assert.equal(r.units, 20);
  close(r.cost, 20 * 100.1);
  close(r.tBuy, 1); close(r.tHours, 1);
  close(r.profit, 20 * (120 - 100.1));                         // 398 : aucune taxe au PNJ
  close(r.pph, 398);
  close(r.roi, (120 - 100.1) / 100.1, 1e-12);
  close(r.score, r.pph * Math.pow((100 - r.risk.total) / 100, 2), 1e-9);
});

test("npcOrder : refuse ce qui n'est pas rentable ou pas réalisable", () => {
  setCfg({ share: 0.2, cycleH: 1 });
  assert.equal(order(cand({ npc: 100 }), 1e6), null);          // PNJ ≤ prix d'achat
  assert.equal(order(cand({ is: 0 }), 1e6), null);             // personne ne vend : ton ordre ne se remplira jamais
  assert.equal(order(cand(), 50), null);                       // budget < 1 unité
  const small = order(cand(), 1000);                           // budget-limité : 9 unités
  assert.equal(small.units, 9);
});

test("npcOrder : durée minimale de 15 minutes", () => {
  setCfg({ share: 0.2, cycleH: 1 });
  const r = order(cand({ is: 1000 }), 100.1);                  // 1 unité, remplie en quelques secondes
  assert.equal(r.units, 1);
  assert.equal(r.tHours, 0.25);
});

test("riskNpc : écart énorme, liquidité, prix minuscule et plafond quotidien", () => {
  const risk = (c, roi, tHours, units) => app.eval(`riskNpc(${JSON.stringify(c)}, ${roi}, ${tHours}, ${units})`);
  const calm = risk(cand(), 0.08, 0.25, 10);
  assert.equal(calm.total, 5);
  assert.ok(calm.reasons[0].startsWith("Peu de risques"));
  // écart supérieur à 30 % : le prix PNJ est peut-être faux ou l'item non revendable
  const huge = risk(cand(), 1.0, 0.25, 10);
  assert.ok(huge.total >= 35, `total ${huge.total}`);
  assert.ok(huge.reasons.some(r => r.includes("Écart de 100 %") && r.includes("1 unité")));
  // remplissage très long
  assert.ok(risk(cand(), 0.08, 8, 10).reasons.some(r => r.includes("se remplisse")));
  // prix unitaire minuscule : 0,1 coin pèse beaucoup
  assert.ok(risk(cand({ entry: 3 }), 0.08, 0.25, 10).reasons.some(r => r.includes("Prix unitaire très bas")));
  // plafond quotidien de ventes aux PNJ (~500M/jour) : 600M de revente dépassent l'échelle → facteur au maximum
  const heavy = risk(cand({ npc: 600e6 }), 0.08, 0.25, 1);
  assert.ok(heavy.reasons.some(r => r.includes("plafond quotidien")));
  const light = risk(cand({ npc: 1e6 }), 0.08, 0.25, 10);       // 10M : sous le seuil de 25M
  assert.ok(!light.reasons.some(r => r.includes("plafond quotidien")));
  assert.ok(heavy.total > light.total);
});

test("riskNpc : monotone avec l'écart et borné entre 5 et 100", () => {
  const totals = [0.05, 0.3, 0.5, 1, 3].map(roi => app.eval(`riskNpc(${JSON.stringify(cand())}, ${roi}, 8, 1000).total`));
  for (let i = 1; i < totals.length; i++) assert.ok(totals[i] >= totals[i - 1], `non monotone : ${totals}`);
  for (const t of totals) assert.ok(t >= 5 && t <= 100);
});
