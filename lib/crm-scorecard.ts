export const SCORECARD_VERSION = "CFL_SCORECARD_V1" as const;

export const SCORECARD_CONFIG = {
  turnover: {
    "5_CR_PLUS": { label: "Rs 5 Cr+", score: 15 },
    "1_TO_5_CR": { label: "Rs 1 - 5 Cr", score: 12 },
    "50_L_TO_1_CR": { label: "Rs 50 L - 1 Cr", score: 8 },
    "25_TO_50_L": { label: "Rs 25 - 50 L", score: 4 },
    "BELOW_25_L": { label: "Below Rs 25 L", score: 0 },
    "UNKNOWN": { label: "Not sure", score: 0 }
  },
  teamSize: {
    "20_PLUS": { label: "20+ people", score: 10 },
    "10_TO_19": { label: "10 - 19", score: 8 },
    "5_TO_9": { label: "5 - 9", score: 6 },
    "2_TO_4": { label: "2 - 4", score: 3 },
    "SOLO": { label: "Solo", score: 0 }
  },
  timeFreedom: {
    "RUNS_EASILY": { label: "Yes, it runs smoothly without me", score: 15 },
    "DAILY_CALLS": { label: "It runs, but I need to make daily calls", score: 10 },
    "STOPS_WITHOUT_ME": { label: "No, it stops without me", score: 4 },
    "I_AM_EVERYTHING": { label: "I handle everything", score: 0 },
    "UNKNOWN": { label: "Not sure", score: 0 }
  },
  vintage: {
    "10_PLUS": { label: "10+ years", score: 10 },
    "5_TO_10": { label: "5 - 10 years", score: 8 },
    "3_TO_5": { label: "3 - 5 years", score: 6 },
    "1_TO_3": { label: "1 - 3 years", score: 3 },
    "BELOW_1": { label: "Less than 1 year", score: 0 }
  },
  behaviour: {
    onTime: { label: "Arrived on time", score: 5 },
    notesTaken: { label: "Took notes", score: 8 },
    askedQuestion: { label: "Asked a question", score: 10 },
    stayedUntilEnd: { label: "Stayed until the end", score: 7 },
    cameWithSomeone: { label: "Came with someone", score: 8 },
    metPersonally: { label: "Met personally", score: 12 }
  }
} as const;

export type InstantSignal = "A" | "C" | "-";
export type CalculatedTier = "A" | "B" | "C" | "NOT_ATTENDED";
export type TurnoverOption = keyof typeof SCORECARD_CONFIG.turnover;
export type TeamSizeOption = keyof typeof SCORECARD_CONFIG.teamSize;
export type TimeFreedomOption = keyof typeof SCORECARD_CONFIG.timeFreedom;
export type VintageOption = keyof typeof SCORECARD_CONFIG.vintage;

export type PreQualificationInput = Pick<ScorecardInput, "turnoverOption" | "teamSizeOption" | "timeFreedomOption" | "vintageOption">;

const qualificationGroups = {
  turnoverOption: SCORECARD_CONFIG.turnover,
  teamSizeOption: SCORECARD_CONFIG.teamSize,
  timeFreedomOption: SCORECARD_CONFIG.timeFreedom,
  vintageOption: SCORECARD_CONFIG.vintage
} as const;

const questionAliases: Record<keyof typeof qualificationGroups, string[]> = {
  turnoverOption: ["turnover", "annual turnover", "business turnover", "revenue", "annual revenue"],
  teamSizeOption: ["team size", "number of employees", "employees", "staff size", "team members"],
  timeFreedomOption: ["time freedom", "business without you", "run without you", "business dependency", "owner dependency"],
  vintageOption: ["vintage", "business age", "years in business", "how old is your business", "business experience"]
};

function normalized(value: unknown) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function optionFromValue(config: Record<string, { label: string }>, value: unknown) {
  const candidate = normalized(value);
  if (!candidate) return null;
  const legacyOptions: Record<string, string> = {
    "rs 25 l se kam": "BELOW_25_L", "pata nahi": "UNKNOWN", "20 log": "20_PLUS", akela: "SOLO",
    "haan aaram se chal jaata hai": "RUNS_EASILY", "chalega par roz call karna padta hai": "DAILY_CALLS",
    "nahi mere bina ruk jaata hai": "STOPS_WITHOUT_ME", "main hi sab kuch hoon": "I_AM_EVERYTHING",
    "10 saal": "10_PLUS", "5 10 saal": "5_TO_10", "3 5 saal": "3_TO_5", "1 3 saal": "1_TO_3", "1 saal se kam": "BELOW_1"
  };
  if (legacyOptions[candidate] && legacyOptions[candidate] in config) return legacyOptions[candidate];
  const direct = Object.keys(config).find((key) => normalized(key) === candidate);
  if (direct) return direct;
  return Object.entries(config).find(([, item]) => {
    const label = normalized(item.label);
    return candidate === label || candidate.startsWith(`${label} `) || label.startsWith(`${candidate} `);
  })?.[0] ?? null;
}

export function extractPreQualification(answers: unknown): PreQualificationInput | null {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return null;
  const entries = Object.entries(answers as Record<string, unknown>);
  const result: Partial<PreQualificationInput> = {};
  (Object.keys(qualificationGroups) as Array<keyof typeof qualificationGroups>).forEach((group) => {
    const match = entries.find(([question]) => {
      const key = normalized(question);
      return questionAliases[group].some((alias) => key === alias || key.includes(alias));
    });
    if (match) {
      const option = optionFromValue(qualificationGroups[group], match[1]);
      if (option) result[group] = option as never;
    }
  });
  return result.turnoverOption && result.teamSizeOption && result.timeFreedomOption && result.vintageOption
    ? result as PreQualificationInput
    : null;
}

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
