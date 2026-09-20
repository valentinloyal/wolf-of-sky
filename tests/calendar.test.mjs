import test from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./helpers/app.mjs";

const app = loadApp();
const ev = code => app.eval(code);

// Constantes du calendrier SkyBlock (wiki) : recopiées ICI, volontairement indépendantes du code testé.
const EPOCH = Date.UTC(2019, 5, 11, 17, 55, 0);          // 11 juin 2019, 17:55 UTC = début de l'année 1
const SB_DAY = 20 * 60e3;                                  // 1 jour SkyBlock = 20 min réelles
const SB_YEAR = 372 * SB_DAY;                              // 12 mois × 31 jours = 124 h
const DAY = 86400e3;

test("l'époque et la durée d'une année correspondent aux constantes du wiki", () => {
  assert.equal(EPOCH, 1560275700000);
  assert.equal(SB_YEAR, 124 * 3600e3);
  assert.deepEqual(ev(`sbDate(${EPOCH})`), { year: 1, month: 0, day: 1 });
});

test("sbDate : jour, mois et année aux bornes", () => {
  assert.deepEqual(ev(`sbDate(${EPOCH + SB_DAY - 1})`), { year: 1, month: 0, day: 1 });      // dernière ms du jour 1
  assert.deepEqual(ev(`sbDate(${EPOCH + SB_DAY})`), { year: 1, month: 0, day: 2 });
  assert.deepEqual(ev(`sbDate(${EPOCH + 31 * SB_DAY})`), { year: 1, month: 1, day: 1 });     // 1er jour du 2e mois
  assert.deepEqual(ev(`sbDate(${EPOCH + 372 * SB_DAY - 1})`), { year: 1, month: 11, day: 31 });
  assert.deepEqual(ev(`sbDate(${EPOCH + SB_YEAR})`), { year: 2, month: 0, day: 1 });
});

test("sbTime et sbDate sont inverses l'un de l'autre", () => {
  for (const [y, m, d] of [[1, 0, 1], [515, 7, 29], [514, 11, 31], [300, 3, 15], [2, 5, 27]]) {
    const t = ev(`sbTime(${y}, ${m}, ${d})`);
    assert.equal(t, EPOCH + (y - 1) * SB_YEAR + (m * 31 + d - 1) * SB_DAY, `sbTime(${y},${m},${d})`);
    assert.deepEqual(ev(`sbDate(${t})`), { year: y, month: m, day: d });
  }
});

test("le prochain Spooky Festival (année 515, 29 Automne) tombe le 21 septembre 2026 à 19:35 UTC", () => {
  // valeur relevée pendant le développement et recoupée avec le calcul du wiki (Automne = mois 8, index 7)
  assert.equal(ev("sbTime(515, 7, 29)"), Date.UTC(2026, 8, 21, 19, 35, 0));
});

test("evStarts / evNext : Spooky Festival dure 3 jours SkyBlock = 1 heure réelle", () => {
  const start = Date.UTC(2026, 8, 21, 19, 35);
  const spooky = "EVENTS.find(e => e.key === 'spooky')";
  assert.equal(ev(`${spooky}.days * SB_DAY`), 3600e3);
  // 1 h avant : pas en cours, la prochaine occurrence est celle-ci
  const before = ev(`evNext(${spooky}, ${start - 3600e3})`);
  assert.equal(before.live, false); assert.equal(before.start, start); assert.equal(before.end, start + 3600e3);
  // pendant : en cours
  assert.equal(ev(`evNext(${spooky}, ${start + 10 * 60e3})`).live, true);
  // juste après la fin : la suivante est dans une année SkyBlock (124 h)
  const after = ev(`evNext(${spooky}, ${start + 3600e3 + 1})`);
  assert.equal(after.live, false); assert.equal(after.start, start + SB_YEAR);
});

test("les événements qui reviennent deux fois par an : Traveling Zoo et élections", () => {
  for (const key of ["zoo", "election"]) {
    const from = EPOCH + 300 * SB_YEAR;
    const starts = ev(`evStarts(EVENTS.find(e => e.key === '${key}'), ${from}, ${from + SB_YEAR - 1})`);
    assert.equal(starts.length, 2, key);
  }
  const zoo = ev("EVENTS.find(e => e.key === 'zoo').starts");
  assert.deepEqual(zoo, [[3, 1], [9, 1]]);                   // Début de l'Été 1 et Début de l'Hiver 1
});

test("Jacob's Contest : un concours par heure réelle, à hh:15 UTC, pendant 20 minutes", () => {
  const jacob = "EVENTS.find(e => e.key === 'jacob')";
  // départ connu du planning communautaire (année 515) : 18 sept. 2026 10:15 UTC = 1789726500 s
  const known = 1789726500e3;
  assert.equal(new Date(known).getUTCMinutes(), 15);
  const starts = ev(`evStarts(${jacob}, ${known - 3600e3}, ${known + 6 * 3600e3})`);
  assert.ok(starts.includes(known), "le concours connu doit faire partie du planning calculé");
  for (const t of starts) assert.equal(new Date(t).getUTCMinutes(), 15);
  for (let i = 1; i < starts.length; i++) assert.equal(starts[i] - starts[i - 1], 3600e3);
  // en cours 10 min après le début ; terminé 25 min après (le concours dure 20 min)
  assert.equal(ev(`evNext(${jacob}, ${known + 10 * 60e3})`).live, true);
  const done = ev(`evNext(${jacob}, ${known + 25 * 60e3})`);
  assert.equal(done.live, false); assert.equal(done.start, known + 3600e3);
  assert.equal(ev(`evNext(${jacob}, ${known}).end - evNext(${jacob}, ${known}).start`), 20 * 60e3);
});

test("les événements longs (Hoppity, Harvest Feast) durent 93 jours SkyBlock = 31 h réelles", () => {
  for (const key of ["hoppity", "harvest"]) {
    const [days, long] = ev(`[EVENTS.find(e => e.key === '${key}').days, EVENTS.find(e => e.key === '${key}').long]`);
    assert.equal(days, 93); assert.equal(long, true);
    assert.equal(days * SB_DAY, 31 * 3600e3);
  }
});

// ---------------------------------------------------------------------------------------------
// Mesure de l'effet d'un événement sur le prix (série quotidienne synthétique)
// ---------------------------------------------------------------------------------------------
const spookyStart = y => EPOCH + (y - 1) * SB_YEAR + (7 * 31 + 28) * SB_DAY;   // oracle indépendant

// série quotidienne : prix stable à 100 ; le jour contenant un Spooky Festival, le maximum monte de `spike`
function daily({ days = 400, spike = 0, jitter = 0, endDaysAgo = 30 }) {
  const end = Math.floor((Date.now() - endDaysAgo * DAY) / DAY) * DAY;
  const t0 = end - days * DAY;
  const y0 = Math.floor((t0 - EPOCH) / SB_YEAR) + 1;
  const evDays = new Set();
  for (let y = y0 - 1; y <= y0 + Math.ceil((days * DAY) / SB_YEAR) + 2; y++) evDays.add(Math.floor(spookyStart(y) / DAY));
  const out = [];
  for (let i = 0; i < days; i++) {
    const t = t0 + i * DAY, hit = evDays.has(t / DAY);
    const wobble = jitter ? 1 + jitter * Math.sin(i * 1.7) : 1;
    out.push({ t, buy: 110 * wobble, sell: 100 * wobble, maxSell: 100 * wobble * (hit ? 1 + spike : 1), maxBuy: 110 * wobble });
  }
  return out;
}
const effect = series => ev(`eventEffect(${JSON.stringify(series)}, EVENTS.find(e => e.key === 'spooky'))`);

test("eventEffect : détecte un pic de +30 % le jour du Spooky Festival", () => {
  const r = effect(daily({ spike: 0.3 }));
  assert.ok(r, "assez d'occurrences pour conclure");
  assert.ok(r.n >= 12);
  assert.equal(r.spike.flag, true);
  assert.ok(Math.abs(r.spike.med - 0.3) < 0.01, `pic médian ${r.spike.med}`);
  assert.ok(Math.abs(r.spike.ctrl) < 0.01, `témoin ${r.spike.ctrl}`);
  assert.ok(r.spike.cons >= 0.95);
  assert.equal(r.after.flag, false);                         // « pic bref » : revenu à la normale à J+2
});

test("eventEffect : ne signale rien quand le prix ne réagit pas à l'événement", () => {
  const r = effect(daily({ spike: 0, jitter: 0.02 }));
  assert.ok(r);
  assert.equal(r.spike.flag, false);
  assert.equal(r.pre.flag, false);
  assert.equal(r.after.flag, false);
});

test("eventEffect : seuil de 6 % — un pic de +3 % n'est pas signalé", () => {
  assert.equal(effect(daily({ spike: 0.03 })).spike.flag, false);
  assert.equal(effect(daily({ spike: 0.08 })).spike.flag, true);
});

test("eventEffect : refuse de conclure sans assez de données", () => {
  assert.equal(effect(daily({ days: 40 })), null);           // moins de 60 jours
  assert.equal(effect(daily({ days: 60, spike: 0.5 })), null);   // pas assez d'occurrences (12 min. exigées)
  assert.equal(ev(`eventEffect(null, EVENTS[0])`), null);
});

test("eventEffect : les événements longs et périodiques ne sont pas mesurés", () => {
  const s = JSON.stringify(daily({ spike: 0.3 }));
  for (const key of ["hoppity", "harvest", "jacob"]) assert.equal(ev(`eventEffect(${s}, EVENTS.find(e => e.key === '${key}'))`), null, key);
});

test("effectLines / effectAdvice : conseil cohérent avec le sens de l'effet", () => {
  const r = effect(daily({ spike: 0.3 }));
  const lines = ev(`effectLines(EVENTS[0], ${JSON.stringify(r)})`);
  assert.ok(lines.some(l => l.includes("pic bref")), lines.join(" | "));
  assert.match(ev(`effectAdvice(${JSON.stringify(r)})`), /vente/);
  const down = effect(daily({ spike: -0.3 }));
  assert.equal(down.spike.flag, true);
  assert.match(ev(`effectAdvice(${JSON.stringify(down)})`), /attends la fin/);
});
