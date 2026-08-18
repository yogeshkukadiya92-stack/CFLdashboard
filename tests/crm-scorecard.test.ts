import assert from "node:assert/strict";
import test from "node:test";
import { calculateSessionScorecard, calculateTier, rankParticipants, SCORECARD_CONFIG } from "../lib/crm-scorecard.ts";

const base = {
  turnoverOption: "BELOW_25_L" as const,
  teamSizeOption: "SOLO" as const,
  timeFreedomOption: "UNKNOWN" as const,
  vintageOption: "BELOW_1" as const,
  attended: true,
  onTime: false,
  notesTaken: false,
  askedQuestion: false,
  stayedUntilEnd: false,
  cameWithSomeone: false,
  metPersonally: false,
  instantSignal: "-" as const
};

test("every qualification option returns its configured score", () => {
  for (const [turnoverOption, rule] of Object.entries(SCORECARD_CONFIG.turnover)) assert.equal(calculateSessionScorecard({ ...base, turnoverOption: turnoverOption as keyof typeof SCORECARD_CONFIG.turnover }).turnoverScore, rule.score);
  for (const [teamSizeOption, rule] of Object.entries(SCORECARD_CONFIG.teamSize)) assert.equal(calculateSessionScorecard({ ...base, teamSizeOption: teamSizeOption as keyof typeof SCORECARD_CONFIG.teamSize }).teamSizeScore, rule.score);
  for (const [timeFreedomOption, rule] of Object.entries(SCORECARD_CONFIG.timeFreedom)) assert.equal(calculateSessionScorecard({ ...base, timeFreedomOption: timeFreedomOption as keyof typeof SCORECARD_CONFIG.timeFreedom }).timeFreedomScore, rule.score);
  for (const [vintageOption, rule] of Object.entries(SCORECARD_CONFIG.vintage)) assert.equal(calculateSessionScorecard({ ...base, vintageOption: vintageOption as keyof typeof SCORECARD_CONFIG.vintage }).vintageScore, rule.score);
});

test("attendance gates session score and all yes totals 50", () => {
  assert.equal(calculateSessionScorecard({ ...base, attended: false, onTime: true, notesTaken: true, askedQuestion: true, stayedUntilEnd: true, cameWithSomeone: true, metPersonally: true }).sessionScore, 0);
  assert.equal(calculateSessionScorecard({ ...base, onTime: true, notesTaken: true, askedQuestion: true, stayedUntilEnd: true, cameWithSomeone: true, metPersonally: true }).sessionScore, 50);
});

test("tier boundaries and override order are exact", () => {
  assert.equal(calculateTier({ totalScore: 65, attended: true, instantSignal: "-" }), "A");
  assert.equal(calculateTier({ totalScore: 64, attended: true, instantSignal: "-" }), "B");
  assert.equal(calculateTier({ totalScore: 40, attended: true, instantSignal: "-" }), "B");
  assert.equal(calculateTier({ totalScore: 39, attended: true, instantSignal: "-" }), "C");
  assert.equal(calculateTier({ totalScore: 20, attended: true, instantSignal: "A" }), "A");
  assert.equal(calculateTier({ totalScore: 90, attended: true, instantSignal: "C" }), "C");
  assert.equal(calculateTier({ totalScore: 90, attended: false, instantSignal: "-" }), "NOT_ATTENDED");
  assert.equal(calculateTier({ totalScore: 90, attended: false, instantSignal: "A" }), "A");
  assert.equal(calculateTier({ totalScore: 90, attended: false, instantSignal: "C" }), "C");
});

test("ranking is stable and Top 9 never promotes non-A tiers", () => {
  const ranked = rankParticipants([
    { id: "four", totalScore: 70, sequence: 4, attended: true, calculatedTier: "A" },
    { id: "three", totalScore: 85, sequence: 3, attended: true, calculatedTier: "A" },
    { id: "two", totalScore: 85, sequence: 2, attended: true, calculatedTier: "A" },
    { id: "one", totalScore: 100, sequence: 1, attended: true, calculatedTier: "A" },
    { id: "b", totalScore: 60, sequence: 5, attended: true, calculatedTier: "B" }
  ]);
  assert.deepEqual(ranked.map((row) => row.id), ["one", "two", "three", "four", "b"]);
  assert.equal(ranked.at(-1)?.meetingPriority, "NORMAL");
});

test("stored V1 result is not affected by calculating another input", () => {
  const v1 = calculateSessionScorecard(base, "2026-08-18T00:00:00.000Z");
  const snapshot = structuredClone(v1);
  calculateSessionScorecard({ ...base, attended: false });
  assert.deepEqual(v1, snapshot);
  assert.equal(v1.scorecardVersion, "CFL_SCORECARD_V1");
});
