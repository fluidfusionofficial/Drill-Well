import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateHazardRisk,
  proximityWeight,
  getRiskBand,
} from "../app/lib/engineering/risk.ts";

const mockActiveWell = {
  id: "TEST-01",
  location: "LOC-T1",
  wellType: "Vertical / Development",
  profile: "Vertical",
  rig: "RIG-1",
  status: "Active",
  targetFormation: "Upper Carbonate",
  targetDepth: 1200,
  actualDepth: 1100,
  projectedTD: 1200,
  spudDate: "2025-01-01",
  coordinates: { lat: 26.90, lng: 71.50 },
  formation: "Upper Carbonate",
  currentDepth: 500,
  lastActivity: "Testing",
  nearbyWells: 5,
};

const mockOffsetWellNear = {
  ...mockActiveWell,
  id: "OFFSET-NEAR",
  coordinates: { lat: 26.92, lng: 71.52 }, // ~2.9 km away
};

const mockOffsetWellFar = {
  ...mockActiveWell,
  id: "OFFSET-FAR",
  coordinates: { lat: 27.05, lng: 71.65 }, // ~22 km away
};

const wellsMap = new Map([
  [mockActiveWell.id, mockActiveWell],
  [mockOffsetWellNear.id, mockOffsetWellNear],
  [mockOffsetWellFar.id, mockOffsetWellFar],
]);

test("proximityWeight returns 0 for events above the bit", () => {
  const cursor = 500;
  const lookAheadM = 100;
  assert.equal(proximityWeight(400, cursor, lookAheadM), 0);
  assert.equal(proximityWeight(499.9, cursor, lookAheadM), 0);
});

test("proximityWeight returns 1.0 inside look-ahead window", () => {
  const cursor = 500;
  const lookAheadM = 100;
  assert.equal(proximityWeight(500, cursor, lookAheadM), 1.0);
  assert.equal(proximityWeight(550, cursor, lookAheadM), 1.0);
  assert.equal(proximityWeight(600, cursor, lookAheadM), 1.0);
});

test("proximityWeight decays smoothly below look-ahead window", () => {
  const cursor = 500;
  const lookAheadM = 100;
  const at600 = proximityWeight(600, cursor, lookAheadM);
  const at640 = proximityWeight(640, cursor, lookAheadM);
  const at720 = proximityWeight(720, cursor, lookAheadM);

  assert.equal(at600, 1.0);
  assert.ok(at640 < 1.0 && at640 > 0.5, "sigma 40m gives exp(-0.5) ~ 0.606");
  assert.ok(at720 < at640, "farther depths decay further");
});

test("events above the cursor give 0 risk index", () => {
  const pastEvents = [
    {
      id: "EV-PAST-1",
      wellId: "OFFSET-NEAR",
      type: "Mud Loss",
      date: "2025-01-02",
      depth: 350,
      formation: "Upper Carbonate",
      severity: "Critical",
      description: "Past mud loss",
      response: "None",
      outcome: "Resolved",
      source: "DDR",
      sourcePage: "p.1",
      confidence: "HIGH",
    },
  ];

  const result = calculateHazardRisk(
    "Mud loss",
    pastEvents,
    mockActiveWell,
    500, // cursor is at 500m, event is at 350m
    wellsMap,
    { radiusKm: 15, lookAheadM: 100 }
  );

  assert.equal(result.index, 0);
  assert.equal(result.band, "Low");
  assert.equal(result.eventCount, 0);
});

test("more events raise the risk index", () => {
  const singleEvent = [
    {
      id: "EV-1",
      wellId: "OFFSET-NEAR",
      type: "Mud Loss",
      date: "2025-01-02",
      depth: 530,
      formation: "Upper Carbonate",
      severity: "High",
      description: "Mud loss",
      response: "LCM",
      outcome: "Stable",
      source: "DDR",
      sourcePage: "p.1",
      confidence: "HIGH",
    },
  ];

  const multipleEvents = [
    ...singleEvent,
    {
      id: "EV-2",
      wellId: "OFFSET-NEAR",
      type: "Mud Loss",
      date: "2025-01-03",
      depth: 540,
      formation: "Upper Carbonate",
      severity: "High",
      description: "Second mud loss",
      response: "LCM",
      outcome: "Stable",
      source: "DDR",
      sourcePage: "p.2",
      confidence: "HIGH",
    },
  ];

  const singleResult = calculateHazardRisk("Mud loss", singleEvent, mockActiveWell, 500, wellsMap, { radiusKm: 15 });
  const multiResult = calculateHazardRisk("Mud loss", multipleEvents, mockActiveWell, 500, wellsMap, { radiusKm: 15 });

  assert.ok(multiResult.index > singleResult.index, `Multiple events (${multiResult.index}) should exceed single (${singleResult.index})`);
});

test("closer events raise the risk index compared to farther events", () => {
  const nearEvent = [
    {
      id: "EV-NEAR",
      wellId: "OFFSET-NEAR",
      type: "Kick / influx",
      date: "2025-01-02",
      depth: 550,
      formation: "Upper Carbonate",
      severity: "High",
      description: "Gas influx",
      response: "Circulate out",
      outcome: "Stable",
      source: "DDR",
      sourcePage: "p.1",
      confidence: "HIGH",
    },
  ];

  const farEvent = [
    {
      ...nearEvent[0],
      id: "EV-FAR",
      wellId: "OFFSET-FAR",
    },
  ];

  const nearResult = calculateHazardRisk("Kick / influx", nearEvent, mockActiveWell, 500, wellsMap, { radiusKm: 25 });
  const farResult = calculateHazardRisk("Kick / influx", farEvent, mockActiveWell, 500, wellsMap, { radiusKm: 25 });

  assert.ok(nearResult.index > farResult.index, `Near offset well (${nearResult.index}) must produce higher risk than far (${farResult.index})`);
});

test("a smaller search radius never raises the risk index", () => {
  const events = [
    {
      id: "EV-1",
      wellId: "OFFSET-NEAR",
      type: "Held Up",
      date: "2025-01-02",
      depth: 520,
      formation: "Upper Carbonate",
      severity: "Medium",
      description: "Held up",
      response: "Ream",
      outcome: "Stable",
      source: "DDR",
      sourcePage: "p.1",
      confidence: "HIGH",
    },
  ];

  const wideRadius = calculateHazardRisk("Held-up / stuck pipe", events, mockActiveWell, 500, wellsMap, { radiusKm: 25 });
  const narrowRadius = calculateHazardRisk("Held-up / stuck pipe", events, mockActiveWell, 500, wellsMap, { radiusKm: 5 });

  assert.ok(narrowRadius.index <= wideRadius.index, "Smaller radius must never raise the risk score");
});

test("risk bands categorize 0-100 score accurately", () => {
  assert.equal(getRiskBand(0), "Low");
  assert.equal(getRiskBand(24), "Low");
  assert.equal(getRiskBand(25), "Moderate");
  assert.equal(getRiskBand(55), "Moderate");
  assert.equal(getRiskBand(56), "High");
  assert.equal(getRiskBand(100), "High");
});
