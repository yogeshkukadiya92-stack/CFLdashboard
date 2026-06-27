-- CFL OS PostgreSQL schema baseline.
-- Designed for 400,000+ contacts, instant mobile search, auditability, and SaaS tenant migration.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE lead_stage AS ENUM ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost');
CREATE TYPE workshop_type AS ENUM ('online', 'offline', 'hybrid');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'part_paid', 'failed', 'refunded', 'overdue');
CREATE TYPE campaign_channel AS ENUM ('whatsapp', 'email', 'sms', 'call', 'landing_page');

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'mvp',
  locale text NOT NULL DEFAULT 'en-IN',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  permissions_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  role_id uuid REFERENCES roles(id),
  name text NOT NULL,
  mobile text NOT NULL,
  mobile_normalized text GENERATED ALWAYS AS (regexp_replace(mobile, '[^0-9]', '', 'g')) STORED,
  email text,
  password_hash text,
  status text NOT NULL DEFAULT 'active',
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, mobile_normalized)
);

CREATE TABLE family_groups (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  family_group_id uuid REFERENCES family_groups(id),
  city text,
  state text,
  country text DEFAULT 'India',
  tags text[] NOT NULL DEFAULT '{}',
  meta_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id),
  name text NOT NULL,
  mobile text NOT NULL,
  mobile_normalized text GENERATED ALWAYS AS (regexp_replace(mobile, '[^0-9]', '', 'g')) STORED,
  email text,
  city text,
  state text,
  country text DEFAULT 'India',
  source text NOT NULL DEFAULT 'manual',
  stage lead_stage NOT NULL DEFAULT 'new',
  assigned_to uuid REFERENCES users(id),
  score int NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  notes text,
  tags text[] NOT NULL DEFAULT '{}',
  next_follow_up_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lead_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id),
  channel campaign_channel,
  event_type text NOT NULL,
  body text,
  meta_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workshops (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  type workshop_type NOT NULL DEFAULT 'online',
  price numeric(12,2) NOT NULL DEFAULT 0,
  trainer_id uuid REFERENCES users(id),
  status text NOT NULL DEFAULT 'draft',
  start_date timestamptz,
  end_date timestamptz,
  city text,
  capacity int,
  landing_page_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE batches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  workshop_id uuid REFERENCES workshops(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date timestamptz NOT NULL,
  end_date timestamptz,
  capacity int NOT NULL,
  qr_secret text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE registrations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id),
  workshop_id uuid REFERENCES workshops(id),
  batch_id uuid REFERENCES batches(id),
  payment_status payment_status NOT NULL DEFAULT 'pending',
  coupon_code text,
  registered_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id),
  workshop_id uuid REFERENCES workshops(id),
  registration_id uuid REFERENCES registrations(id),
  razorpay_order_id text,
  razorpay_payment_id text,
  amount numeric(12,2) NOT NULL,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  status payment_status NOT NULL DEFAULT 'pending',
  method text,
  retry_count int NOT NULL DEFAULT 0,
  invoice_number text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE coupons (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  type text NOT NULL,
  value numeric(12,2) NOT NULL,
  max_redemptions int,
  used_count int NOT NULL DEFAULT 0,
  expiry timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE attendance (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id),
  workshop_id uuid REFERENCES workshops(id),
  batch_id uuid REFERENCES batches(id),
  date date NOT NULL,
  status text NOT NULL DEFAULT 'present',
  marked_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, batch_id, date)
);

CREATE TABLE certificates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id),
  workshop_id uuid REFERENCES workshops(id),
  certificate_number text NOT NULL,
  file_url text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, certificate_number)
);

CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES users(id),
  title text NOT NULL,
  due_date timestamptz,
  status text NOT NULL DEFAULT 'open',
  meta_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tickets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id),
  subject text NOT NULL,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  satisfaction_rating numeric(3,2),
  assigned_to uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  type campaign_channel NOT NULL,
  name text NOT NULL,
  audience jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  sent_count int NOT NULL DEFAULT 0,
  conversion_rate numeric(5,2) NOT NULL DEFAULT 0,
  revenue_attributed numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE automation_workflows (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_json jsonb NOT NULL,
  steps_json jsonb NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE activity_logs (
  id bigserial PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  ip_address inet,
  device_json jsonb NOT NULL DEFAULT '{}',
  meta_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

CREATE TABLE activity_logs_2026_q2 PARTITION OF activity_logs
  FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');

-- Search and scale indexes.
CREATE INDEX idx_users_tenant_mobile ON users (tenant_id, mobile_normalized);
CREATE INDEX idx_leads_tenant_mobile ON leads (tenant_id, mobile_normalized);
CREATE INDEX idx_leads_tenant_stage_created ON leads (tenant_id, stage, created_at DESC);
CREATE INDEX idx_leads_tenant_assigned_followup ON leads (tenant_id, assigned_to, next_follow_up_at);
CREATE INDEX idx_leads_name_trgm ON leads USING gin (name gin_trgm_ops);
CREATE INDEX idx_clients_tags ON clients USING gin (tags);
CREATE INDEX idx_workshops_tenant_start ON workshops (tenant_id, start_date DESC);
CREATE INDEX idx_batches_workshop ON batches (workshop_id, start_date);
CREATE INDEX idx_registrations_workshop_batch ON registrations (workshop_id, batch_id, registered_at DESC);
CREATE INDEX idx_payments_tenant_status_created ON payments (tenant_id, status, created_at DESC);
CREATE INDEX idx_payments_razorpay_order ON payments (razorpay_order_id);
CREATE INDEX idx_campaigns_tenant_status ON campaigns (tenant_id, status, created_at DESC);
CREATE INDEX idx_activity_logs_tenant_created ON activity_logs (tenant_id, created_at DESC);

-- Suggested materialized views for reporting.
CREATE MATERIALIZED VIEW daily_revenue_summary AS
SELECT
  tenant_id,
  date_trunc('day', COALESCE(paid_at, created_at)) AS day,
  status,
  sum(amount) AS revenue,
  count(*) AS payment_count
FROM payments
GROUP BY tenant_id, date_trunc('day', COALESCE(paid_at, created_at)), status;

CREATE INDEX idx_daily_revenue_summary ON daily_revenue_summary (tenant_id, day DESC);
