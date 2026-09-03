#!/usr/bin/env node
/**
 * calibrar-validadores.mjs — mide si una regla de validación DISTINGUE algo.
 *
 * El problema que resuelve: un validador con muchas reglas parece riguroso, pero
 * si una regla salta igual sobre marcado válido que sobre marcado sospechoso, no
 * aporta información — solo ruido. Y el ruido tiene un coste concreto: un informe
 * con cientos de avisos sobre marcado correcto enseña a la gente a ignorarlo, y
 * el día que aparezca un aviso de verdad pasará desapercibido.
 *
 * El criterio es objetivo y no admite discusión: `corpus-gb/` son exports REALES
 * de GenerateBlocks. GB los produjo y GB los acepta. **Si una regla salta ahí, la
 * regla está mal.** No hay que opinar sobre si tiene sentido: se mide.
 *
 * Y una regla puede estar mal de dos maneras distintas:
 *   · salta sobre marcado válido           → falso positivo
 *   · salta IGUAL sobre los dos conjuntos  → no discrimina, da igual lo que diga
 *
 * Se normaliza por bloque porque los ficheros tienen tamaños muy distintos: 8
 * bloques uno, 156 otro. Comparar totales crudos no dice nada.
 *
 * Uso:
 *   node herramientas/calibrar-validadores.mjs                    (solo el corpus)
 *   node herramientas/calibrar-validadores.mjs <carpeta-propia>   (compara los dos)
 *
 * Node, sin dependencias.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.join(AQUI, "corpus-gb");
const propio = process.argv[2] ? path.resolve(process.argv[2]) : null;

/* ── Ejecutar los dos validadores y agrupar por regla ─────────────────────── */

function medir(dir, etiqueta) {
  if (!fs.existsSync(dir)) { console.error(`✖ No existe ${dir}`); process.exit(2); }
  const ficheros = fs.readdirSync(dir).filter((f) => f.endsWith(".html")).map((f) => path.join(dir, f));
  if (!ficheros.length) { console.error(`✖ ${dir} no tiene ningún .html`); process.exit(2); }

  let bloques = 0;
  const reglas = new Map();   // clave → { n, ficheros:Set, ejemplo }
  const anota = (clave, fichero, texto) => {
    if (!reglas.has(clave)) reglas.set(clave, { n: 0, ficheros: new Set(), ejemplo: null });
    const e = reglas.get(clave);
    e.n++; e.ficheros.add(fichero);
    if (!e.ejemplo) e.ejemplo = texto;
  };

  for (const f of ficheros) {
    bloques += (fs.readFileSync(f, "utf8").match(/<!--\s+wp:/g) ?? []).length;

    /* validate-blocks.mjs — «  ✖ [1.2] mensaje» */
    const vb = spawnSync("node", [path.join(AQUI, "conversion", "scripts", "validate-blocks.mjs"), f], { encoding: "utf8" });
    for (const linea of (vb.stdout + vb.stderr).split("\n")) {
      const m = linea.match(/^\s*([✖⚠])\s*\[([^\]]+)\]\s*(.*)$/);
      if (m) anota(`validate-blocks · ${m[1] === "✖" ? "ERROR" : "aviso"} ${m[2]}`, f, m[3].slice(0, 90));
    }

    /* audit-gb.js — secciones «=== ERRORES ===» y subcategorías «-- x (n) --» */
    const ag = spawnSync("node", [path.join(AQUI, "audit-gb.js"), f], { encoding: "utf8" });
    let seccion = null, categoria = null;
    for (const linea of (ag.stdout + ag.stderr).split("\n")) {
      const s = linea.match(/^===\s*(ERRORES|AVISOS|NOTAS)/);
      if (s) { seccion = s[1]; categoria = null; continue; }
      const c = linea.match(/^--\s*(.+?)\s*\(\d+\)\s*--/);
      if (c) { categoria = c[1]; continue; }
      if (!seccion || !categoria) continue;
      const e = linea.match(/^\s*\[[^\]]*\]\s*(.+)$/);
      if (e) {
        const nivel = seccion === "ERRORES" ? "ERROR" : seccion === "AVISOS" ? "aviso" : "nota";
        anota(`audit-gb · ${nivel} ${categoria}`, f, e[1].slice(0, 90));
      }
    }
  }
  return { etiqueta, dir, ficheros: ficheros.length, bloques, reglas };
}

const base = medir(CORPUS, "GB real");
const mio = propio ? medir(propio, "propio") : null;

/* ── Informe ──────────────────────────────────────────────────────────────── */

const tasa = (n, bloques) => (n / bloques) * 100;
const fmt = (x) => x.toFixed(1).padStart(6);

console.log(`\n════════ Calibración de validadores ════════`);
console.log(`  Corpus GB real : ${base.ficheros} ficheros, ${base.bloques} bloques`);
if (mio) console.log(`  Marcado propio : ${mio.ficheros} ficheros, ${mio.bloques} bloques  (${mio.dir})`);

const claves = new Set([...base.reglas.keys(), ...(mio ? mio.reglas.keys() : [])]);
if (!claves.size) { console.log("\n  Ninguna regla se dispara en ningún conjunto.\n"); process.exit(0); }

const filas = [...claves].map((k) => {
  const b = base.reglas.get(k), m = mio?.reglas.get(k);
  const tb = b ? tasa(b.n, base.bloques) : 0;
  const tm = mio ? (m ? tasa(m.n, mio.bloques) : 0) : null;
  return { k, nb: b?.n ?? 0, tb, nm: m?.n ?? 0, tm, ejemplo: b?.ejemplo ?? m?.ejemplo, ficheros: b?.ficheros.size ?? 0 };
}).sort((a, b) => b.tb - a.tb);

console.log(`\n  ${"regla".padEnd(42)} ${"GB real".padStart(8)} ${mio ? "propio".padStart(8) : ""}   veredicto`);
console.log("  " + "─".repeat(mio ? 88 : 70));

const condena = [];
for (const f of filas) {
  let veredicto;
  if (f.k.includes("ERROR") && f.tb > 0) {
    veredicto = "✖ FALSA — es ERROR sobre marcado que GB acepta";
    condena.push(f);
  } else if (f.tb === 0) {
    veredicto = "✔ no salta sobre marcado válido";
  } else if (mio && f.tm > 0 && Math.min(f.tb, f.tm) / Math.max(f.tb, f.tm) > 0.5) {
    veredicto = "✖ NO DISTINGUE — misma tasa en los dos";
    condena.push(f);
  } else if (mio && f.tm === 0) {
    veredicto = "◦ solo describe exports de GB, no valida lo nuestro";
    condena.push(f);
  } else {
    veredicto = "⚠ salta sobre marcado válido: revisar";
    condena.push(f);
  }
  console.log(
    `  ${f.k.padEnd(42)} ${fmt(f.tb)} ${mio ? fmt(f.tm) : ""}   ${veredicto}`
  );
}

console.log(`\n  Tasas por 100 bloques. Ejemplos:`);
for (const f of filas.slice(0, 8)) console.log(`    ${f.k}\n      ${f.ejemplo}`);

if (!condena.length) {
  console.log(`\n✔ Ninguna regla salta sobre los ${base.bloques} bloques de GB real.\n`);
  process.exit(0);
}
console.log(`\n⚠ ${condena.length} regla(s) sin poder discriminante. Cada una es ruido que`);
console.log(`  entrena a ignorar el informe. Arréglalas o bájalas a NOTA.\n`);
process.exit(1);
