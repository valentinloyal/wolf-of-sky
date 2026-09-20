import test from "node:test";
import assert from "node:assert/strict";
import { loadApp, product, INDEX_HTML } from "./helpers/app.mjs";

const NB = " ";
const norm = s => s.replaceAll(NB, " ");

// ---------------------------------------------------------------------------------------------
// Suivi des flips : conseils en direct d'après le carnet d'ordres
// ---------------------------------------------------------------------------------------------
const app = loadApp();
const P = (o = {}) => ({ status: "buy", entry: 1000.1, exit: 1199.9, units: 10, tax: 0.0125, ...o });
const B = (o = {}) => ({ bidTop: 1000, askTop: 1200, exit: 1199.9, entry: 1000.1, ...o });
const advise = (p, b) => app.eval(`advise(${JSON.stringify(p)}, ${b === null ? "null" : JSON.stringify(b)})`);

test("advise (achat) : ordre en tête, y compris juste posé (+0,1 au-dessus du meilleur)", () => {
  const a = advise(P(), B());
  assert.equal(a.lv, "ok"); assert.equal(a.alert, false);
  assert.match(a.txt, /Tu es en tête/);
  assert.match(a.txt, /18[.,]\d %/);                       // marge nette ≈ 18,5 %
});

test("advise (achat) : dépassé par un autre ordre → prix pour repasser devant", () => {
  const a = advise(P(), B({ bidTop: 1010 }));
  assert.equal(a.lv, "warn"); assert.equal(a.alert, true);
  assert.match(norm(a.txt), /dépassé/);
  assert.match(norm(a.txt), /1 010,1/);                    // 1010 + 0,1 : le prix exact, à la décimale
});

test("advise (achat) : dépassé ET marge devenue trop faible → suggère d'annuler", () => {
  const a = advise(P(), B({ bidTop: 1010, exit: 1015 }));
  assert.equal(a.lv, "bad"); assert.equal(a.alert, true);
  assert.match(a.txt, /annuler/);
});

test("advise (achat) : le meilleur ordre est plus bas que le tien → pas d'alerte, simple suggestion", () => {
  const a = advise(P(), B({ bidTop: 990 }));
  assert.equal(a.lv, "warn"); assert.equal(a.alert, false);
  assert.match(a.txt, /moins cher/);
});

test("advise (achat) : en tête mais marge fondue sous 1 % → alerte", () => {
  const a = advise(P(), B({ exit: 1010 }));
  assert.equal(a.alert, true);
  assert.match(a.txt, /n'est plus que de/);
});

test("advise (vente) : en tête / sous-coté / perte / marché plus haut", () => {
  const sell = o => P({ status: "sell", ...o });
  const lead = advise(sell(), B({ askTop: 1199.9 }));
  assert.equal(lead.lv, "ok"); assert.match(lead.txt, /profit net attendu/);
  // quelqu'un vend moins cher : on t'indique le prix pour repasser devant et le profit correspondant
  const under = advise(sell(), B({ askTop: 1150 }));
  assert.equal(under.lv, "warn"); assert.equal(under.alert, true);
  assert.match(norm(under.txt), /sous-coté/); assert.match(norm(under.txt), /1 149,9/);
  // repasser devant te ferait perdre de l'argent
  const loss = advise(sell({ entry: 1200 }), B({ askTop: 1150 }));
  assert.equal(loss.lv, "bad"); assert.match(loss.txt, /perdrais/);
  // le marché est plus haut que ta vente : simple suggestion
  const higher = advise(sell(), B({ askTop: 1300 }));
  assert.equal(higher.lv, "warn"); assert.equal(higher.alert, false);
});

test("advise : item absent du Bazaar → message neutre, jamais d'alerte", () => {
  const a = advise(P(), null);
  assert.equal(a.lv, "mut"); assert.equal(a.alert, false);
});

// ---------------------------------------------------------------------------------------------
// Favoris : statut d'un favori selon les filtres de l'utilisateur
// ---------------------------------------------------------------------------------------------
test("favInfo : rentable, marge faible, risque élevé, trop cher, pas rentable, indisponible", () => {
  const a = loadApp();
  a.run(`Object.assign(cfg, {tax: 0.0125, share: 0.2, cycleH: 1, minVol: 20, maxRisk: 50, budget: 1e6}); bzMap = {}; npcMap = {};`);
  const liquid = { sellWeek: 168 * 500, buyWeek: 168 * 500 };
  a.run(`bases = buildBases(${JSON.stringify({
    GOOD: product("GOOD", { bids: [[1000, 50]], asks: [[1120, 50]], ...liquid }),       // marge ≈ 10 %
    THIN: product("THIN", { bids: [[1000, 50]], asks: [[1025, 50]], ...liquid }),       // marge ≈ 1,2 % après taxe
    TRAP: product("TRAP", { bids: [[1000, 50]], asks: [[3000, 50]], ...liquid }),       // marge de 200 % : risque élevé
    ROCK: product("ROCK", { bids: [[9e8, 5]], asks: [[9.5e8, 5]], ...liquid }),         // hors budget
    NEG: product("NEG", { bids: [[1000, 50]], asks: [[1010, 50]], ...liquid }),         // négatif après taxe
  })})`);
  const st = id => a.eval(`favInfo({id: ${JSON.stringify(id)}, name: "x"}).status`);
  assert.equal(st("GOOD"), "good");
  // une marge de ~1 % est « fragile » : le risque dépasse 50 → « risque élevé » ; « marge faible » n'apparaît que si on accepte plus de risque
  assert.equal(st("THIN"), "risky");
  a.run("cfg.maxRisk = 100");
  assert.equal(st("THIN"), "thin");
  a.run("cfg.maxRisk = 50");
  assert.equal(st("TRAP"), "risky");
  assert.equal(st("ROCK"), "pricey");
  assert.equal(st("NEG"), "neg");
  assert.equal(st("MISSING"), "none");
});

// ---------------------------------------------------------------------------------------------
// Profils de risque
// ---------------------------------------------------------------------------------------------
const selectOptions = id => {
  const m = INDEX_HTML.match(new RegExp(`<select id="${id}"[^>]*>([\\s\\S]*?)</select>`));
  assert.ok(m, `<select id="${id}"> introuvable`);
  return [...m[1].matchAll(/<option([^>]*)>([^<]*)<\/option>/g)].map(x => (/value="([^"]*)"/.exec(x[1]) || [])[1] ?? x[2].trim());
};

test("chaque profil n'utilise que des valeurs présentes dans les listes de l'interface", () => {
  const profiles = app.eval("PROFILES");
  const opts = { cycleH: selectOptions("cycleH").map(Number), minVol: selectOptions("minVol").map(Number), planN: selectOptions("planN").map(Number) };
  const range = INDEX_HTML.match(/<input id="maxRisk" type="range" min="(\d+)" max="(\d+)" step="(\d+)"/);
  assert.ok(range, "curseur de risque introuvable");
  const [lo, hi, step] = range.slice(1).map(Number);
  assert.deepEqual(Object.keys(profiles), ["prudent", "equilibre", "agressif"]);
  for (const [k, p] of Object.entries(profiles)) {
    assert.ok(opts.cycleH.includes(p.cycleH), `${k}.cycleH = ${p.cycleH} absent de la liste ${opts.cycleH}`);
    assert.ok(opts.minVol.includes(p.minVol), `${k}.minVol = ${p.minVol} absent de la liste ${opts.minVol}`);
    assert.ok(opts.planN.includes(p.planN), `${k}.planN = ${p.planN} absent de la liste ${opts.planN}`);
    assert.ok(p.maxRisk >= lo && p.maxRisk <= hi && (p.maxRisk - lo) % step === 0, `${k}.maxRisk = ${p.maxRisk} hors du curseur ${lo}-${hi} pas ${step}`);
  }
});

test("les profils vont dans le sens annoncé : prudent < équilibré < agressif", () => {
  const p = app.eval("PROFILES");
  assert.ok(p.prudent.maxRisk < p.equilibre.maxRisk && p.equilibre.maxRisk < p.agressif.maxRisk);
  assert.ok(p.prudent.cycleH < p.equilibre.cycleH && p.equilibre.cycleH < p.agressif.cycleH);
  assert.ok(p.prudent.minVol > p.equilibre.minVol && p.equilibre.minVol > p.agressif.minVol);     // prudent exige plus de liquidité
  assert.ok(p.prudent.planN > p.equilibre.planN && p.equilibre.planN > p.agressif.planN);         // prudent diversifie davantage
});

test("un profil ne touche pas aux hypothèses du modèle (part de marché, taxe, capital)", () => {
  for (const p of Object.values(app.eval("PROFILES"))) {
    for (const k of ["share", "tax", "budget"]) assert.equal(k in p, false, `un profil règle « ${k} » : ça fausserait les profits affichés`);
  }
});

test("le profil est déduit des réglages : reconnu, « personnalisé » si on s'en écarte", () => {
  const a = loadApp();
  a.run("render = () => {}; syncControls = () => {};");
  for (const k of ["prudent", "equilibre", "agressif"]) {
    a.run(`applyProfile("${k}")`);
    assert.equal(a.eval("currentProfile()"), k);
  }
  a.run("cfg.maxRisk = 60");
  assert.equal(a.eval("currentProfile()"), null);
  a.run(`applyProfile("equilibre")`);
  a.run("cfg.planN = 2");                                   // un seul réglage modifié suffit à sortir du profil
  assert.equal(a.eval("currentProfile()"), null);
  a.run(`applyProfile("equilibre")`);
  assert.equal(a.eval("cfg.planN"), 4);
  assert.equal(JSON.parse(a.store.get("wos_cfg_v1")).maxRisk, 50);        // et c'est enregistré
});

test("applyProfile laisse intacts la part de marché, la taxe et le capital", () => {
  const a = loadApp();
  a.run("render = () => {}; syncControls = () => {}; Object.assign(cfg, {share: 0.35, tax: 0.01, budget: 7e6});");
  a.run(`applyProfile("agressif")`);
  assert.deepEqual(a.eval("[cfg.share, cfg.tax, cfg.budget]"), [0.35, 0.01, 7e6]);
});

// ---------------------------------------------------------------------------------------------
// Lien de partage : les réglages font l'aller-retour, les valeurs invalides sont écartées
// ---------------------------------------------------------------------------------------------
test("lien de partage : les réglages font l'aller-retour", () => {
  const a = loadApp();
  a.run("Object.assign(cfg, {budget: 12e6, maxRisk: 75, cycleH: 2, share: 0.35, tax: 0.01, minVol: 5, planN: 3})");
  const hash = a.eval("shareURL()").split("#")[1];
  assert.equal(hash, "b=12000000&r=75&c=2&s=0.35&t=0.01&v=5&n=3");
  const b = loadApp({ hash: "#" + hash });
  assert.deepEqual(b.eval("[cfg.budget, cfg.maxRisk, cfg.cycleH, cfg.share, cfg.tax, cfg.minVol, cfg.planN]"), [12e6, 75, 2, 0.35, 0.01, 5, 3]);
  assert.equal(b.eval("currentProfile()"), "agressif");        // le profil se retrouve grâce au paramètre n
});

test("lien de partage : valeurs invalides ignorées, les autres conservées", () => {
  const b = loadApp({ hash: "#b=abc&r=5&c=3&s=0.9&t=0.5&v=-1&n=9&x=1" });
  assert.deepEqual(b.eval("[cfg.budget, cfg.maxRisk, cfg.cycleH, cfg.share, cfg.tax, cfg.minVol, cfg.planN]"), [5e6, 50, 1, 0.2, 0.0125, 20, 4]);
  const c = loadApp({ hash: "#b=3000000&r=999&c=4" });
  assert.equal(c.eval("cfg.budget"), 3e6);                     // valide → appliqué
  assert.equal(c.eval("cfg.maxRisk"), 50);                     // hors limites → défaut
  assert.equal(c.eval("cfg.cycleH"), 4);
});
