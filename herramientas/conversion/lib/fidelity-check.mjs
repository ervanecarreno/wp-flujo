/**
 * fidelity-check.mjs — comprobación DETERMINISTA (sin IA) de fidelidad entre
 * un nodo de Figma y los estilos que el motor le asignó, a partir del
 * `fidelityRecords` que devuelve `convertFrame()` (lib/convert-frame.mjs).
 *
 * Sustituye a la antigua "Auditoría de fidelidad" (que volcaba el árbol
 * entero + el HTML convertido y le pedía a un LLM que lo revisara a ojo, sin
 * ninguna pista de dónde mirar). En su lugar, cada regla de aquí verifica por
 * código una propiedad concreta de Figma contra el resultado real — las
 * mismas reglas que ya estaban escritas como checklist para un humano/LLM,
 * ahora como comprobación automática. Cada regla nació de un bug real ya
 * encontrado en este proyecto (ver comentario de cada una).
 */

/**
 * @param {Array<{id:string,name:string,type:string,sizingH?:string,sizingV?:string,clipsContent:boolean,textAlign?:string,styles:object}>} records
 * @returns {Array<{id:string,name:string,rule:string,detail:string}>}
 */
export function checkFidelity(records) {
  const issues = [];

  for (const r of records) {
    const s = r.styles ?? {};

    // Regla 1 — sizingH:FILL debe reflejarse en flexGrow (padre horizontal) o
    // width:100% (padre vertical). Bug real corregido 2026-08-19: un TEXT con
    // FILL no llevaba ninguno de los dos, y no envolvía al ancho de su columna.
    if (r.sizingH === "FILL") {
      const hasFlexGrow = s.flexGrow === "1" && s.flexBasis === "0";
      const hasWidthFull = s.width === "100%";
      if (!hasFlexGrow && !hasWidthFull) {
        issues.push({
          id: r.id, name: r.name, rule: "sizingH-fill",
          detail: `sizingH=FILL en Figma pero el bloque no tiene flexGrow:1/flexBasis:0 ni width:100% (styles: ${JSON.stringify(s)})`,
        });
      }
    }

    // Regla 2 — clipsContent:true en Figma debe dar overflow:hidden.
    if (r.clipsContent && s.overflow !== "hidden") {
      issues.push({
        id: r.id, name: r.name, rule: "clips-content",
        detail: `clipsContent:true en Figma pero el bloque no tiene overflow:hidden (styles: ${JSON.stringify(s)})`,
      });
    }

    // Regla 3 — textAlign de un nodo TEXT (si no es LEFT, el valor por
    // defecto que Figma omite) debe coincidir con el textAlign del bloque.
    if (r.type === "TEXT" && r.textAlign && r.textAlign !== "LEFT") {
      const expected = r.textAlign.toLowerCase();
      if (s.textAlign !== expected) {
        issues.push({
          id: r.id, name: r.name, rule: "text-align",
          detail: `Figma tiene textAlign=${r.textAlign} pero el bloque tiene textAlign=${s.textAlign ?? "(sin valor)"}`,
        });
      }
    }
  }

  return issues;
}
