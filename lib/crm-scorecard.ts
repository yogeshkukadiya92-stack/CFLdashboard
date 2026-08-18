export const SCORECARD_VERSION = "CFL_SCORECARD_V1" as const;

export const SCORECARD_CONFIG = {
  turnover: {
    "5_CR_PLUS": { label: "Rs 5 Cr+", score: 15 },
    "1_TO_5_CR": { label: "Rs 1 - 5 Cr", score: 12 },
    "50_L_TO_1_CR": { label: "Rs 50 L - 1 Cr", score: 8 },
    "25_TO_50_L": { label: "Rs 25 - 50 L", score: 4 },
    "BELOW_25_L": { label: "Rs 25 L se kam", score: 0 },
    "UNKNOWN": { label: "Pata nahi", score: 0 }
  },
  teamSize: {
    "20_PLUS": { label: "20+ log", score: 10 },
    "10_TO_19": { label: "10 - 19", score: 8 },
    "5_TO_9": { label: "5 - 9", score: 6 },
    "2_TO_4": { label: "2 - 4", score: 3 },
    "SOLO": { label: "Akela", score: 0 }
  },
  timeFreedom: {
    "RUNS_EASILY": { label: "Haan, aaram se chal jaata hai", score: 15 },
    "DAILY_CALLS": { label: "Chalega par roz call karna padta hai", score: 10 },
    "STOPS_WITHOUT_ME": { label: "Nahi, mere bina ruk jaata hai", score: 4 },
    "I_AM_EVERYTHING": { label: "Main hi sab kuch hoon", score: 0 },
    "UNKNOWN": { label: "Pata nahi", score: 0 }
  },
  vintage: {
    "10_PLUS": { label: "10+ saal", score: 10 },
    "5_TO_10": { label: "5 - 10 saal", score: 8 },
    "3_TO_5": { label: "3 - 5 saal", score: 6 },
    "1_TO_3": { label: "1 - 3 saal", score: 3 },
    "BELOW_1": { label: "1 saal se kam", score: 0 }
  },
  behaviour: {
    onTime: { label: "Time pe", score: 5 },
    notesTaken: { label: "Notes liye", score: 8 },
    askedQuestion: { label: "Question", score: 10 },
    stayedUntilEnd: { label: "End tak", score: 7 },
    cameWithSomeone: { label: "Saath aaya", score: 8 },
    metPersonally: { label: "KHUD mila", score: 12 }
  }
} as const;

export type InstantSignal = "A" | "C" | "-";
export type CalculatedTier = "A" | "B" | "C" | "NOT_ATTENDED";
export type TurnoverOption = keyof typeof SCORECARD_CONFIG.turnover;
export type TeamSizeOption = keyof typeof SCORECARD_CONFIG.teamSize;
export type TimeFreedomOption = keyof typeof SCORECARD_CONFIG.timeFreedom;
export type VintageOption = keyof typeof SCORECARD_CONFIG.vintage;

export type ScorecardInput = {
  turnoverOption: TurnoverOption;
  teamSizeOption: TeamSizeOption;
  timeFreedomOption: TimeFreedomOption;
  vintageOption: VintageOption;
  attended: boolean;
  onTime: boolean;
  notesTaken: boolean;
  askedQuestion: boolean;
  stayedUntilEnd: boolean;
  cameWithSomeone: boolean;
  metPersonally: boolean;
  instantSignal: InstantSignal;
};

export function calculateTier(input: { instantSignal: InstantSignal; attended: boolean; totalScore: number }): CalculatedTier {
  if (input.instantSignal === "C") return "C";
  if (input.instantSignal === "A") return "A";
  if (input.attended !== true) return "NOT_ATTENDED";
  if (input.totalScore >= 65) return "A";
  if (input.totalScore >= 40) return "B";
  return "C";
}

export function calculateSessionScorecard(input: ScorecardInput, scoredAt = new Date().toISOString()) {
  const turnoverScore = SCORECARD_CONFIG.turnover[input.turnoverOption].score;
  const teamSizeScore = SCORECARD_CONFIG.teamSize[input.teamSizeOption].score;
  const timeFreedomScore = SCORECARD_CONFIG.timeFreedom[input.timeFreedomOption].score;
  const vintageScore = SCORECARD_CONFIG.vintage[input.vintageOption].score;
  const preScore = turnoverScore + teamSizeScore + timeFreedomScore + vintageScore;
  const behaviourBreakdown = Object.fromEntries(
    Object.entries(SCORECARD_CONFIG.behaviour).map(([key, rule]) => [key, input.attended && input[key as keyof ScorecardInput] === true ? rule.score : 0])
  ) as Record<keyof typeof SCORECARD_CONFIG.behaviour, number>;
  const sessionScore = input.attended ? Object.values(behaviourBreakdown).reduce((sum, score) => sum + score, 0) : 0;
  const totalScore = preScore + sessionScore;
  return {
    scorecardVersion: SCORECARD_VERSION,
    scoredAt,
    turnoverScore,
    teamSizeScore,
    timeFreedomScore,
    vintageScore,
    preScore,
    behaviourBreakdown,
    sessionScore,
    totalScore,
    instantSignal: input.instantSignal,
    calculatedTier: calculateTier({ attended: input.attended, instantSignal: input.instantSignal, totalScore })
  };
}

export type RankedParticipant = { id: string; attended: boolean; totalScore: number; calculatedTier: CalculatedTier; sequence: number };

export function rankParticipants<T extends RankedParticipant>(participants: T[]) {
  const ranked = participants.filter((item) => item.attended).sort((a, b) => b.totalScore - a.totalScore || a.sequence - b.sequence || a.id.localeCompare(b.id));
  let tierACount = 0;
  return ranked.map((participant, index) => {
    if (participant.calculatedTier === "A") tierACount += 1;
    return {
      ...participant,
      rank: index + 1,
      meetingPriority: participant.calculatedTier === "A" ? (tierACount <= 9 ? "TOP_9" : "B_PRIORITY") : "NORMAL"
    } as T & { rank: number; meetingPriority: "TOP_9" | "B_PRIORITY" | "NORMAL" };
  });
}
