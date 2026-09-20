import test from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./helpers/app.mjs";

// La sauvegarde est la seule porte d'entrée de données « externes » de la page : un fichier importé n'est jamais cru sur parole.
const NOW = Date.now();
const goodPos = (o = {}) => ({ pid: "abc123", item: "ENCHANTED_COAL", name: "Enchanted Coal", units: 10, entry: 100.5, exit: 120, tax: 0.0125, status: "sell", createdAt: NOW, ...o });
const wrap = (o = {}) => JSON.stringify({ app: "wolf-of-sky", version: 1, exportedAt: new Date(NOW).toISOString(), favs: [], positions: [], ...o });

function fresh(storage) {
  const app = loadApp({ storage });
  app.run("render = () => {}; renderFavs = () => {}; renderTracker = () => {}; syncControls = () => {};");   // pas de DOM ici
  return app;
}
const parse = (app, text) => app.eval(`parseBackup(${JSON.stringify(text)})`);

test("buildBackup : contient favoris, suivi et (au choix) réglages", () => {
  const app = fresh({ wos_fav_v1: JSON.stringify([{ id: "A", name: "A" }]), wos_pos_v1: JSON.stringify([goodPos()]) });
  const withS = app.eval("buildBackup(true)"), without = app.eval("buildBackup(false)");
  assert.equal(withS.app, "wolf-of-sky"); assert.equal(withS.version, 1);
  assert.equal(withS.favs.length, 1); assert.equal(withS.positions.length, 1);
  assert.deepEqual(Object.keys(withS.settings).sort(), ["budget", "cycleH", "maxRisk", "minVol", "npcMin", "planN", "share", "tax"]);
  assert.equal("settings" in without, false);
  assert.ok(!Number.isNaN(Date.parse(withS.exportedAt)));
});

test("export puis import : aller-retour sans perte", () => {
  const app = fresh({ wos_fav_v1: JSON.stringify([{ id: "A_B", name: "Item A" }]), wos_pos_v1: JSON.stringify([goodPos(), goodPos({ pid: "p2", status: "done", soldPrice: 130, soldAt: NOW })]) });
  const text = JSON.stringify(app.eval("buildBackup(true)"));
  const r = parse(app, text);
  assert.equal(r.error, undefined);
  assert.equal(r.skipped, 0);
  assert.deepEqual(r.data.favs, [{ id: "A_B", name: "Item A" }]);
  assert.equal(r.data.positions.length, 2);
  assert.deepEqual(r.data.positions[1], { ...goodPos({ pid: "p2", status: "done", soldPrice: 130, soldAt: NOW }) });
  assert.equal(Object.keys(r.data.settings).length, 8);
});

test("rejette tout ce qui n'est pas une sauvegarde Wolf of Sky", () => {
  const app = fresh();
  const err = t => parse(app, t).error;
  assert.match(err("pas du json"), /JSON valide/);
  assert.match(err(""), /JSON valide/);
  assert.match(err("null"), /pas une sauvegarde/);
  assert.match(err("[1,2,3]"), /pas une sauvegarde/);
  assert.match(err('"texte"'), /pas une sauvegarde/);
  assert.match(err(JSON.stringify({ app: "autre", version: 1 })), /pas une sauvegarde/);
  assert.match(err(JSON.stringify({ app: "wolf-of-sky" })), /Version/);                 // pas de version
  assert.match(err(JSON.stringify({ app: "wolf-of-sky", version: 0 })), /Version/);
  assert.match(err(JSON.stringify({ app: "wolf-of-sky", version: 99 })), /Version/);    // créée par une version plus récente
  assert.match(err(JSON.stringify({ app: "wolf-of-sky", version: "1" })), /Version/);
});

test("refuse les sauvegardes démesurées", () => {
  const app = fresh();
  assert.match(parse(app, wrap({ favs: new Array(1001).fill({ id: "A" }) })).error, /volumineuse/);
  assert.match(parse(app, wrap({ positions: new Array(2001).fill(goodPos()) })).error, /volumineuse/);
  assert.equal(parse(app, wrap({ favs: new Array(1000).fill({ id: "A" }) })).error, undefined);   // la limite elle-même passe
});

test("favoris : identifiants restreints à [A-Za-z0-9_:.-], longueur bornée, HTML jamais interprété", () => {
  const app = fresh();
  const r = parse(app, wrap({
    favs: [
      { id: "<img src=x onerror=alert(1)>", name: "x" }, { id: "A".repeat(121), name: "x" }, { id: "avec espace", name: "x" },
      { id: "", name: "x" }, { name: "sans id" }, null, 42, "chaîne", [],
      { id: "OK_ITEM", name: "<b>gras</b>" }, { id: "RAW_FISH:3", name: "Poisson" }, { id: "GOOD_ONE" }, { id: "LONGNAME", name: "n".repeat(121) },
    ],
  }));
  assert.deepEqual(r.data.favs.map(f => f.id), ["OK_ITEM", "RAW_FISH:3", "GOOD_ONE", "LONGNAME"]);
  assert.equal(r.skipped, 9);
  assert.equal(r.data.favs[0].name, "<b>gras</b>");            // conservé tel quel : la page l'affiche toujours échappé (esc)
  assert.equal(r.data.favs[2].name, "Good One");               // nom manquant → lisible
  assert.equal(r.data.favs[3].name, "Longname");               // nom trop long → remplacé
});

test("positions : chaque champ est validé (types, bornes, statut, cohérence)", () => {
  const app = fresh();
  const bad = {
    "quantité négative": goodPos({ units: -5 }), "quantité nulle": goodPos({ units: 0 }), "quantité NaN": goodPos({ units: "5" }),
    "prix en texte": goodPos({ entry: "10" }), "prix nul": goodPos({ exit: 0 }), "prix énorme": goodPos({ entry: 1e13 }),
    "taxe absurde": goodPos({ tax: 0.5 }), "statut inventé": goodPos({ status: "hack" }), "date absente": goodPos({ createdAt: undefined }),
    "date avant 2001": goodPos({ createdAt: 1000 }), "pid piégé": goodPos({ pid: "x<script>" }), "item piégé": goodPos({ item: "A B" }),
    "terminé sans prix de vente": goodPos({ status: "done", soldAt: NOW }), "terminé sans date": goodPos({ status: "done", soldPrice: 5 }),
    "terminé, prix négatif": goodPos({ status: "done", soldPrice: -1, soldAt: NOW }),
  };
  for (const [why, p] of Object.entries(bad)) {
    const r = parse(app, wrap({ positions: [p] }));
    assert.equal(r.data.positions.length, 0, why);
    assert.equal(r.skipped, 1, why);
  }
  const ok = parse(app, wrap({ positions: [goodPos(), goodPos({ pid: "b", status: "buy" }), goodPos({ pid: "c", status: "done", soldPrice: 1, soldAt: NOW }), goodPos({ pid: "d", units: 5.9 })] }));
  assert.equal(ok.data.positions.length, 4);
  assert.equal(ok.data.positions[3].units, 5);                 // quantité entière
});

test("positions : seuls les champs connus sont conservés (pas d'injection de propriétés)", () => {
  const app = fresh();
  const r = parse(app, wrap({ positions: [{ ...goodPos(), evil: "<script>", constructor: "x" }] }));
  assert.deepEqual(Object.keys(r.data.positions[0]).sort(), ["createdAt", "entry", "exit", "item", "name", "pid", "status", "tax", "units"]);
});

test("un fichier avec une clé \"__proto__\" ne pollue pas les prototypes", () => {
  // JSON.parse crée une VRAIE propriété "__proto__" (un objet littéral JS, lui, change le prototype) : on l'injecte dans le texte brut
  const app = fresh();
  let text = wrap({ positions: [goodPos()], favs: [{ id: "A", name: "A" }], settings: { budget: 5e6 } });
  text = text.replace('"status":"sell"', '"status":"sell","__proto__":{"polluted":true}')
             .replace('"id":"A"', '"id":"A","__proto__":{"polluted":true}')
             .replace('"settings":{', '"settings":{"__proto__":{"polluted":true},');
  assert.ok((text.match(/__proto__/g) || []).length === 3, "les trois injections sont bien dans le texte");
  const r = parse(app, text);
  assert.equal(r.error, undefined);
  assert.equal(app.eval("({}).polluted"), undefined);
  assert.equal(app.eval("Object.prototype.polluted"), undefined);
  assert.deepEqual(r.data.settings, { budget: 5e6 });
  assert.ok(!Object.keys(r.data.positions[0]).includes("__proto__"));
  assert.ok(!Object.keys(r.data.favs[0]).includes("__proto__"));
  app.run(`applyBackup(${JSON.stringify(r.data)}, "merge", true)`);          // et l'application de la sauvegarde non plus
  assert.equal(app.eval("({}).polluted"), undefined);
});

test("réglages : liste blanche stricte, valeurs hors limites écartées une par une", () => {
  const app = fresh();
  const s = settings => parse(app, wrap({ settings })).data.settings;
  assert.deepEqual(s({ budget: 12e6, tax: 0.01125, share: 0.35, cycleH: 2, maxRisk: 75, minVol: 150, npcMin: 100000, planN: 5 }),
    { budget: 12e6, tax: 0.01125, share: 0.35, cycleH: 2, maxRisk: 75, minVol: 150, npcMin: 100000, planN: 5 });
  assert.deepEqual(s({ budget: "beaucoup", tax: 0.5, share: 0.2, maxRisk: 9999, planN: 7, cycleH: 3, npcMin: 5, minVol: -1 }), { share: 0.2 });
  assert.deepEqual(s({ budget: 0 }), {});                                  // budget ≥ 1
  assert.deepEqual(s({ budget: 1e14 }), {});
  assert.deepEqual(s({ planN: 2.5 }), {});
  assert.deepEqual(s({ inconnu: 1, q: "hack", sort: "x" }), {});           // clés hors liste ignorées
  assert.deepEqual(s("texte"), {});
  assert.deepEqual(s(null), {});
});

test("date d'export : affichée si valide, ignorée sinon", () => {
  const app = fresh();
  assert.ok(parse(app, wrap()).date);
  assert.equal(parse(app, wrap({ exportedAt: "nope" })).date, null);
});

test("applyBackup (fusion) : garde l'existant, ajoute le nouveau, sans doublon", () => {
  const app = fresh({ wos_fav_v1: JSON.stringify([{ id: "A", name: "Ancien nom" }]), wos_pos_v1: JSON.stringify([goodPos({ pid: "p1", units: 1 })]) });
  const incoming = { favs: [{ id: "A", name: "Nom importé" }, { id: "B", name: "B" }], positions: [goodPos({ pid: "p1", units: 999 }), goodPos({ pid: "p2" })], settings: {} };
  assert.deepEqual(app.eval(`backupDiff(${JSON.stringify(incoming)})`), { newFavs: 1, newPos: 1 });
  app.run(`applyBackup(${JSON.stringify(incoming)}, "merge", false)`);
  const favs = app.eval("favs"), pos = app.eval("positions");
  assert.deepEqual(favs.map(f => f.id), ["A", "B"]);
  assert.equal(favs[0].name, "Ancien nom");                    // l'existant prime
  assert.deepEqual(pos.map(p => p.pid), ["p1", "p2"]);
  assert.equal(pos[0].units, 1);
  app.run(`applyBackup(${JSON.stringify(incoming)}, "merge", false)`);   // 2e import identique : aucun doublon
  assert.equal(app.eval("favs.length"), 2); assert.equal(app.eval("positions.length"), 2);
});

test("applyBackup (remplacement) et persistance dans localStorage", () => {
  const app = fresh({ wos_fav_v1: JSON.stringify([{ id: "A", name: "A" }]), wos_pos_v1: JSON.stringify([goodPos()]) });
  app.run(`applyBackup({favs: [{id: "Z", name: "Z"}], positions: [], settings: {}}, "replace", false)`);
  assert.deepEqual(app.eval("favs"), [{ id: "Z", name: "Z" }]);
  assert.equal(app.eval("positions.length"), 0);
  assert.deepEqual(JSON.parse(app.store.get("wos_fav_v1")), [{ id: "Z", name: "Z" }]);
  assert.deepEqual(JSON.parse(app.store.get("wos_pos_v1")), []);
});

test("applyBackup : les réglages ne sont appliqués que si demandé", () => {
  const app = fresh();
  const before = app.eval("cfg.budget");
  app.run(`applyBackup({favs: [], positions: [], settings: {budget: 42e6, tax: 0.01}}, "merge", false)`);
  assert.equal(app.eval("cfg.budget"), before);
  app.run(`applyBackup({favs: [], positions: [], settings: {budget: 42e6, tax: 0.01}}, "merge", true)`);
  assert.equal(app.eval("cfg.budget"), 42e6); assert.equal(app.eval("cfg.tax"), 0.01);
  assert.equal(JSON.parse(app.store.get("wos_cfg_v1")).budget, 42e6);       // et c'est enregistré
});
