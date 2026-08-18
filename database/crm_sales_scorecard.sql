-- Additive CRM sales/session module. No existing objects are altered or dropped.
CREATE TABLE IF NOT EXISTS crm_sales_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  session_date date NOT NULL,
  start_time time,
  end_time time,
  location text NOT NULL DEFAULT '',
  capacity integer CHECK (capacity IS NULL OR capacity >= 0),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','OPEN','COMPLETED','CANCELLED')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_session_participants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL REFERENCES crm_sales_sessions(id) ON DELETE CASCADE,
  lead_id text NOT NULL,
  lead_name text NOT NULL,
  mobile text NOT NULL DEFAULT '',
  business text NOT NULL DEFAULT '',
  observer text NOT NULL DEFAULT '',
  entry_sequence bigint GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, lead_id)
);

CREATE TABLE IF NOT EXISTS crm_session_scorecards (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id uuid NOT NULL REFERENCES crm_session_participants(id) ON DELETE CASCADE,
  turnover_option text NOT NULL,
  turnover_score integer NOT NULL,
  team_size_option text NOT NULL,
  team_size_score integer NOT NULL,
  time_freedom_option text NOT NULL,
  time_freedom_score integer NOT NULL,
  vintage_option text NOT NULL,
  vintage_score integer NOT NULL,
  pre_score integer NOT NULL CHECK (pre_score BETWEEN 0 AND 50),
  attended boolean NOT NULL,
  on_time boolean NOT NULL,
  notes_taken boolean NOT NULL,
  asked_question boolean NOT NULL,
  stayed_until_end boolean NOT NULL,
  came_with_someone boolean NOT NULL,
  met_personally boolean NOT NULL,
  session_score integer NOT NULL CHECK (session_score BETWEEN 0 AND 50),
  total_score integer NOT NULL CHECK (total_score BETWEEN 0 AND 100),
  instant_signal text NOT NULL DEFAULT '-' CHECK (instant_signal IN ('A','C','-')),
  calculated_tier text NOT NULL CHECK (calculated_tier IN ('A','B','C','NOT_ATTENDED')),
  scorecard_version text NOT NULL,
  observer_user text NOT NULL,
  notes text NOT NULL DEFAULT '',
  scored_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_meetings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id uuid NOT NULL REFERENCES crm_session_participants(id) ON DELETE CASCADE,
  meeting_at timestamptz NOT NULL,
  owner text NOT NULL,
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'BOOKED' CHECK (status IN ('BOOKED','COMPLETED','CANCELLED','NO_SHOW')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_sales_activities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id uuid REFERENCES crm_session_participants(id) ON DELETE CASCADE,
  lead_id text NOT NULL,
  type text NOT NULL,
  actor_user text NOT NULL,
  body text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_participants_session_sequence_idx ON crm_session_participants(session_id, entry_sequence);
CREATE INDEX IF NOT EXISTS crm_scorecards_participant_scored_idx ON crm_session_scorecards(participant_id, scored_at DESC);
CREATE INDEX IF NOT EXISTS crm_scorecards_rank_idx ON crm_session_scorecards(total_score DESC, calculated_tier, scored_at DESC);
CREATE INDEX IF NOT EXISTS crm_meetings_time_owner_idx ON crm_meetings(meeting_at, owner);
CREATE INDEX IF NOT EXISTS crm_sales_activities_lead_created_idx ON crm_sales_activities(lead_id, created_at DESC);
