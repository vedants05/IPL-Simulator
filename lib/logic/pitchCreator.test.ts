import assert from "node:assert/strict";
import test from "node:test";

import { getHomeStadium } from "@/lib/data/pitchCurator";
import {
  calculatePitchCreationDays,
  deriveCustomPitch,
  derivePitchMetrics,
} from "./pitchCreator";

const stadium = getHomeStadium("KKR")!;

test("a dry worn black-soil surface becomes a rank turner", () => {
  const pitch = deriveCustomPitch({
    id: "custom-turner",
    teamId: "KKR",
    stadium,
    soil: "black",
    sliders: {
      compaction: 5,
      grassCover: 1,
      moisture: 2,
      surfaceWear: 10,
      consistency: 7,
    },
    createdOn: "2027-01-01",
  });

  assert.equal(pitch.name, "Rank Turner");
  assert.ok(pitch.metrics.spinGrip >= 8.5);
  assert.ok(pitch.favours.includes("spin-bowlers"));
  assert.ok(pitch.doesNotFavour.includes("pace-bowlers"));
});

test("a hard consistent red-soil surface produces strong batting and bounce", () => {
  const metrics = derivePitchMetrics("red", {
    compaction: 10,
    grassCover: 1,
    moisture: 4,
    surfaceWear: 1,
    consistency: 10,
  });

  assert.ok(metrics.battingEase >= 8);
  assert.ok(metrics.bounce >= 8);
  assert.ok(metrics.spinGrip <= 4);
});

test("creation takes 42 to 70 days and difficult black-soil builds take longer", () => {
  const standard = calculatePitchCreationDays("red", {
    compaction: 6,
    grassCover: 5,
    moisture: 5,
    surfaceWear: 4,
    consistency: 7,
  });
  const difficult = calculatePitchCreationDays("black", {
    compaction: 10,
    grassCover: 9,
    moisture: 9,
    surfaceWear: 9,
    consistency: 2,
  });

  assert.equal(standard, 42);
  assert.ok(difficult > standard);
  assert.ok(difficult <= 70);
});

test("expected score is derived and remains within the supported range", () => {
  const pitch = deriveCustomPitch({
    id: "custom-balanced",
    teamId: "KKR",
    stadium,
    soil: "red",
    sliders: {},
    createdOn: "2027-01-01",
  });

  assert.ok(pitch.expectedFirstInningsScore.min >= 120);
  assert.ok(pitch.expectedFirstInningsScore.max <= 250);
  assert.ok(pitch.expectedFirstInningsScore.max > pitch.expectedFirstInningsScore.min);
});
