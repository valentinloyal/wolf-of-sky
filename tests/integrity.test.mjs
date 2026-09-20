// Contrôles statiques : ce sont les erreurs « bêtes » qui cassent une page sans qu'aucun calcul ne soit faux.
// Chaque test ci-dessous correspond à un vrai bug rencontré pendant le développement.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT, read, INDEX_HTML } from "./helpers/app.mjs";

const BRAND_HTML = read("brand.html");
const WORKFLOW = read(".github/workflows/pages.yml");
const staticHtml = html => html.slice(0, html.lastIndexOf("<script>") >= 0 ? html.lastIndexOf("<script>") : html.length);
const idsOf = text => [...text.matchAll(/\bid="([^"$]+)"/g)].map(m => m[1]);

test("aucun identifiant HTML n'est dupliqué (un doublon avait cassé le réglage « part de marché »)", () => {
  for (const [name, html] of [["index.html", INDEX_HTML], ["brand.html", BRAND_HTML]]) {
    const ids = idsOf(staticHtml(html)), seen = new Set(), dup = new Set();
    for (const id of ids) (seen.has(id) ? dup : seen).add(id);
    assert.deepEqual([...dup], [], `${name} : identifiants en double`);
  }
});

test("tout $(\"#…\") du script désigne un élément qui existe (dans le HTML ou fabriqué par le script)", () => {
  const known = new Set(idsOf(INDEX_HTML));                    // HTML statique + gabarits du script (id="bkTxt"…)
  const script = INDEX_HTML.slice(INDEX_HTML.lastIndexOf("<script>"));
  const used = new Set([...script.matchAll(/\$\("#([A-Za-z][\w-]*)"\)/g)].map(m => m[1]));
  const missing = [...used].filter(id => !known.has(id));
  assert.deepEqual(missing, [], `éléments introuvables : ${missing}`);
  assert.ok(used.size > 30, "l'analyse doit voir la plupart des références");
});

test("chaque onglet de la navigation a son volet, et inversement", () => {
  const tabs = [...INDEX_HTML.matchAll(/class="tab[^"]*" data-tab="([^"]+)"/g)].map(m => m[1]);
  const panes = [...INDEX_HTML.matchAll(/class="pane[^"]*" id="pane-([^"]+)"/g)].map(m => m[1]);
  assert.ok(tabs.length >= 7);
  assert.deepEqual([...tabs].sort(), [...panes].sort());
});

test("chaque icône <use href=\"#i-…\"> a son <symbol> (aucune icône invisible)", () => {
  for (const [name, html] of [["index.html", INDEX_HTML], ["brand.html", BRAND_HTML]]) {
    const symbols = new Set([...html.matchAll(/<symbol id="([^"]+)"/g)].map(m => m[1]));
    const used = new Set([...html.matchAll(/<use href="#([^"]+)"/g)].map(m => m[1]));
    const missing = [...used].filter(u => !symbols.has(u));
    assert.deepEqual(missing, [], `${name} : symboles manquants ${missing}`);
  }
});

test("pas d'emoji dans l'interface (règle de la charte graphique)", () => {
  const EMOJI = /[\u{1F300}-\u{1FAFF}✅✔⚠⭐⏳✎]/u;
  for (const [name, html] of [["index.html", INDEX_HTML], ["brand.html", BRAND_HTML]]) {
    const hit = html.split("\n").findIndex(l => EMOJI.test(l));
    assert.equal(hit, -1, `${name} ligne ${hit + 1} : emoji`);
  }
});

test("les polices déclarées dans les CSS existent sur le disque", () => {
  for (const html of [INDEX_HTML, BRAND_HTML]) {
    const files = [...html.matchAll(/url\((fonts\/[^)]+)\)/g)].map(m => m[1]);
    assert.ok(files.length >= 7);
    for (const f of files) assert.ok(fs.existsSync(path.join(ROOT, f)), `police absente : ${f}`);
  }
});

test("le logo référencé existe et le fichier est un SVG valide", () => {
  const svg = read("logo.svg");
  assert.match(svg, /^<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /<\/svg>\s*$/);
  assert.ok(INDEX_HTML.includes('href="logo.svg"'));
});

// ---------------------------------------------------------------------------------------------
// Déploiement : ce qui est référencé par la page doit être publié par le workflow
// (le workflow ne copiait d'abord que index.html : le site publié aurait perdu ses polices et son logo)
// ---------------------------------------------------------------------------------------------
function deployedTopLevel() {
  const cp = WORKFLOW.match(/cp -r ([^\n]+?) _site\//);
  assert.ok(cp, "commande cp introuvable dans le workflow");
  const copied = cp[1].trim().split(/\s+/);
  const generated = [...WORKFLOW.matchAll(/> _site\/([\w.-]+)/g)].map(m => m[1]);
  return new Set([...copied, ...generated]);
}

test("le workflow publie tous les fichiers dont la page a besoin", () => {
  const deployed = deployedTopLevel();
  const refs = new Set();
  for (const html of [INDEX_HTML, BRAND_HTML]) {
    for (const m of html.matchAll(/(?:href|src)="([^"#:?]+)"/g)) refs.add(m[1]);           // liens relatifs
    for (const m of html.matchAll(/url\(\s*([^)"']+)\)/g)) refs.add(m[1]);                 // CSS
    for (const m of html.matchAll(/fetch\("([^"?:]+)["?]/g)) refs.add(m[1]);               // chargements relatifs du script (pas les URL https://)
  }
  refs.delete("./");                                                                        // lien d'accueil
  for (const r of refs) {
    const top = r.split("/")[0];
    assert.ok(deployed.has(top), `« ${r} » est référencé par la page mais n'est pas publié par le workflow (publié : ${[...deployed]})`);
  }
  for (const must of ["index.html", "brand.html", "logo.svg", "fonts", "contests.json", "npc.json"]) assert.ok(deployed.has(must), must);
});

test("le déploiement est conditionné à la réussite des tests", () => {
  assert.match(WORKFLOW, /\n\s+test:\s*\n/, "job « test » absent");
  assert.match(WORKFLOW, /node --test/, "les tests ne sont pas lancés");
  assert.match(WORKFLOW, /needs:\s*test/, "le déploiement ne dépend pas des tests");
});

test("les actions GitHub ne sont pas en retard sur les versions vérifiées", () => {
  const min = { "actions/checkout": 7, "actions/configure-pages": 6, "actions/upload-pages-artifact": 5, "actions/deploy-pages": 5, "actions/setup-node": 6 };
  const uses = [...WORKFLOW.matchAll(/uses:\s*([\w./-]+)@v(\d+)/g)].map(m => [m[1], Number(m[2])]);
  assert.ok(uses.length >= 5);
  for (const [name, major] of uses) if (min[name]) assert.ok(major >= min[name], `${name}@v${major} : au moins v${min[name]} attendue`);
});

test("Dependabot surveille les actions GitHub (pour ne plus prendre de retard en silence)", () => {
  const d = read(".github/dependabot.yml");
  assert.match(d, /package-ecosystem:\s*"?github-actions"?/);
});
