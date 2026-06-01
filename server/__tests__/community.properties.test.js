// community.properties.test.js
// Tests de PROPIEDADES (property-based con fast-check) del nucleo puro de
// community.js. Cada test implementa UNA propiedad de corrección del diseño,
// con minimo 100 iteraciones.
//
// Feature: community-charts

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  normalizeText,
  computeFingerprint,
  canonicalTuple,
  buildPackage,
  serializePackage,
  parsePackage,
  validatePackage,
  filterEntries,
  applyToStore,
  readFromStore,
  PACKAGE_VERSION,
} from "../community.js";

const RUNS = { numRuns: 100 };

// ---------------- Generadores ----------------

const textArb = fc.string({ maxLength: 40 });
const metaArb = fc.record({
  title: fc.oneof(textArb, fc.constant("Canción Ñoña áéí")),
  artist: fc.oneof(textArb, fc.constant("")),
  duration: fc.double({ min: 1, max: 600, noNaN: true, noDefaultInfinity: true }),
  bpm: fc.double({ min: 40, max: 300, noNaN: true, noDefaultInfinity: true }),
});

// Variante cosmetica: cambia caso/acentos/espacios SIN alterar la tupla
// canonica (para P1). Inserta espacios alrededor y al inicio/fin, y reemplaza
// algunas letras por su version con/ sin acento de forma controlada.
function cosmeticVariant(meta) {
  const spice = (s) => {
    if (s == null) s = "";
    // Mayusculas alternadas + espacios extra al inicio/fin + dobles espacios.
    let out = "  " + String(s).split("").map((ch, i) => (i % 2 ? ch.toUpperCase() : ch.toLowerCase())).join("") + "   ";
    out = out.replace(/ /g, "  ");   // duplicar espacios internos (se colapsan)
    return out;
  };
  return { title: spice(meta.title), artist: spice(meta.artist), duration: meta.duration, bpm: meta.bpm };
}

// Genera un chart valido para una metadata dada.
function chartArbFor(duration) {
  const laneCount = fc.constantFrom(4, 5);
  return laneCount.chain((lc) =>
    fc.record({
      laneCount: fc.constant(lc),
      duration: fc.constant(duration),
      bpm: fc.double({ min: 40, max: 300, noNaN: true, noDefaultInfinity: true }),
      notes: fc.array(
        fc.record({
          time: fc.double({ min: 0, max: duration, noNaN: true, noDefaultInfinity: true }),
          lane: fc.integer({ min: 0, max: lc - 1 }),
          duration: fc.option(fc.double({ min: 0.1, max: 4, noNaN: true, noDefaultInfinity: true }), { nil: undefined }),
        }),
        { minLength: 1, maxLength: 30 }
      ),
    })
  );
}

const attributionArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
  contact: fc.option(fc.string({ maxLength: 20 }), { nil: undefined }),
  note: fc.option(fc.string({ maxLength: 40 }), { nil: undefined }),
});

// Genera un Chart_Package valido.
const packageArb = fc.record({
  duration: fc.double({ min: 5, max: 600, noNaN: true, noDefaultInfinity: true }),
  game: fc.constantFrom("dance", "guitar"),
  difficulty: fc.constantFrom("easy", "normal", "hard", "expert"),
  title: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
  artist: fc.string({ maxLength: 20 }),
  bpm: fc.double({ min: 40, max: 300, noNaN: true, noDefaultInfinity: true }),
  attribution: attributionArb,
}).chain((base) =>
  chartArbFor(base.duration).map((chart) => {
    const metadata = {
      game: base.game, difficulty: base.difficulty, laneCount: chart.laneCount,
      title: base.title, artist: base.artist, bpm: base.bpm, duration: base.duration,
    };
    return buildPackage({ chart, metadata, attribution: base.attribution });
  })
);

// ---------------- Property 1 ----------------
describe("Property 1: reproducibilidad y normalizacion del fingerprint", () => {
  it("mismo meta -> mismo fingerprint, y variantes cosmeticas no lo cambian", () => {
    // Feature: community-charts, Property 1
    fc.assert(fc.property(metaArb, (meta) => {
      const fp1 = computeFingerprint(meta);
      const fp2 = computeFingerprint(meta);
      expect(fp1).toBe(fp2);
      const fpVar = computeFingerprint(cosmeticVariant(meta));
      expect(fpVar).toBe(fp1);
      expect(fp1).toMatch(/^[0-9a-f]{40}$/);
    }), RUNS);
  });
});

// ---------------- Property 2 ----------------
describe("Property 2: no-colision del fingerprint ante tuplas canonicas distintas", () => {
  it("tuplas canonicas iguales <=> fingerprints iguales", () => {
    // Feature: community-charts, Property 2
    fc.assert(fc.property(metaArb, metaArb, (a, b) => {
      const ta = JSON.stringify(canonicalTuple(a));
      const tb = JSON.stringify(canonicalTuple(b));
      const fa = computeFingerprint(a);
      const fb = computeFingerprint(b);
      if (ta === tb) expect(fa).toBe(fb);
      else expect(fa).not.toBe(fb);
    }), RUNS);
  });
});

// ---------------- Property 3 ----------------
describe("Property 3: round-trip de serializacion del Chart_Package", () => {
  it("serializar y parsear produce un package equivalente", () => {
    // Feature: community-charts, Property 3
    fc.assert(fc.property(packageArb, (pkg) => {
      const json = serializePackage(pkg);
      const back = parsePackage(json);
      expect(back).toEqual(pkg);
      expect(back.version).toBe(PACKAGE_VERSION);
      expect(back.chart).toEqual(pkg.chart);
      expect(back.metadata).toEqual(pkg.metadata);
      expect(back.attribution).toEqual(pkg.attribution);
      expect(back.fingerprint).toBe(pkg.fingerprint);
    }), RUNS);
  });
});

// ---------------- Property 4 ----------------
describe("Property 4: invariante de sin-audio", () => {
  it("los packages construidos no tienen audio; añadir audio se rechaza", () => {
    // Feature: community-charts, Property 4
    const audioFieldArb = fc.constantFrom("audio", "samples", "pcm", "dataUrl", "waveform", "mp3");
    fc.assert(fc.property(packageArb, audioFieldArb, (pkg, audioField) => {
      // Construido: sin audio -> valido.
      expect(validatePackage(pkg).ok).toBe(true);
      // Inyectar audio en raiz -> rechazado.
      const tainted = { ...pkg, [audioField]: "ZmFrZS1hdWRpbw==" };
      const res = validatePackage(tainted);
      expect(res.ok).toBe(false);
      expect(res.rule).toBe("audio");
    }), RUNS);
  });
});

// ---------------- Property 5 ----------------
describe("Property 5: rechazo de paquetes malformados o con campos faltantes", () => {
  it("eliminar/corromper un campo requerido provoca rechazo con error descriptivo", () => {
    // Feature: community-charts, Property 5
    const breakers = [
      (p) => { delete p.version; },
      (p) => { delete p.fingerprint; },
      (p) => { delete p.metadata.game; },
      (p) => { delete p.metadata.difficulty; },
      (p) => { delete p.metadata.laneCount; },
      (p) => { delete p.metadata.title; },
      (p) => { delete p.metadata.bpm; },
      (p) => { delete p.metadata.duration; },
      (p) => { p.attribution.name = "   "; },
      (p) => { p.attribution.name = ""; },
    ];
    fc.assert(fc.property(packageArb, fc.nat(breakers.length - 1), (pkg, idx) => {
      const broken = JSON.parse(serializePackage(pkg));
      breakers[idx](broken);
      const res = validatePackage(broken);
      expect(res.ok).toBe(false);
      expect(typeof res.error).toBe("string");
      expect(res.error.length).toBeGreaterThan(0);
    }), RUNS);
  });
});

// ---------------- Property 6 ----------------
describe("Property 6: validacion de notas (aceptacion/rechazo y regla violada)", () => {
  it("acepta sii >=1 nota y todas en rango; identifica la regla al rechazar", () => {
    // Feature: community-charts, Property 6
    const lcArb = fc.constantFrom(4, 5);
    const durArb = fc.double({ min: 5, max: 300, noNaN: true, noDefaultInfinity: true });
    const noteArb = (dur, lc) => fc.record({
      time: fc.double({ min: -5, max: dur + 5, noNaN: true, noDefaultInfinity: true }),
      lane: fc.integer({ min: -2, max: lc + 2 }),
    });
    fc.assert(fc.property(
      lcArb.chain((lc) => durArb.chain((dur) =>
        fc.record({ lc: fc.constant(lc), dur: fc.constant(dur), notes: fc.array(noteArb(dur, lc), { maxLength: 20 }) })
      )),
      ({ lc, dur, notes }) => {
        const chart = { laneCount: lc, duration: dur, bpm: 120, notes };
        const metadata = { game: "dance", difficulty: "normal", laneCount: lc, title: "t", artist: "", bpm: 120, duration: dur };
        const pkg = buildPackage({ chart, metadata, attribution: { name: "a" } });
        // Predicado de referencia.
        const valid = notes.length >= 1 && notes.every((n) =>
          Number.isFinite(n.time) && n.time >= 0 && n.time <= dur &&
          Number.isInteger(n.lane) && n.lane >= 0 && n.lane < lc);
        const res = validatePackage(pkg);
        expect(res.ok).toBe(valid);
        if (!res.ok) {
          expect(["no-notes", "time-out-of-range", "lane-out-of-range"]).toContain(res.rule);
        }
      }
    ), RUNS);
  });
});

// ---------------- Property 7 ----------------
describe("Property 7: rechazo por limite de tamaño", () => {
  it("acepta sii bytes(serializado) <= maxBytes", () => {
    // Feature: community-charts, Property 7
    fc.assert(fc.property(packageArb, fc.integer({ min: 50, max: 4000 }), (pkg, maxBytes) => {
      const bytes = Buffer.byteLength(serializePackage(pkg), "utf8");
      const res = validatePackage(pkg, { maxBytes });
      if (bytes <= maxBytes) {
        // Puede fallar por OTRA regla, pero NUNCA por tamaño.
        if (!res.ok) expect(res.rule).not.toBe("size");
      } else {
        // Excede: si pasa las demas reglas, debe fallar por tamaño.
        expect(res.ok).toBe(false);
        // La unica razon valida de fallo aqui (package valido en lo demas) es size.
        expect(res.rule).toBe("size");
      }
    }), RUNS);
  });
});

// ---------------- Property 8 ----------------
describe("Property 8: solidez y completitud del filtro de busqueda", () => {
  it("devuelve exactamente las entradas que cumplen todos los campos activos", () => {
    // Feature: community-charts, Property 8
    const entryArb = fc.record({
      fingerprint: fc.constantFrom("aa", "bb", "cc"),
      game: fc.constantFrom("dance", "guitar"),
      difficulty: fc.constantFrom("easy", "normal", "hard"),
      laneCount: fc.constantFrom(4, 5),
      title: fc.string({ maxLength: 8 }),
    });
    const filterArb = fc.record({
      fingerprint: fc.option(fc.constantFrom("aa", "bb", "cc"), { nil: undefined }),
      game: fc.option(fc.constantFrom("dance", "guitar"), { nil: undefined }),
      difficulty: fc.option(fc.constantFrom("easy", "normal", "hard"), { nil: undefined }),
      laneCount: fc.option(fc.constantFrom(4, 5), { nil: undefined }),
    });
    fc.assert(fc.property(fc.array(entryArb, { maxLength: 30 }), filterArb, (entries, filter) => {
      const result = filterEntries(entries, filter);
      const active = ["fingerprint", "game", "difficulty", "laneCount"].filter((k) => filter[k] != null);
      const matches = (e) => active.every((k) => Number(e[k]) === Number(filter[k]) || e[k] === filter[k]);
      // Solidez: todo lo devuelto cumple.
      for (const e of result) expect(matches(e)).toBe(true);
      // Completitud: todo lo que cumple esta.
      const expected = entries.filter(matches);
      expect(result.length).toBe(expected.length);
    }), RUNS);
  });
});

// ---------------- Property 9 ----------------
describe("Property 9: separacion al aplicar + round-trip de almacenamiento", () => {
  it("se guarda bajo game/difficulty/laneCount, conserva atribucion y no colisiona 4 vs 5", () => {
    // Feature: community-charts, Property 9
    fc.assert(fc.property(packageArb, fc.string({ minLength: 1, maxLength: 10 }), (pkg, songId) => {
      const store = {};
      applyToStore(store, songId, pkg);
      const back = readFromStore(store, songId, pkg.metadata.game, pkg.metadata.difficulty, pkg.chart.laneCount);
      expect(back).not.toBeNull();
      expect(back.notes.length).toBe(pkg.chart.notes.length);
      expect(back.attribution.name).toBe(pkg.attribution.name);

      // Variante que difiere SOLO en laneCount: ambas recuperables independientes.
      const otherLanes = pkg.chart.laneCount === 5 ? 4 : 5;
      const pkg2 = JSON.parse(serializePackage(pkg));
      pkg2.chart.laneCount = otherLanes;
      pkg2.metadata.laneCount = otherLanes;
      // recortar carriles fuera de rango tras el cambio
      pkg2.chart.notes = pkg2.chart.notes.map((n) => ({ ...n, lane: Math.min(n.lane, otherLanes - 1) }));
      applyToStore(store, songId, pkg2);

      const a = readFromStore(store, songId, pkg.metadata.game, pkg.metadata.difficulty, pkg.chart.laneCount);
      const b = readFromStore(store, songId, pkg2.metadata.game, pkg2.metadata.difficulty, otherLanes);
      expect(a.laneCount).toBe(pkg.chart.laneCount);
      expect(b.laneCount).toBe(otherLanes);
    }), RUNS);
  });
});
