import test from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./helpers/app.mjs";

const app = loadApp();
const NB = " ";   // espace insécable : IBM Plex n'a pas l'espace fine U+202F que fr-FR utilise
const ev = code => app.eval(code);

test("fmt : abrège les grands nombres (k, M, B) et garde le signe", () => {
  const cases = [
    [0, "0.0"], [12, "12.0"], [99.94, "99.9"], [150, "150"], [999, "999"],
    [1500, `1${NB}500`], [9999, `9${NB}999`], [12345, "12.3k"], [999999, "1000.0k"],
    [1234567, "1.23M"], [2.5e9, "2.50B"], [-5000, `-5${NB}000`], [-2.5e6, "-2.50M"],
  ];
  for (const [n, exp] of cases) assert.equal(ev(`fmt(${n})`), exp, `fmt(${n})`);
});

test("les milliers utilisent l'espace insécable classique, jamais U+202F", () => {
  const all = [ev("fmt(1500)"), ev("price(2250246.4)"), ev("full(4500500)"), ev("(1234567).toLocaleString('fr-FR')")].join("|");
  assert.ok(!all.includes(" "), "U+202F présent : la police n'a pas ce caractère");
  assert.ok(all.includes(NB));
});

test("price : garde la décimale (0,1 coin décide qui passe devant au Bazaar)", () => {
  assert.equal(ev("price(2250246.4)"), `2${NB}250${NB}246,4`);
  assert.equal(ev("price(2250246)"), `2${NB}250${NB}246`);
  assert.equal(ev("price(1000)"), `1${NB}000`);
  assert.equal(ev("price(0.1 + 0.2)"), "0,3");          // arrondi flottant : 0.30000000000000004
  assert.equal(ev("price(12.34)"), "12,3");
});

test("full : entier au-dessus de 1000, une décimale en dessous", () => {
  assert.equal(ev("full(4500500.4)"), `4${NB}500${NB}500`);
  assert.equal(ev("full(184.8)"), "184,8");
  assert.equal(ev("full(5)"), "5");
});

test("fmtDur : minutes sous 1 h, heures au-dessus", () => {
  const cases = [[0.001, "< 1 min"], [0.25, "15 min"], [0.5, "30 min"], [1, "1 h"], [1.5, "1,5 h"], [2, "2 h"], [24, "24 h"]];
  for (const [h, exp] of cases) assert.equal(ev(`fmtDur(${h})`), exp, `fmtDur(${h})`);
});

test("fmtDur : 59,6 minutes ne s'affiche pas « 60 min »", () => {
  // régression : Math.round(59.6) donnait « 60 min » au lieu de « 1 h »
  assert.equal(ev(`fmtDur(${59.6 / 60})`), "1 h");
  assert.equal(ev(`fmtDur(${59.4 / 60})`), "59 min");
});

test("parseMoney : k / m / b, virgule ou point décimal, espaces", () => {
  const ok = { "5m": 5e6, "250k": 250000, "1.2b": 1.2e9, "1,5m": 1.5e6, "5 000 000": 5e6, " 5M ": 5e6, "12": 12, "0.5k": 500, "1B": 1e9, "5.": 5, ".5m": 5e5 };
  for (const [s, v] of Object.entries(ok)) assert.equal(ev(`parseMoney(${JSON.stringify(s)})`), v, s);
});

test("parseMoney : rejette ce qui n'est pas un montant", () => {
  for (const s of ["abc", "", "-5m", "5mm", "m5", "5 m m", "1.2.3m", "1..2", "5,000,000", "NaN", "Infinity"]) {
    assert.equal(ev(`parseMoney(${JSON.stringify(s)})`), null, `« ${s} » devrait être refusé`);
  }
});

test("prettify / gameNames : noms lisibles, livres d'enchantement en chiffres romains", () => {
  assert.equal(ev(`prettify("ENCHANTED_COAL")`), "Enchanted Coal");
  assert.equal(ev(`prettify("ENCHANTMENT_ULTIMATE_SUNSET_1")`), "Ultimate Sunset 1");
  assert.deepEqual(ev(`gameNames("ENCHANTMENT_ULTIMATE_SUNSET_1", "x")`), { name: "Sunset I", search: "Sunset", book: true, ultimate: true });
  assert.deepEqual(ev(`gameNames("ENCHANTMENT_SHARPNESS_5", "x")`), { name: "Sharpness V", search: "Sharpness", book: true, ultimate: false });
  assert.equal(ev(`gameNames("ENCHANTMENT_TURBO_CARROT_3", "x").name`), "Turbo Carrot III");
  assert.equal(ev(`gameNames("ENCHANTMENT_SOMETHING_12", "x").name`), "Something 12");     // au-delà de X : chiffre arabe
  assert.deepEqual(ev(`gameNames("ENCHANTED_COAL", "Enchanted Coal")`), { name: "Enchanted Coal", search: "Enchanted Coal", book: false });
});

test("riskLevel : bornes des quatre niveaux", () => {
  const cases = [[0, "g"], [24, "g"], [25, "y"], [44, "y"], [45, "o"], [64, "o"], [65, "r"], [100, "r"]];
  for (const [r, k] of cases) assert.equal(ev(`riskLevel(${r}).k`), k, `riskLevel(${r})`);
  assert.equal(ev("riskLevel(10).label"), "Faible");
  assert.equal(ev("riskLevel(90).label"), "Très élevé");
});

test("fmtCountdown : jours, heures, minutes", () => {
  const cases = [[0, "1 min"], [59 * 60e3, "59 min"], [60 * 60e3, "1 h 00 min"], [125 * 60e3, "2 h 05 min"], [49 * 3600e3, "2 j 1 h"]];
  for (const [ms, exp] of cases) assert.equal(ev(`fmtCountdown(${ms})`), exp, `${ms} ms`);
});
