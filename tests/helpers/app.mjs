// Banc de test : charge le VRAI script de index.html (celui qui est déployé) dans un contexte isolé,
// avec un navigateur factice (localStorage en mémoire, pas de réseau). Rien n'est réécrit ni dupliqué :
// si le code de la page change, les tests testent le nouveau code.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const read = f => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/\r\n/g, "\n");
export const INDEX_HTML = read("index.html");

export function extractScript(html = INDEX_HTML) {
  const i = html.lastIndexOf("<script>"), j = html.lastIndexOf("</script>");
  if (i < 0 || j < i) throw new Error("bloc <script> introuvable dans index.html");
  return html.slice(i + "<script>".length, j);
}

// élément DOM « qui accepte tout » : les fonctions de rendu ne plantent pas, on teste la logique, pas le HTML
function dummy() {
  const fn = function () {};
  return new Proxy(fn, {
    get: (t, p) => (p === Symbol.toPrimitive ? () => "" : p === "length" ? 0 : p === "value" ? "" : p === "dataset" ? {} : p === "style" ? {} : p === "classList" ? { toggle() {}, add() {}, remove() {}, contains: () => false } : dummy()),
    apply: () => dummy(),
    set: () => true,
  });
}

export function loadApp({ storage = {}, hash = "" } = {}) {
  const store = new Map(Object.entries(storage));
  const sandbox = {
    __WOS_TEST__: true,
    console, URLSearchParams, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    location: { hash, href: "http://localhost/index.html" },
    document: { querySelector: () => dummy(), querySelectorAll: () => [], createElement: () => dummy(), addEventListener() {}, hidden: false, title: "", body: dummy(), documentElement: dummy() },
    navigator: {}, CSS: { escape: s => s }, Blob: class {}, FileReader: class {}, URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
    fetch: () => Promise.reject(new Error("réseau désactivé en test")),
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(extractScript(), ctx, { filename: "index.html<script>" });
  return {
    store,
    // exécute du code dans la page ; le résultat est cloné via JSON pour pouvoir utiliser assert.deepStrictEqual
    // (les objets d'un autre contexte V8 n'ont pas le même prototype). NaN / Infinity deviennent null.
    eval(code) {
      const out = vm.runInContext(`JSON.stringify((() => { return (${code}); })())`, ctx);
      return out === undefined ? undefined : JSON.parse(out);
    },
    run(code) { return vm.runInContext(code, ctx); },
  };
}

// ----- fabrique de données au format de l'API Hypixel /skyblock/bazaar -----
// bids  = ordres d'ACHAT [prix, quantité] du plus haut au plus bas      (l'API les appelle « sell_summary »)
// asks  = offres de VENTE [prix, quantité] du plus bas au plus haut     (l'API les appelle « buy_summary »)
export function product(id, { bids, asks, sellWeek = 16800, buyWeek = 16800, qsSell, qsBuy } = {}) {
  const lv = a => a.map(([pricePerUnit, amount]) => ({ amount, pricePerUnit, orders: 1 }));
  return {
    product_id: id,
    sell_summary: lv(bids),
    buy_summary: lv(asks),
    quick_status: {
      productId: id,
      sellPrice: qsSell ?? bids[0]?.[0] ?? 0, buyPrice: qsBuy ?? asks[0]?.[0] ?? 0,
      sellMovingWeek: sellWeek, buyMovingWeek: buyWeek, sellVolume: 0, buyVolume: 0, sellOrders: 1, buyOrders: 1,
    },
  };
}
