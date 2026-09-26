import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./src/i18n.js", import.meta.url), "utf8");
const mod = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
mod.setIdioma("en");

const cases = new Map([
  ["Turno 7 — Tú", "Turn 7 — You"],
  ["12 cartas posibles", "12 cards available"],
  ["5 coincidencias", "5 matches"],
  ["40 cartas · validado contra la lista oficial", "40 cards · checked against the official list"],
  ["3 de 12 retos superados", "3 of 12 challenges beaten"],
  ["Pasa el ratón por una carta para ver su texto.", "Hover a card to read its text."],
  ["¿Borrar \"Chaos\"?", "Delete \"Chaos\"?"],
  ["\"Chaos\" tiene 35 cartas; hacen falta 40.", "\"Chaos\" has 35 cards; 40 are required."],
  ["Hay cartas fuera del pool de Goat (2).", "There are 2 cards outside the Goat pool."],
  ["10 monstruos · 15 mágicas · 15 trampas", "10 monsters · 15 spells · 15 traps"],
  ["Forzando avance…", "Forcing advance…"],
  ["(tuyo)", "(yours)"],
]);

let failed = 0;
for (const [input, expected] of cases) {
  const got = mod.T(input);
  if (got !== expected) {
    console.error(`✗ ${JSON.stringify(input)} -> ${JSON.stringify(got)} (expected ${JSON.stringify(expected)})`);
    failed++;
  } else {
    console.log(`✓ ${input} -> ${got}`);
  }
}
if (failed) process.exit(1);
console.log(`\n${cases.size}/${cases.size} English localization checks pass`);
