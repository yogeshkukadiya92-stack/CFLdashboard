export type ResponseDatePreset = "all" | "today" | "yesterday" | "last7" | "custom";
export type ResponseAnswerOperator = "contains" | "equals" | "contains_any" | "contains_all" | "not_contains";

export type ResponseFilterState = {
  answer: string;
  answerOperator: ResponseAnswerOperator;
  datePreset: ResponseDatePreset;
  fromDate: string;
  fromTime: string;
  question: string;
  toDate: string;
  toTime: string;
};

export const emptyResponseFilters: ResponseFilterState = {
  answer: "",
  answerOperator: "contains",
  datePreset: "all",
  fromDate: "",
  fromTime: "",
  question: "",
  toDate: "",
  toTime: ""
};

export type FilterableResponse = {
  answers: Record<string, string>;
  submittedAt: string;
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function dateMatches(value: Date, filters: ResponseFilterState) {
  const now = new Date();
  if (filters.datePreset === "today") return value >= startOfDay(now) && value <= endOfDay(now);
  if (filters.datePreset === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return value >= startOfDay(yesterday) && value <= endOfDay(yesterday);
  }
  if (filters.datePreset === "last7") {
    const start = startOfDay(now);
    start.setDate(start.getDate() - 6);
    return value >= start && value <= endOfDay(now);
  }
  if (filters.datePreset === "custom") {
    const from = filters.fromDate ? new Date(`${filters.fromDate}T00:00:00`) : null;
    const to = filters.toDate ? new Date(`${filters.toDate}T23:59:59.999`) : null;
    if (from && value < from) return false;
    if (to && value > to) return false;
  }
  return true;
}

function timeMatches(value: Date, filters: ResponseFilterState) {
  if (!filters.fromTime && !filters.toTime) return true;
  const minutes = value.getHours() * 60 + value.getMinutes();
  const parse = (time: string) => {
    const [hours, mins] = time.split(":").map(Number);
    return hours * 60 + mins;
  };
  if (filters.fromTime && minutes < parse(filters.fromTime)) return false;
  if (filters.toTime && minutes > parse(filters.toTime)) return false;
  return true;
}

function answerMatches(value: string, filters: ResponseFilterState) {
  if (!filters.question || !filters.answer.trim()) return true;
  const actual = value.trim().toLowerCase();
  const expected = filters.answer.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (!expected.length) return true;
  if (filters.answerOperator === "equals") return actual === expected.join(", ") || actual === expected[0];
  if (filters.answerOperator === "contains_any") return expected.some((item) => actual.includes(item));
  if (filters.answerOperator === "contains_all") return expected.every((item) => actual.includes(item));
  if (filters.answerOperator === "not_contains") return expected.every((item) => !actual.includes(item));
  return actual.includes(expected[0]);
}

export function applyResponseFilters<T extends FilterableResponse>(items: T[], filters: ResponseFilterState) {
  return items.filter((item) => {
    const submitted = new Date(item.submittedAt);
    const validSubmittedAt = !Number.isNaN(submitted.getTime());
    if (!validSubmittedAt && (filters.datePreset !== "all" || filters.fromTime || filters.toTime)) return false;
    return (!validSubmittedAt || (dateMatches(submitted, filters) && timeMatches(submitted, filters))) && answerMatches(item.answers[filters.question] ?? "", filters);
  });
}

export function responseQuestionOptions(items: FilterableResponse[]) {
  return Array.from(new Set(items.flatMap((item) => Object.keys(item.answers)))).sort((left, right) => left.localeCompare(right));
}

export function activeResponseFilterCount(filters: ResponseFilterState) {
  return Number(filters.datePreset !== "all") + Number(Boolean(filters.fromTime || filters.toTime)) + Number(Boolean(filters.question && filters.answer.trim()));
}
