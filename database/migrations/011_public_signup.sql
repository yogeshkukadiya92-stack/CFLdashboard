-- Shared signup abuse limit; contains no personal data.
CREATE TABLE IF NOT EXISTS callflow_signup_limits (
  bucket timestamptz PRIMARY KEY,
  attempts integer NOT NULL CHECK (attempts > 0)
);
