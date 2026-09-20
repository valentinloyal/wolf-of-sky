import test from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./helpers/app.mjs";

test("le script de la page se charge sans navigateur et expose son moteur", () => {
  const app = loadApp();
  for (const name of ["buildBases", "derive", "computeRisk", "parseBackup", "npcInstant", "evNext", "advise", "currentProfile"]) {
    assert.equal(app.run(`typeof ${name}`), "function", name);
  }
});
