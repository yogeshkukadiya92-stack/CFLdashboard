import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getDbPool } from "@/lib/db";
import { calculateSessionScorecard, rankParticipants, type ScorecardInput } from "@/lib/crm-scorecard";

let schemaReady: Promise<void> | null = null;

async function database() {
  const pool = getDbPool();
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  if (!schemaReady) {
    schemaReady = readFile(join(process.cwd(), "database", "crm_sales_scorecard.sql"), "utf8")
      .then((sql) => pool.query(sql))
      .then(() => undefined)
      .catch((error) => { schemaReady = null; throw error; });
  }
  await schemaReady;
  return pool;
}

export async function createSalesSession(input: { name: string; sessionDate: string; startTime?: string; endTime?: string; location?: string; capacity?: number; actor: string }) {
  const db = await database();
  const result = await db.query(
    `INSERT INTO crm_sales_sessions (name, session_date, start_time, end_time, location, capacity, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,'OPEN',$7) RETURNING *`,
    [input.name, input.sessionDate, input.startTime || null, input.endTime || null, input.location || "", input.capacity || null, input.actor]
  );
  return result.rows[0];
}

export async function addSessionParticipant(input: { sessionId: string; leadId: string; leadName: string; mobile?: string; business?: string; observer?: string; actor: string }) {
  const db = await database();
  const result = await db.query(
    `INSERT INTO crm_session_participants (session_id, lead_id, lead_name, mobile, business, observer)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (session_id, lead_id) DO UPDATE SET lead_name=EXCLUDED.lead_name, mobile=EXCLUDED.mobile,
       business=EXCLUDED.business, observer=EXCLUDED.observer, updated_at=now()
     RETURNING *`,
    [input.sessionId, input.leadId, input.leadName, input.mobile || "", input.business || "", input.observer || ""]
  );
  await db.query(`INSERT INTO crm_sales_activities (participant_id, lead_id, type, actor_user, body) VALUES ($1,$2,'SESSION_ADDED',$3,$4)`, [result.rows[0].id, input.leadId, input.actor, "Added to sales session"]);
  return result.rows[0];
}

export async function saveParticipantScorecard(input: { participantId: string; answers: ScorecardInput; notes?: string; observer: string }) {
  const db = await database();
  const score = calculateSessionScorecard(input.answers);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const participant = await client.query(`SELECT lead_id FROM crm_session_participants WHERE id=$1 FOR UPDATE`, [input.participantId]);
    if (!participant.rows[0]) throw new Error("Participant not found.");
    const result = await client.query(
      `INSERT INTO crm_session_scorecards (
        participant_id, turnover_option, turnover_score, team_size_option, team_size_score,
        time_freedom_option, time_freedom_score, vintage_option, vintage_score, pre_score,
        attended, on_time, notes_taken, asked_question, stayed_until_end, came_with_someone,
        met_personally, session_score, total_score, instant_signal, calculated_tier,
        scorecard_version, observer_user, notes, scored_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25) RETURNING *`,
      [input.participantId, input.answers.turnoverOption, score.turnoverScore, input.answers.teamSizeOption, score.teamSizeScore,
       input.answers.timeFreedomOption, score.timeFreedomScore, input.answers.vintageOption, score.vintageScore, score.preScore,
       input.answers.attended, input.answers.onTime, input.answers.notesTaken, input.answers.askedQuestion, input.answers.stayedUntilEnd,
       input.answers.cameWithSomeone, input.answers.metPersonally, score.sessionScore, score.totalScore, input.answers.instantSignal,
       score.calculatedTier, score.scorecardVersion, input.observer, input.notes || "", score.scoredAt]
    );
    await client.query(`INSERT INTO crm_sales_activities (participant_id, lead_id, type, actor_user, body, metadata) VALUES ($1,$2,'SCORECARD',$3,$4,$5::jsonb)`, [input.participantId, participant.rows[0].lead_id, input.observer, `Scorecard saved: ${score.totalScore}/100, Tier ${score.calculatedTier}`, JSON.stringify({ totalScore: score.totalScore, tier: score.calculatedTier, version: score.scorecardVersion })]);
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function bookParticipantMeeting(input: { participantId: string; meetingAt: string; owner: string; notes?: string; actor: string }) {
  const db = await database();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const participant = await client.query(`SELECT lead_id FROM crm_session_participants WHERE id=$1 FOR UPDATE`, [input.participantId]);
    if (!participant.rows[0]) throw new Error("Participant not found.");
    const meeting = await client.query(
      `INSERT INTO crm_meetings (participant_id, meeting_at, owner, notes, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [input.participantId, input.meetingAt, input.owner, input.notes || "", input.actor]
    );
    await client.query(
      `INSERT INTO crm_sales_activities (participant_id, lead_id, type, actor_user, body, metadata)
       VALUES ($1,$2,'MEETING',$3,'Meeting booked',jsonb_build_object('meetingAt',$4::text,'owner',$5))`,
      [input.participantId, participant.rows[0].lead_id, input.actor, input.meetingAt, input.owner]
    );
    await client.query("COMMIT");
    return meeting.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function listSalesSessions(sessionId?: string) {
  const db = await database();
  const sessions = await db.query(
    `SELECT s.*, COUNT(p.id)::int AS registrations FROM crm_sales_sessions s LEFT JOIN crm_session_participants p ON p.session_id=s.id
     WHERE ($1::uuid IS NULL OR s.id=$1) GROUP BY s.id ORDER BY s.session_date DESC, s.created_at DESC`,
    [sessionId || null]
  );
  if (!sessionId) return { sessions: sessions.rows };
  const participants = await db.query(
    `SELECT p.*, sc.*, p.id AS id, p.entry_sequence::int AS sequence,
       m.id AS meeting_id, m.meeting_at, m.owner AS meeting_owner
     FROM crm_session_participants p
     LEFT JOIN LATERAL (SELECT * FROM crm_session_scorecards x WHERE x.participant_id=p.id ORDER BY x.scored_at DESC, x.created_at DESC LIMIT 1) sc ON true
     LEFT JOIN LATERAL (SELECT * FROM crm_meetings x WHERE x.participant_id=p.id AND x.status='BOOKED' ORDER BY x.meeting_at DESC LIMIT 1) m ON true
     WHERE p.session_id=$1 ORDER BY p.entry_sequence`, [sessionId]
  );
  const rankable = participants.rows.filter((row) => row.calculated_tier).map((row) => ({ ...row, attended: row.attended === true, totalScore: Number(row.total_score || 0), calculatedTier: row.calculated_tier, sequence: Number(row.sequence) }));
  const ranks = new Map(rankParticipants(rankable).map((row) => [row.id, { rank: row.rank, meetingPriority: row.meetingPriority }]));
  const rows = participants.rows.map((row) => ({ ...row, ...(ranks.get(row.id) || { rank: null, meetingPriority: "NORMAL" }) }));
  const attended = rows.filter((row) => row.attended).length;
  const tierA = rows.filter((row) => row.calculated_tier === "A").length;
  const tierB = rows.filter((row) => row.calculated_tier === "B").length;
  const tierC = rows.filter((row) => row.calculated_tier === "C").length;
  const meetingsBooked = rows.filter((row) => row.meeting_id).length;
  return { session: sessions.rows[0] || null, participants: rows, summary: { registrations: rows.length, attended, notAttended: rows.filter((row) => row.calculated_tier === "NOT_ATTENDED").length, tierA, tierB, tierC, meetingsBooked, showUpRate: rows.length ? Math.round(attended / rows.length * 100) : 0, meetingBookingRate: attended ? Math.round(meetingsBooked / attended * 100) : 0, expectedEnrollments: Number((tierA * .30 + tierB * .06).toFixed(2)) } };
}
