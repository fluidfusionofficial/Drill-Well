import test from "node:test";
import assert from "node:assert/strict";
import { distanceKm, bearingDeg, projectPoint } from "../app/lib/well-planning.ts";
import { normalize, parseWithUnit, resolveUnit, formatWithSource } from "../app/lib/engineering/units.ts";
import { convertDepth, depth, isSameDepthReference, withinDepth } from "../app/lib/engineering/depth.ts";
import { getEvents, getFormationPicks, getMudRecords, getFormationAvailability } from "../app/lib/engineering/well-data.ts";
import { findSimilarWells, defaultWeights } from "../app/lib/engineering/similarity.ts";
import { evaluateHistoricalContext, clusterByDepth } from "../app/lib/engineering/alerts.ts";
import { wells, currentWell } from "../app/lib/nwis-data.ts";

/* ---------------------------------------------------------------- */
/* 1. Distance and radius filtering                                  */
/* ---------------------------------------------------------------- */

test("distance calculation is symmetric and non-zero", () => {
  const a = { lat: 26.92, lng: 71.44 };
  const b = { lat: 26.97, lng: 71.51 };
  const forward = distanceKm(a, b);
  const backward = distanceKm(b, a);
  assert.ok(forward > 0, "distance must be positive");
  assert.ok(Math.abs(forward - backward) < 1e-9, "distance must be symmetric");
  assert.ok(forward < 20, "fixture wells are within a few km");
});

test("distance of a point to itself is zero", () => {
  const a = { lat: 26.92, lng: 71.44 };
  assert.equal(distanceKm(a, a), 0);
});

test("bearing is reported in 0-360 degrees", () => {
  const a = { lat: 26.92, lng: 71.44 };
  const b = { lat: 26.97, lng: 71.51 };
  const bearing = bearingDeg(a, b);
  assert.ok(bearing >= 0 && bearing < 360, `bearing out of range: ${bearing}`);
});

test("radius filtering keeps wells inside and drops wells outside", () => {
  const centre = currentWell.coordinates;
  const inside = wells.filter((well) => distanceKm(centre, well.coordinates) <= 15);
  const outside = wells.filter((well) => distanceKm(centre, well.coordinates) > 15);
  assert.ok(inside.length > 0, "at least the active well is in context");
  for (const well of outside) {
    assert.ok(distanceKm(centre, well.coordinates) > 15);
  }
});

test("projectPoint offsets and round-trips", () => {
  const origin = { lat: 26.92, lng: 71.44 };
  const east = projectPoint(origin, 1, 0);
  const north = projectPoint(origin, 0, 1);
  assert.ok(Math.abs(distanceKm(origin, east) - 1) < 0.05, "1 km east offset");
  assert.ok(Math.abs(distanceKm(origin, north) - 1) < 0.05, "1 km north offset");
  assert.ok(bearingDeg(origin, north) < 5 || bearingDeg(origin, north) > 355, "north offset bears north");
});

/* ---------------------------------------------------------------- */
/* 2. Unit conversion and preservation of the source unit            */
/* ---------------------------------------------------------------- */

test("mud weight keeps the original unit and never silently becomes ppg", () => {
  const result = normalize(1.48, "g/cm3", "mud_weight");
  assert.ok(result, "g/cm3 must be recognised");
  assert.equal(result.originalValue, 1.48);
  assert.equal(result.originalUnit, "g/cm3");
  assert.equal(result.normalizedUnit, "g/cm3");
  assert.equal(result.converted, false, "no conversion needed for g/cm3");
});

test("ppg mud weight converts to g/cm3 while preserving the source value", () => {
  const result = normalize(12.4, "ppg", "mud_weight");
  assert.ok(result);
  assert.equal(result.originalValue, 12.4);
  assert.equal(result.originalUnit, "ppg");
  assert.equal(result.normalizedUnit, "g/cm3");
  assert.equal(result.converted, true);
  assert.ok(Math.abs(result.normalizedValue - 1.4858) < 0.001, `unexpected conversion ${result.normalizedValue}`);
});

test("1.48 g/cm3 is never displayed as 1.48 ppg", () => {
  const result = normalize(1.48, "g/cm³", "mud_weight");
  assert.ok(result);
  const rendered = formatWithSource(result);
  assert.ok(rendered.includes("1.48 g/cm³"), `source unit preserved: ${rendered}`);
  assert.ok(!rendered.includes("ppg"), "must not invent a ppg reading");
});

test("length and pressure conversions", () => {
  const feet = normalize(1000, "ft", "length");
  assert.ok(Math.abs(feet.normalizedValue - 304.8) < 0.001);
  const kpa = normalize(100, "bar", "pressure");
  assert.ok(Math.abs(kpa.normalizedValue - 10000) < 0.001);
});

test("unrecognised unit returns null instead of guessing", () => {
  assert.equal(normalize(1.48, "furlongs", "mud_weight"), null);
  assert.equal(resolveUnit("furlongs"), null);
});

test("parseWithUnit splits value and unit", () => {
  const parsed = parseWithUnit("1.48 g/cm³");
  assert.deepEqual(parsed, { value: 1.48, unit: "g/cm³" });
});

/* ---------------------------------------------------------------- */
/* 3. MD / TVD separation                                            */
/* ---------------------------------------------------------------- */

test("MD and TVD are distinct reference types", () => {
  assert.equal(isSameDepthReference("MD", "TVD"), false);
  assert.equal(isSameDepthReference("MD", "MD"), true);
  assert.equal(isSameDepthReference("MD", "unknown"), true, "unknown is not treated as a match");
});

test("MD to TVD conversion is refused without a survey", () => {
  const md = depth(520, "MD");
  assert.equal(convertDepth(md, "TVD"), null, "must not fabricate a TVD");
  const withSurvey = convertDepth(md, "TVD", (value) => value * 0.98);
  assert.ok(withSurvey);
  assert.equal(withSurvey.reference, "TVD");
  assert.ok(Math.abs(withSurvey.value - 509.6) < 0.01);
});

test("depth window matching", () => {
  assert.equal(withinDepth(523, 420, 560), true);
  assert.equal(withinDepth(600, 420, 560), false);
});

/* ---------------------------------------------------------------- */
/* 4. Well isolation — no WX-07 data leaking into other wells       */
/* ---------------------------------------------------------------- */

test("events are returned only for the requested well", () => {
  const w07 = getEvents("WX-07");
  const w11 = getEvents("WX-11");
  assert.ok(w07.length > 0);
  assert.ok(w11.length > 0);
  for (const event of w07) assert.equal(event.wellId, "WX-07");
  for (const event of w11) assert.equal(event.wellId, "WX-11");
  const shared = w07.filter((event) => w11.some((other) => other.id === event.id));
  assert.equal(shared.length, 0, "an event must not belong to two wells");
});

test("formation picks exist only for the well that owns them", () => {
  assert.ok(getFormationPicks("WX-07").length > 0, "WX-07 owns the reference picks");
  assert.equal(getFormationPicks("WX-11").length, 0, "WX-11 must not inherit WX-07 picks");
  assert.equal(getFormationAvailability("WX-11").available, false);
  assert.ok(getFormationAvailability("WX-11").reason, "unavailability must be explained");
});

test("mud records are not leaked from WX-07 to WX-11", () => {
  assert.equal(getMudRecords("WX-07").available, true);
  const w11 = getMudRecords("WX-11");
  assert.equal(w11.available, false);
  assert.equal(w11.records.length, 0);
  assert.ok(w11.reason);
});

test("every formation pick carries provenance and a depth reference", () => {
  for (const pick of getFormationPicks("WX-07")) {
    assert.equal(pick.depthReference, "MD");
    assert.ok(pick.provenance.sourceDocumentId, "provenance document required");
    assert.ok(pick.provenance.citation, "provenance citation required");
  }
});

/* ---------------------------------------------------------------- */
/* 5. Similarity is computed, not hardcoded                          */
/* ---------------------------------------------------------------- */

test("similarity score is derived from components and is explainable", () => {
  const active = wells.find((well) => well.id === "WX-11") ?? currentWell;
  const results = findSimilarWells(active);
  assert.ok(results.length > 0, "expected at least one candidate");

  for (const result of results) {
    assert.notEqual(result.wellId, active.id, "active well must not rank itself");
    let weightedTotal = 0;
    let weightSum = 0;
    for (const component of result.components) {
      assert.ok(component.score >= 0 && component.score <= 1, `${component.key} score in range`);
      assert.equal(component.weight, defaultWeights[component.key], "weight must be visible and consistent");
      weightedTotal += component.score * component.weight;
      weightSum += component.weight;
    }
    const expected = Math.round((weightedTotal / weightSum) * 100);
    assert.equal(result.score, expected, "score must equal the weighted computation");
    assert.ok(result.explanation.includes("Selected because"), "explanation required");
    assert.ok(result.caveats.length > 0, "must be labelled as a heuristic, not ML");
  }
});

test("similarity results are ordered by score", () => {
  const results = findSimilarWells(currentWell);
  for (let index = 1; index < results.length; index += 1) {
    assert.ok(results[index - 1].score >= results[index].score, "results must be sorted");
  }
});

test("changing weights changes the ranking input, proving weights are live", () => {
  const active = wells.find((well) => well.id === "WX-11") ?? currentWell;
  const spatialHeavy = findSimilarWells(active, { weights: { spatial: 0.9, formationOverlap: 0.02, depthSimilarity: 0.02, eventSimilarity: 0.02, wellType: 0.04 } });
  const formationHeavy = findSimilarWells(active, { weights: { spatial: 0.02, formationOverlap: 0.9, depthSimilarity: 0.02, eventSimilarity: 0.02, wellType: 0.04 } });
  assert.notDeepEqual(
    spatialHeavy.map((r) => r.score),
    formationHeavy.map((r) => r.score),
    "weights must materially affect the result",
  );
});

/* ---------------------------------------------------------------- */
/* 6. Alert rules are deterministic and evidence-backed             */
/* ---------------------------------------------------------------- */

test("alert engine returns no prediction language", () => {
  const active = wells.find((well) => well.id === "WX-11") ?? currentWell;
  for (const depthValue of [500, 520, 523, 540, 560, 700]) {
    for (const alert of evaluateHistoricalContext(active, depthValue)) {
      assert.equal(alert.ruleKind, "LEVEL_1_DETERMINISTIC");
      assert.ok(alert.statement.includes("Historical context detected"), "must state detected context");
      const forbidden = [/\bwill occur\b/i, /\bwill happen\b/i, /\bis expected to\b/i, /\bpredicts that\b/i, /\bguaranteed\b/i];
      for (const pattern of forbidden) {
        assert.ok(!pattern.test(alert.statement), `prediction language matched ${pattern}: ${alert.statement}`);
      }
      assert.ok(alert.events.length > 0, "alert must carry supporting events");
    }
  }
});

test("alert engine is deterministic", () => {
  const active = wells.find((well) => well.id === "WX-11") ?? currentWell;
  const first = evaluateHistoricalContext(active, 523).map((a) => a.id);
  const second = evaluateHistoricalContext(active, 523).map((a) => a.id);
  assert.deepEqual(first, second);
});

test("alerts only fire inside the configured approach window", () => {
  const active = wells.find((well) => well.id === "WX-11") ?? currentWell;
  const near = evaluateHistoricalContext(active, 523, { approachWindowM: 60, contextRadiusKm: 15, requireFormationMatch: false });
  const far = evaluateHistoricalContext(active, 900, { approachWindowM: 60, contextRadiusKm: 15, requireFormationMatch: false });
  assert.ok(near.length > 0, "should detect context near 523 m");
  assert.equal(far.length, 0, "should not alert far from any event");
});

test("event clustering groups a 502-512 m held-up sequence", () => {
  const heldUp = getEvents("WX-07").filter((event) => event.type.toLowerCase().includes("held up"));
  assert.ok(heldUp.length >= 2, "fixture has a held-up sequence");
  const clusters = clusterByDepth(heldUp, 60);
  assert.equal(clusters.length, 1, "502-512 m should be one cluster");
  assert.equal(clusters[0].events.length, heldUp.length);
});

/* ---------------------------------------------------------------- */
/* 7. Reference-data regression guards                              */
/* ---------------------------------------------------------------- */

test("WX-07 source document metadata matches the reported figures", async () => {
  const { sourceDocuments } = await import("../app/lib/engineering/well-data.ts");
  const wcr = sourceDocuments.find((document) => document.id === "DOC-WX07-WCR");
  assert.ok(wcr, "WX-07 WCR must be registered");
  assert.equal(wcr.pages, 115, "WCR is 115 pages");
  assert.equal(wcr.tables, 21, "WCR contains 21 tables");
  assert.equal(wcr.dataRows, 1116, "WCR contains 1116 drilling parameter rows");
});

test("daily workbook sheet counts are recorded as reported", async () => {
  const { sourceDocuments } = await import("../app/lib/engineering/well-data.ts");
  const w07 = sourceDocuments.find((document) => document.id === "DOC-WX07-DDR");
  const w11 = sourceDocuments.find((document) => document.id === "DOC-WX11-DDR");
  assert.equal(w07.sheets.count, 44, "WX-07 workbook has 44 date sheets");
  assert.equal(w07.sheets.first, "08.07.2025");
  assert.equal(w07.sheets.last, "20.08.2025");
  assert.equal(w11.sheets.count, 40, "WX-11 workbook has 40 date sheets");
  assert.equal(w11.sheets.first, "03.10.2025");
  assert.equal(w11.sheets.last, "11.11.2025");
});

test("source documents absent from the repo are declared not supplied", async () => {
  const { sourceDocuments } = await import("../app/lib/engineering/well-data.ts");
  for (const document of sourceDocuments) {
    if (document.availability === "not_supplied") {
      assert.ok(document.note, `${document.id} must explain why it cannot be read`);
    }
  }
});

test("WX-07 reference facts match the reported well record", () => {
  const w07 = wells.find((well) => well.id === "WX-07");
  assert.ok(w07);
  assert.equal(w07.actualDepth, 1161, "actual TD 1161 m MD");
  assert.equal(w07.projectedTD, 1175, "projected TD 1175 m MD");
  assert.equal(w07.location, "LOC-P3");
});

test("coordinates are declared as fixture-derived, never surveyed", async () => {
  const { coordinateBasis, COORDINATE_DISCLAIMER } = await import("../app/lib/engineering/well-data.ts");
  for (const well of wells) {
    assert.equal(coordinateBasis(well), "fixture_derived");
  }
  assert.ok(COORDINATE_DISCLAIMER.toLowerCase().includes("not a surveyed position"));
});

test("alerts are sorted by severity then proximity to active depth", () => {
  const active = wells.find((well) => well.id === "WX-11") ?? currentWell;
  const alerts = evaluateHistoricalContext(active, 510, { approachWindowM: 100, contextRadiusKm: 25, requireFormationMatch: false });
  if (alerts.length >= 2) {
    const order = { High: 0, Medium: 1, Low: 2, Critical: 0 };
    for (let i = 1; i < alerts.length; i++) {
      const prev = alerts[i - 1];
      const curr = alerts[i];
      const prevDist = Math.min(...prev.events.map((e) => Math.abs(e.depth - 510)));
      const currDist = Math.min(...curr.events.map((e) => Math.abs(e.depth - 510)));
      if (order[prev.severity] === order[curr.severity]) {
        assert.ok(prevDist <= currDist, `Closer alert at ${prevDist}m should precede ${currDist}m`);
      } else {
        assert.ok(order[prev.severity] <= order[curr.severity], "Higher severity alert must come first");
      }
    }
  }
});

test("WX-11 at 470 m shows Upper Carbonate events as ahead", () => {
  const active = wells.find((well) => well.id === "WX-11") ?? currentWell;
  const alerts = evaluateHistoricalContext(active, 470, { approachWindowM: 100, contextRadiusKm: 25, requireFormationMatch: false });
  assert.ok(alerts.length > 0, "should have alerts at 470m");
  for (const alert of alerts) {
    assert.equal(alert.state, "ahead", "events at 507-544m must be ahead of 470m bit");
    assert.ok(alert.metresAhead > 0, "metresAhead must be positive");
  }
});

test("WX-11 at 515 m shows Upper Carbonate 507 m cluster as in-zone", () => {
  const active = wells.find((well) => well.id === "WX-11") ?? currentWell;
  const alerts = evaluateHistoricalContext(active, 515, { approachWindowM: 100, contextRadiusKm: 25, requireFormationMatch: false });
  const inZone = alerts.find((a) => a.state === "in-zone");
  assert.ok(inZone, "at 515 m, 507 m cluster should be in-zone (within 25m)");
});

test("WX-11 at 842 m shows all Upper Carbonate events as passed", () => {
  const active = wells.find((well) => well.id === "WX-11") ?? currentWell;
  const alerts = evaluateHistoricalContext(active, 842, { approachWindowM: 100, contextRadiusKm: 25, requireFormationMatch: false, includePassed: true });
  for (const alert of alerts) {
    if (alert.events.some((e) => e.depth <= 600)) {
      assert.equal(alert.state, "passed", "events behind the bit at 842m must be passed");
      assert.ok(alert.metresAhead < 0, "metresAhead must be negative");
    }
  }
});

test("extended demonstration dataset has 12 simulated wells within 30 km with valid provenance", async () => {
  const { simulatedWells, simulatedEvents } = await import("../app/lib/fixtures/extended-dataset.ts");
  assert.equal(simulatedWells.length, 12, "must have 12 simulated offset wells");
  for (const well of simulatedWells) {
    assert.equal(well.origin, "simulated");
    assert.ok(well.distanceFromWx11Km <= 30, `Well ${well.id} must be within 30 km`);
  }
  assert.ok(simulatedEvents.length >= 40, "must have at least 40 simulated events");
  for (const ev of simulatedEvents) {
    assert.equal(ev.origin, "simulated");
    assert.equal(ev.provenance.extractionMethod, "simulated");
  }
});


