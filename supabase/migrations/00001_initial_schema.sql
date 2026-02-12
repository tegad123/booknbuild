-- BooknBuild Initial Schema
-- Multi-tenant SaaS for home service contractors
-- ================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================
-- ENUMS
-- ================================================

CREATE TYPE org_status AS ENUM ('PENDING', 'ACTIVE');
CREATE TYPE channel_type AS ENUM ('sms', 'email');
CREATE TYPE calendar_provider AS ENUM ('google', 'microsoft');
CREATE TYPE payment_provider AS ENUM ('stripe', 'square', 'link');
CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'qualified', 'quoted', 'booked', 'completed', 'lost');
CREATE TYPE measurement_source AS ENUM ('photo', 'address', 'customer', 'selected');
CREATE TYPE quote_status AS ENUM ('draft', 'needs_approval', 'sent', 'viewed', 'accepted', 'expired');
CREATE TYPE appointment_type AS ENUM ('estimate', 'install');
CREATE TYPE appointment_status AS ENUM ('pending_hold', 'pending_payment', 'confirmed', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE task_status AS ENUM ('queued', 'running', 'done', 'failed');

-- ================================================
-- HELPER FUNCTION: get current user's active org_id
-- ================================================

CREATE OR REPLACE FUNCTION auth_org_id() RETURNS uuid AS $$
  SELECT org_id FROM public.user_orgs
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ================================================
-- CORE TABLES
-- ================================================

-- Organizations
CREATE TABLE orgs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Chicago',
  status org_status NOT NULL DEFAULT 'PENDING',
  brand_json jsonb NOT NULL DEFAULT '{}',
  approval_token text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_orgs_slug ON orgs (slug);
CREATE INDEX idx_orgs_status ON orgs (status);

-- User-Org mapping (multi-org support)
CREATE TABLE user_orgs (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, org_id)
);

-- Ensure only one active org per user
CREATE UNIQUE INDEX idx_user_orgs_one_active
  ON user_orgs (user_id) WHERE is_active = true;

CREATE INDEX idx_user_orgs_org_id ON user_orgs (org_id);

-- Org configs (versioned)
CREATE TABLE org_configs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  config_json jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_configs_org_id ON org_configs (org_id);
CREATE INDEX idx_org_configs_active ON org_configs (org_id) WHERE is_active = true;

-- ================================================
-- TEMPLATES
-- ================================================

CREATE TABLE templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  niche text NOT NULL,
  name text NOT NULL,
  template_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_templates_niche ON templates (niche);

CREATE TABLE template_applies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_template_applies_org_id ON template_applies (org_id);

-- ================================================
-- INTEGRATIONS (encrypted config storage)
-- ================================================

CREATE TABLE org_channels (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  channel_type channel_type NOT NULL,
  provider text NOT NULL,
  config_encrypted text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_channels_org_id ON org_channels (org_id);

CREATE TABLE org_phone_numbers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  e164 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_phone_numbers_org_id ON org_phone_numbers (org_id);

CREATE TABLE org_calendar_connections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  provider calendar_provider NOT NULL,
  config_encrypted text NOT NULL,
  calendar_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_calendar_connections_org_id ON org_calendar_connections (org_id);

CREATE TABLE org_payment_connections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  provider payment_provider NOT NULL,
  config_encrypted text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_payment_connections_org_id ON org_payment_connections (org_id);

-- ================================================
-- LEADS / INTAKE / MEDIA
-- ================================================

CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  status lead_status NOT NULL DEFAULT 'new',
  name text NOT NULL,
  phone text,
  email text,
  address text,
  niche text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_contact_at timestamptz
);

CREATE INDEX idx_leads_org_id ON leads (org_id);
CREATE INDEX idx_leads_org_status ON leads (org_id, status);
CREATE INDEX idx_leads_created_at ON leads (created_at DESC);
CREATE INDEX idx_leads_org_niche ON leads (org_id, niche);

CREATE TABLE intake_submissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  niche text NOT NULL,
  answers_json jsonb NOT NULL DEFAULT '{}',
  consent_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_intake_submissions_org_id ON intake_submissions (org_id);
CREATE INDEX idx_intake_submissions_lead_id ON intake_submissions (lead_id);

CREATE TABLE media_assets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  intake_id uuid REFERENCES intake_submissions(id) ON DELETE SET NULL,
  file_url text NOT NULL,
  file_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_assets_org_id ON media_assets (org_id);
CREATE INDEX idx_media_assets_lead_id ON media_assets (lead_id);

-- ================================================
-- AI EVIDENCE
-- ================================================

CREATE TABLE measurements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  source measurement_source NOT NULL,
  value_type text NOT NULL,
  value numeric NOT NULL,
  confidence numeric,
  metadata_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_measurements_org_id ON measurements (org_id);
CREATE INDEX idx_measurements_lead_id ON measurements (lead_id);

-- ================================================
-- QUOTES
-- ================================================

CREATE TABLE quotes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  niche text NOT NULL,
  quote_version integer NOT NULL DEFAULT 1,
  status quote_status NOT NULL DEFAULT 'draft',
  packages_json jsonb NOT NULL DEFAULT '{}',
  totals_json jsonb NOT NULL DEFAULT '{}',
  verification_clause text,
  needs_approval boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz
);

CREATE INDEX idx_quotes_org_id ON quotes (org_id);
CREATE INDEX idx_quotes_lead_id ON quotes (lead_id);
CREATE INDEX idx_quotes_status ON quotes (org_id, status);
CREATE INDEX idx_quotes_created_at ON quotes (created_at DESC);

-- ================================================
-- BOOKING
-- ================================================

CREATE TABLE holds (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  slot_start timestamptz NOT NULL,
  slot_end timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_holds_org_id ON holds (org_id);
CREATE INDEX idx_holds_expires_at ON holds (expires_at);

CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type appointment_type NOT NULL DEFAULT 'install',
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status appointment_status NOT NULL DEFAULT 'pending_hold',
  calendar_event_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_appointments_org_id ON appointments (org_id);
CREATE INDEX idx_appointments_lead_id ON appointments (lead_id);
CREATE INDEX idx_appointments_start_at ON appointments (org_id, start_at);

-- ================================================
-- PAYMENTS
-- ================================================

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  provider payment_provider NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status payment_status NOT NULL DEFAULT 'pending',
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_org_id ON payments (org_id);
CREATE INDEX idx_payments_lead_id ON payments (lead_id);
CREATE INDEX idx_payments_external_id ON payments (external_id);

CREATE TABLE refund_rules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  cancellation_window_hours integer NOT NULL DEFAULT 24,
  refund_percent integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_refund_rules_org_id ON refund_rules (org_id);

-- ================================================
-- MESSAGING + AUTOMATIONS
-- ================================================

CREATE TABLE message_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  channel channel_type NOT NULL,
  name text NOT NULL,
  body text NOT NULL,
  variables_json jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_message_templates_org_id ON message_templates (org_id);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  channel channel_type NOT NULL,
  direction message_direction NOT NULL,
  body text NOT NULL,
  provider_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_org_id ON messages (org_id);
CREATE INDEX idx_messages_lead_id ON messages (lead_id);
CREATE INDEX idx_messages_created_at ON messages (created_at DESC);

CREATE TABLE followup_rules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  trigger text NOT NULL,
  steps_json jsonb NOT NULL DEFAULT '[]',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_followup_rules_org_id ON followup_rules (org_id);

CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  type text NOT NULL,
  run_at timestamptz NOT NULL DEFAULT now(),
  payload_json jsonb NOT NULL DEFAULT '{}',
  status task_status NOT NULL DEFAULT 'queued',
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_org_id ON tasks (org_id);
CREATE INDEX idx_tasks_status_run_at ON tasks (status, run_at) WHERE status = 'queued';
CREATE INDEX idx_tasks_lead_id ON tasks (lead_id);

CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  type text NOT NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_org_id ON events (org_id);
CREATE INDEX idx_events_lead_id ON events (lead_id);
CREATE INDEX idx_events_type ON events (org_id, type);
CREATE INDEX idx_events_created_at ON events (created_at DESC);

-- ================================================
-- ROW LEVEL SECURITY
-- ================================================

-- Enable RLS on all tenant tables
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_payment_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE followup_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_applies ENABLE ROW LEVEL SECURITY;

-- Templates are public read
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates_public_read" ON templates FOR SELECT USING (true);

-- user_orgs: users can see their own memberships
CREATE POLICY "user_orgs_own" ON user_orgs
  FOR ALL USING (user_id = auth.uid());

-- orgs: users can access their orgs via user_orgs
CREATE POLICY "orgs_member" ON orgs
  FOR ALL USING (id = auth_org_id());

-- Standard org isolation policy for all tenant tables
CREATE POLICY "org_configs_isolation" ON org_configs
  FOR ALL USING (org_id = auth_org_id());

CREATE POLICY "org_channels_isolation" ON org_channels
  FOR ALL USING (org_id = auth_org_id());

CREATE POLICY "org_phone_numbers_isolation" ON org_phone_numbers
  FOR ALL USING (org_id = auth_org_id());

CREATE POLICY "org_calendar_connections_isolation" ON org_calendar_connections
  FOR ALL USING (org_id = auth_org_id());

CREATE POLICY "org_payment_connections_isolation" ON org_payment_connections
  FOR ALL USING (org_id = auth_org_id());

CREATE POLICY "leads_isolation" ON leads
  FOR ALL USING (org_id = auth_org_id());

CREATE POLICY "intake_submissions_isolation" ON intake_submissions
  FOR ALL USING (org_id = auth_org_id());

CREATE POLICY "media_assets_isolation" ON media_assets
  FOR ALL USING (org_id = auth_org_id());

CREATE POLICY "measurements_isolation" ON measurements
  FOR ALL USING (org_id = auth_org_id());

CREATE POLICY "quotes_isolation" ON quotes
  FOR ALL USING (org_id = auth_org_id());

CREATE POLICY "holds_isolation" ON holds
  FOR ALL USING (org_id = auth_org_id());

CREATE POLICY "appointments_isolation" ON appointments
  FOR ALL USING (org_id = auth_org_id());

CREATE POLICY "payments_isolation" ON payments
  FOR ALL USING (org_id = auth_org_id());

CREATE POLICY "refund_rules_isolation" ON refund_rules
  FOR ALL USING (org_id = auth_org_id());

CREATE POLICY "message_templates_isolation" ON message_templates
  FOR ALL USING (org_id = auth_org_id());

CREATE POLICY "messages_isolation" ON messages
  FOR ALL USING (org_id = auth_org_id());

CREATE POLICY "followup_rules_isolation" ON followup_rules
  FOR ALL USING (org_id = auth_org_id());

CREATE POLICY "tasks_isolation" ON tasks
  FOR ALL USING (org_id = auth_org_id());

CREATE POLICY "events_isolation" ON events
  FOR ALL USING (org_id = auth_org_id());

CREATE POLICY "template_applies_isolation" ON template_applies
  FOR ALL USING (org_id = auth_org_id());

-- ================================================
-- SUPABASE STORAGE BUCKET
-- ================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('intake', 'intake', false)
ON CONFLICT (id) DO NOTHING;
