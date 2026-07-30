import { NextResponse } from "next/server";

type CohortSummary = {
  converted: number;
  conversionRate: number;
  notRegistered: number;
  sourceAttendees: number;
  sourceName: string;
  targetName: string;
  targetRegistrations: number;
};

function validSummary(value: unknown): value is CohortSummary {
  if (!value || typeof value !== "object") return false;
  const summary = value as Partial<CohortSummary>;
  return (
    [summary.converted, summary.conversionRate, summary.notRegistered, summary.sourceAttendees, summary.targetRegistrations].every((item) => typeof item === "number" && Number.isFinite(item)) &&
    typeof summary.sourceName === "string" &&
    typeof summary.targetName === "string"
  );
}

export async function POST(request: Request) {
  let summary: unknown;
  try {
    summary = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid comparison data." }, { status: 400 });
  }
  if (!validSummary(summary)) {
    return NextResponse.json({ error: "Invalid comparison data." }, { status: 400 });
  }

  const baseUrl = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
  const model = process.env.OLLAMA_MODEL || "llama3.2:3b";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      body: JSON.stringify({
        model,
        prompt: [
          "You are a concise workshop conversion analyst.",
          "Analyze only the aggregate data below. Do not invent people, reasons, or facts.",
          "Return 3 short bullet points: result, follow-up priority, and one practical action.",
          `Intro/source: ${summary.sourceName}`,
          `Main/target: ${summary.targetName}`,
          `Unique intro attendees: ${summary.sourceAttendees}`,
          `Intro attendees registered for main: ${summary.converted}`,
          `Intro attendees not registered: ${summary.notRegistered}`,
          `Conversion rate: ${summary.conversionRate}%`,
          `All unique main registrations: ${summary.targetRegistrations}`
        ].join("\n"),
        stream: false
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Ollama returned ${response.status}.`);
    const result = await response.json() as { response?: string };
    if (!result.response?.trim()) throw new Error("Ollama returned an empty response.");
    return NextResponse.json({ insight: result.response.trim(), model });
  } catch (error) {
    const detail = error instanceof Error && error.name === "AbortError"
      ? "Ollama timed out."
      : "Ollama is not reachable.";
    return NextResponse.json({
      error: `${detail} Start Ollama and configure OLLAMA_BASE_URL and OLLAMA_MODEL on the dashboard server.`
    }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}
