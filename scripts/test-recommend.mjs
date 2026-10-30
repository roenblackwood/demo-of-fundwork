import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const sourcePath = new URL("../src/lib/recommend.ts", import.meta.url);
const source = readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
});
const file = join(tmpdir(), "fw-recommend.mjs");
writeFileSync(file, compiled.outputText);
const recommend = await import(pathToFileURL(file).href);

const now = Date.parse("2026-10-29T12:00:00.000Z");

function item(patch) {
  return {
    id: "item",
    sector: "lodging",
    sectorLabel: "Places to stay",
    kindId: null,
    countryId: "jamaica",
    parishId: "westmoreland",
    townId: "negril",
    regionId: "caribbean",
    place: "Westmoreland",
    skills: [{ id: "building", phrase: "building" }],
    openSpots: 4,
    readiness: 1,
    createdAt: "2026-09-01T00:00:00.000Z",
    stillNeededUsd: 30000,
    confirmedIn: true,
    fundedRatio: 0.4,
    ...patch,
  };
}

function worker(patch) {
  return {
    reach: "town",
    countryId: "jamaica",
    parishId: "westmoreland",
    townId: "negril",
    regionId: "caribbean",
    skills: [{ id: "building", level: "experienced", phrase: "building" }],
    seeEverywhere: false,
    ...patch,
  };
}

function numbersIn(text) {
  return [...text.matchAll(/\d+/g)].map((match) => Number(match[0]));
}

test("a place outside reach scores 0 until See everywhere", () => {
  const home = recommend.scoreForWorker(item(), worker(), now);
  const away = recommend.scoreForWorker(
    item({ id: "away", townId: "downtown", parishId: "kingston", place: "Kingston" }),
    worker(),
    now,
  );
  const opened = recommend.scoreForWorker(
    item({ id: "away", townId: "downtown", parishId: "kingston", place: "Kingston" }),
    worker({ seeEverywhere: true }),
    now,
  );
  assert.ok(home.score > 0);
  assert.equal(away.score, 0);
  assert.deepEqual(away.reasons, []);
  assert.ok(opened.score > 0);
});

test("every fifth slot can hold a fresh post", () => {
  const rows = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((id, index) => ({
    id,
    sector: index % 2 === 0 ? "one" : "two",
    score: 100 - index,
    createdAt: id === "j" ? "2026-10-20T00:00:00.000Z" : "2026-01-01T00:00:00.000Z",
  }));
  const ordered = recommend.orderForYou(rows, now);
  assert.equal(ordered[4].id, "j");
  assert.equal(ordered.length, rows.length);
});

test("no sector runs longer than two", () => {
  const rows = [
    { id: "1", sector: "farming", score: 90, createdAt: "" },
    { id: "2", sector: "farming", score: 80, createdAt: "" },
    { id: "3", sector: "farming", score: 70, createdAt: "" },
    { id: "4", sector: "water", score: 60, createdAt: "" },
  ];
  const ordered = recommend.orderForYou(rows, now);
  assert.deepEqual(ordered.map((row) => row.id), ["1", "2", "4", "3"]);
  for (let index = 2; index < ordered.length; index += 1) {
    const same =
      ordered[index].sector === ordered[index - 1].sector &&
      ordered[index].sector === ordered[index - 2].sector;
    assert.equal(same, false);
  }
});

test("reason numbers stay inside the item", () => {
  const row = item({ openSpots: 2, readiness: 0, createdAt: "", confirmedIn: false, fundedRatio: 0 });
  const scored = recommend.scoreForWorker(row, worker({ skills: [{ id: "building", level: "learning", phrase: "building" }] }), now);
  const investor = recommend.scoreForInvestor(
    row,
    { sectors: ["lodging"], kinds: [], places: ["anywhere"], minUsd: 5000, maxUsd: 20000 },
    now,
  );
  const cap = row.openSpots;
  for (const line of [...scored.reasons, ...scored.parts.map((part) => part.text), ...investor.reasons, ...investor.parts.map((part) => part.text)]) {
    for (const value of numbersIn(line)) {
      assert.ok(value <= cap, `${line} has ${value}, above ${cap}`);
    }
  }
  assert.equal(source.toLowerCase().includes("expected return"), false);
  assert.equal(scored.reasons.some((line) => line.includes("Needs building in Westmoreland")), true);
});
