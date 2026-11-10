-- Phase 8: subscription billing, entitlement and immutable provider-event ledger.

CREATE TABLE IF NOT EXISTS callflow_billing_profiles (
  tenant_id uuid PRIMARY KEY REFERENCES callflow_companies(id) ON DELETE CASCADE,
  billing_mode text NOT NULL DEFAULT 'manual' CHECK (billing_mode IN ('manual','razorpay')),
  billing_interval text NOT NULL DEFAULT 'monthly' CHECK (billing_interval IN ('monthly','quarterly','yearly')),
  status text NOT NULL DEFAULT 'manual_active' CHECK (status IN ('manual_active','created','authenticated','active','pending','halted','paused','cancelled','completed','expired')),
  billed_seats integer NOT NULL DEFAULT 0 CHECK (billed_seats BETWEEN 0 AND 100000),
  price_per_seat_paise integer NOT NULL DEFAULT 0 CHECK (price_per_seat_paise >= 0),
  razorpay_plan_id text,
  razorpay_subscription_id text UNIQUE,
  razorpay_customer_id text,
  current_period_start timestamptz,
  access_until timestamptz,
  grace_until timestamptz,
  cancel_at_cycle_end boolean NOT NULL DEFAULT false,
  last_provider_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS callflow_billing_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES callflow_companies(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('razorpay','manual')),
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  provider_subscription_id text,
  provider_created_at timestamptz,
  payload_sha256 char(64) NOT NULL,
  status text NOT NULL DEFAULT 'processed' CHECK (status IN ('processed','ignored_out_of_order')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider,provider_event_id),
  UNIQUE (tenant_id,id)
);

CREATE TABLE IF NOT EXISTS callflow_subscription_payments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES callflow_companies(id) ON DELETE CASCADE,
  provider_payment_id text NOT NULL,
  provider_subscription_id text,
  amount_paise bigint NOT NULL DEFAULT 0 CHECK (amount_paise >= 0),
  currency char(3) NOT NULL DEFAULT 'INR',
  status text NOT NULL,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_payment_id),
  UNIQUE (tenant_id,id)
);

CREATE INDEX IF NOT EXISTS callflow_billing_status_idx ON callflow_billing_profiles (status,access_until,grace_until,tenant_id);
CREATE INDEX IF NOT EXISTS callflow_billing_events_tenant_idx ON callflow_billing_events (tenant_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS callflow_subscription_payments_tenant_idx ON callflow_subscription_payments (tenant_id,paid_at DESC,id DESC);

ALTER TABLE callflow_billing_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE callflow_billing_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE callflow_billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE callflow_billing_events FORCE ROW LEVEL SECURITY;
ALTER TABLE callflow_subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE callflow_subscription_payments FORCE ROW LEVEL SECURITY;

DO $$ DECLARE target_table text; BEGIN
  FOREACH target_table IN ARRAY ARRAY['callflow_billing_profiles','callflow_billing_events','callflow_subscription_payments'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I',target_table||'_tenant_isolation',target_table);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (callflow_is_owner_admin() OR tenant_id=callflow_current_tenant_id()) WITH CHECK (callflow_is_owner_admin() OR tenant_id=callflow_current_tenant_id())',target_table||'_tenant_isolation',target_table);
  END LOOP;
END $$;

INSERT INTO callflow_billing_profiles (tenant_id,billing_mode,status,billed_seats,price_per_seat_paise)
SELECT company.id,'manual','manual_active',COALESCE(settings.purchased_seats,0),COALESCE(settings.default_price_paise,0)
FROM callflow_companies company LEFT JOIN callflow_company_settings settings ON settings.tenant_id=company.id
ON CONFLICT (tenant_id) DO NOTHING;
