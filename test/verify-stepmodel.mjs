// verify-stepmodel.mjs
// Verifica el mini-modelo de step-selection: que los pesos vienen empaquetados,
// que la red produce distribuciones validas (no uniformes => aprendio algo) y
// que predice patrones coherentes (p.ej. en una racha rapida tiende a carriles
// adyacentes al ultimo, formando escaleras).
import { hasStepModel, predictLaneLogits, buildFeatures } from "../server/stepmodel.js";

let ok = true;

// 1) pesos empaquetados para 5 y 4 paneles
for (const L of [5, 4]) {
  if (!hasStepModel(L)) { console.log(`FALLO: falta el modelo para ${L} paneles`); ok = false; }
}

// 2) distribucion valida y NO uniforme (aprendio algo)
const logits = predictLaneLogits({ pitch: 0.5, voice: "melody", onDownbeat: true, strong: 0.6, reach: 0, looseness: 0.5, foot: -1, lastLane: 2, last2Lane: 1 }, 5);
if (!logits || logits.length !== 5) { console.log("FALLO: no devuelve logits de 5"); ok = false; }
else {
  const ps = logits.map(Math.exp);
  const sum = ps.reduce((s, x) => s + x, 0);
  const mx = Math.max(...ps), mn = Math.min(...ps);
  console.log(`suma prob=${sum.toFixed(3)} (esperado ~1) | max=${mx.toFixed(3)} min=${mn.toFixed(3)}`);
  if (Math.abs(sum - 1) > 0.05) { console.log("FALLO: la softmax no suma ~1"); ok = false; }
  if (mx - mn < 0.05) { console.log("FALLO: distribucion casi uniforme (no aprendio)"); ok = false; }
}

// 3) coherencia de patron: en una racha RAPIDA (reach=1), el modelo deberia
//    preferir carriles cercanos al ultimo (escaleras/alternancia), no saltos.
//    Medimos: el carril mas probable esta a <=2 del ultimo en varios contextos.
let nearCount = 0, tot = 0;
for (let last = 0; last < 5; last++) {
  for (const foot of [-1, 1]) {
    const lg = predictLaneLogits({ pitch: 0.5, voice: "melody", onDownbeat: false, strong: 0.4, reach: 1, looseness: 0.2, foot, lastLane: last, last2Lane: (last + 4) % 5 }, 5);
    if (!lg) continue;
    let bo = 0, bs = -Infinity; for (let o = 0; o < 5; o++) if (lg[o] > bs) { bs = lg[o]; bo = o; }
    if (Math.abs(bo - last) <= 2) nearCount++;
    tot++;
  }
}
console.log(`coherencia en rachas rapidas: ${nearCount}/${tot} elecciones cercanas al ultimo carril`);
if (tot && nearCount / tot < 0.7) { console.log("FALLO: el modelo salta lejos en rachas (incoherente)"); ok = false; }

console.log(ok ? "\nOK: el mini-modelo de step-selection carga y predice patrones coherentes." : "\nREVISAR step-model.");
process.exit(ok ? 0 : 1);
