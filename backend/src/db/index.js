const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Railway Postgres uses self-signed certs; rejectUnauthorized must be false
  // Set DB_SSL_REJECT=true if using a CA-signed cert provider
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: process.env.DB_SSL_REJECT === 'true' } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

const initDb = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255),
      invite_code VARCHAR(50) UNIQUE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(255),
      org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
      role VARCHAR(50) DEFAULT 'member',
      outlook_refresh_token TEXT,
      outlook_access_token TEXT,
      outlook_email VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS company_profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255),
      product TEXT,
      value_props TEXT,
      icp TEXT,
      target_titles TEXT,
      tone VARCHAR(255),
      objections TEXT,
      sender_name VARCHAR(255),
      sender_role VARCHAR(50) DEFAULT 'AE',
      custom_tone TEXT,
      website_url VARCHAR(500),
      zoho_client_id VARCHAR(255),
      zoho_client_secret VARCHAR(255),
      zoho_refresh_token TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS lead_lists (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      list_id INTEGER REFERENCES lead_lists(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      full_name VARCHAR(255),
      company VARCHAR(255),
      title VARCHAR(255),
      email VARCHAR(255),
      linkedin VARCHAR(255),
      notes TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      icp_score INTEGER,
      icp_reason TEXT,
      zoho_contact_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS playbooks (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      research TEXT,
      email1 TEXT,
      email2 TEXT,
      email3 TEXT,
      email4 TEXT,
      linkedin TEXT,
      call_opener TEXT,
      objection_handling TEXT,
      callbacks TEXT,
      generated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS lead_sequences (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      stage VARCHAR(50) DEFAULT 'not_started',
      email1_sent BOOLEAN DEFAULT false,
      email1_sent_at TIMESTAMP,
      email2_sent BOOLEAN DEFAULT false,
      email2_sent_at TIMESTAMP,
      email3_sent BOOLEAN DEFAULT false,
      email3_sent_at TIMESTAMP,
      email4_sent BOOLEAN DEFAULT false,
      email4_sent_at TIMESTAMP,
      linkedin_sent BOOLEAN DEFAULT false,
      linkedin_sent_at TIMESTAMP,
      call_made BOOLEAN DEFAULT false,
      call_made_at TIMESTAMP,
      reply_received BOOLEAN DEFAULT false,
      reply_received_at TIMESTAMP,
      meeting_booked BOOLEAN DEFAULT false,
      meeting_booked_at TIMESTAMP,
      notes TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'member';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS outlook_refresh_token TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS outlook_access_token TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS outlook_email VARCHAR(255);
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
    CREATE UNIQUE INDEX IF NOT EXISTS sequence_events_lead_touchpoint ON sequence_events(lead_id, touchpoint);
    ALTER TABLE sequence_events ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP;
    ALTER TABLE sequence_events ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMP;
    CREATE TABLE IF NOT EXISTS call_logs (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      duration_seconds INTEGER DEFAULT 0,
      outcome VARCHAR(50) DEFAULT 'connected',
      notes TEXT,
      called_at TIMESTAMP DEFAULT NOW(),
      zoho_synced BOOLEAN DEFAULT FALSE
    );
    CREATE TABLE IF NOT EXISTS email_tracking (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
      touchpoint VARCHAR(50),
      opened_at TIMESTAMP DEFAULT NOW(),
      ip VARCHAR(100),
      user_agent TEXT,
      UNIQUE(lead_id, touchpoint)
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_refresh_token TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_email VARCHAR(255);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slack_webhook TEXT;
    CREATE TABLE IF NOT EXISTS lead_notes (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS email_templates (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      subject TEXT,
      body TEXT,
      touchpoint VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW()
    );
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS sender_role VARCHAR(50) DEFAULT 'AE';
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS custom_tone TEXT;
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS website_url VARCHAR(500);
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS zoho_client_id VARCHAR(255);
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS zoho_client_secret VARCHAR(255);
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS zoho_refresh_token TEXT;
    ALTER TABLE lead_lists ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS icp_score INTEGER;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS icp_reason TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS zoho_contact_id VARCHAR(255);
    ALTER TABLE playbooks ADD COLUMN IF NOT EXISTS email4 TEXT;
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'trial';
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS playbooks_used INTEGER DEFAULT 0;
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS playbooks_limit INTEGER DEFAULT 10;
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP DEFAULT (NOW() + INTERVAL '14 days');
    CREATE TABLE IF NOT EXISTS sequence_events (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      touchpoint VARCHAR(50) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      notes TEXT,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS sequence_stage VARCHAR(50) DEFAULT 'not_started';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS outlook_refresh_token TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS outlook_email VARCHAR(255);
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
    CREATE UNIQUE INDEX IF NOT EXISTS sequence_events_lead_touchpoint ON sequence_events(lead_id, touchpoint);
    ALTER TABLE sequence_events ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP;
    ALTER TABLE sequence_events ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMP;
    CREATE TABLE IF NOT EXISTS call_logs (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      duration_seconds INTEGER DEFAULT 0,
      outcome VARCHAR(50) DEFAULT 'connected',
      notes TEXT,
      called_at TIMESTAMP DEFAULT NOW(),
      zoho_synced BOOLEAN DEFAULT FALSE
    );
    CREATE TABLE IF NOT EXISTS email_tracking (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
      touchpoint VARCHAR(50),
      opened_at TIMESTAMP DEFAULT NOW(),
      ip VARCHAR(100),
      user_agent TEXT,
      UNIQUE(lead_id, touchpoint)
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_refresh_token TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_email VARCHAR(255);
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slack_webhook TEXT;
    CREATE TABLE IF NOT EXISTS lead_notes (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS email_templates (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      subject TEXT,
      body TEXT,
      touchpoint VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS org_sequence_config (
      id SERIAL PRIMARY KEY,
      org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
      config JSONB,
      updated_at TIMESTAMP DEFAULT NOW()
    );
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_stage VARCHAR(50) DEFAULT 'not_started';
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS call_stage VARCHAR(50) DEFAULT 'not_started';
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS linkedin_stage VARCHAR(50) DEFAULT 'not_started';
    ALTER TABLE lead_notes ADD COLUMN IF NOT EXISTS note_type VARCHAR(50) DEFAULT 'general';


    ALTER TABLE company_profiles ALTER COLUMN name TYPE TEXT;
    ALTER TABLE company_profiles ALTER COLUMN product TYPE TEXT;
    ALTER TABLE company_profiles ALTER COLUMN value_props TYPE TEXT;
    ALTER TABLE company_profiles ALTER COLUMN icp TYPE TEXT;
    ALTER TABLE company_profiles ALTER COLUMN target_titles TYPE TEXT;
    ALTER TABLE company_profiles ALTER COLUMN tone TYPE TEXT;
    ALTER TABLE company_profiles ALTER COLUMN objections TYPE TEXT;
    ALTER TABLE company_profiles ALTER COLUMN sender_name TYPE TEXT;
    ALTER TABLE company_profiles ALTER COLUMN sender_role TYPE TEXT;
    ALTER TABLE company_profiles ALTER COLUMN custom_tone TYPE TEXT;
    ALTER TABLE company_profiles ALTER COLUMN website_url TYPE TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS company_profiles_org_id_unique ON company_profiles(org_id) WHERE org_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS company_profiles_user_id_unique ON company_profiles(user_id) WHERE user_id IS NOT NULL;
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS legacy_system VARCHAR(100) DEFAULT 'Costpoint';
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS compliance_focus TEXT;
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS workflow_pains TEXT;
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS buyer_personas TEXT;
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS migration_notes TEXT;
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS govcon_mode BOOLEAN DEFAULT true;
    CREATE TABLE IF NOT EXISTS activity_goals (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      daily_calls INTEGER DEFAULT 60,
      daily_emails INTEGER DEFAULT 100,
      daily_linkedin INTEGER DEFAULT 0,
      weekly_calls INTEGER DEFAULT 300,
      weekly_emails INTEGER DEFAULT 500,
      weekly_linkedin INTEGER DEFAULT 0,
      goal_mode VARCHAR(20) DEFAULT 'daily',
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
      activity_type VARCHAR(50) NOT NULL,
      touchpoint VARCHAR(50),
      logged_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_activity_log_user_date ON activity_log(user_id, logged_at);
    CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
    CREATE INDEX IF NOT EXISTS idx_playbooks_user_id ON playbooks(user_id);
    CREATE INDEX IF NOT EXISTS idx_sequence_events_user_id ON sequence_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_leads_list_id ON leads(list_id);
    CREATE INDEX IF NOT EXISTS idx_sequence_events_lead_id ON sequence_events(lead_id);
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_signature TEXT DEFAULT '';
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS zoho_org_id VARCHAR(50) DEFAULT NULL;

    -- Enhanced company profile for GovCon capability statements
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS company_phone VARCHAR(50) DEFAULT '';
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS company_email VARCHAR(255) DEFAULT '';
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS company_address TEXT DEFAULT '';
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS cage_code VARCHAR(20) DEFAULT '';
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS uei VARCHAR(20) DEFAULT '';
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS duns VARCHAR(20) DEFAULT '';
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS naics_codes TEXT DEFAULT '';
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS certifications TEXT DEFAULT '[]';
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS core_capabilities TEXT DEFAULT '';
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS past_performance TEXT DEFAULT '';
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS differentiators TEXT DEFAULT '';
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS team_members TEXT DEFAULT '[]';

    -- Lead engagement status and snooze
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS engagement_status VARCHAR(50) DEFAULT 'active';
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMP DEFAULT NULL;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS meeting_booked_at TIMESTAMP DEFAULT NULL;

    -- Conversation notes (timestamped log separate from lead notes field)
    CREATE TABLE IF NOT EXISTS conversation_notes (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Call outcomes on sequence events
    ALTER TABLE sequence_events ADD COLUMN IF NOT EXISTS call_outcome VARCHAR(50) DEFAULT NULL;

    -- Clean up backfill activity_log pollution
    DELETE FROM activity_log al
    USING sequence_events se
    WHERE al.lead_id = se.lead_id
      AND al.touchpoint = se.touchpoint
      AND se.status = 'done'
      AND al.lead_id IS NOT NULL
      AND DATE(al.logged_at) != DATE(se.completed_at);

    -- ═══════════════════════════════════════════════════════════════
    -- SubK tables (teaming marketplace, opportunities, sub profiles)
    -- ═══════════════════════════════════════════════════════════════

    -- Sub contractor profiles for the teaming marketplace
    CREATE TABLE IF NOT EXISTS sub_profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
      company_name VARCHAR(255),
      website_url VARCHAR(500),
      naics_codes TEXT,
      cage_code VARCHAR(20),
      uei VARCHAR(20),
      certifications TEXT,
      past_performance TEXT,
      capabilities TEXT,
      target_agencies TEXT,
      contract_min INTEGER DEFAULT 0,
      contract_max INTEGER DEFAULT 10000000,
      set_aside_prefs TEXT,
      state VARCHAR(50),
      is_public BOOLEAN DEFAULT false,
      tagline VARCHAR(255),
      uei_verified BOOLEAN DEFAULT false,
      sam_data JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Opportunity searches (saved search configs)
    CREATE TABLE IF NOT EXISTS opportunity_searches (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255),
      naics_codes TEXT,
      keywords TEXT,
      agency TEXT,
      set_aside TEXT,
      status VARCHAR(50) DEFAULT 'active',
      auto_frequency VARCHAR(20) DEFAULT NULL,
      last_auto_run TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
    ALTER TABLE opportunity_searches ADD COLUMN IF NOT EXISTS auto_frequency VARCHAR(20) DEFAULT NULL;
    ALTER TABLE opportunity_searches ADD COLUMN IF NOT EXISTS last_auto_run TIMESTAMP;

    -- Federal opportunities from SAM.gov
    CREATE TABLE IF NOT EXISTS opportunities (
      id SERIAL PRIMARY KEY,
      search_id INTEGER REFERENCES opportunity_searches(id) ON DELETE CASCADE,
      org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
      sam_notice_id VARCHAR(255) UNIQUE,
      title TEXT,
      agency VARCHAR(255),
      sub_agency VARCHAR(255),
      naics_code VARCHAR(20),
      set_aside VARCHAR(100),
      posted_date DATE,
      response_deadline TIMESTAMP,
      value_min BIGINT,
      value_max BIGINT,
      description TEXT,
      place_of_performance VARCHAR(255),
      primary_contact_name VARCHAR(255),
      primary_contact_email VARCHAR(255),
      solicitation_number VARCHAR(255),
      opportunity_url TEXT,
      fit_score INTEGER,
      fit_reason TEXT,
      status VARCHAR(50) DEFAULT 'new',
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Prime contractor tracking
    CREATE TABLE IF NOT EXISTS primes (
      id SERIAL PRIMARY KEY,
      org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
      company_name VARCHAR(255) NOT NULL,
      cage_code VARCHAR(20),
      uei VARCHAR(20),
      website VARCHAR(500),
      naics_codes TEXT,
      certifications TEXT,
      recent_awards TEXT,
      total_awards_value BIGINT DEFAULT 0,
      award_count INTEGER DEFAULT 0,
      agency_focus TEXT,
      size_category VARCHAR(50),
      fit_score INTEGER,
      fit_reason TEXT,
      research TEXT,
      outreach_status VARCHAR(50) DEFAULT 'not_contacted',
      contact_name VARCHAR(255),
      contact_email VARCHAR(255),
      contact_title VARCHAR(255),
      notes TEXT,
      teaming_pitch TEXT,
      email1 TEXT,
      email2 TEXT,
      email3 TEXT,
      call_opener TEXT,
      capability_statement TEXT,
      zoho_contact_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS prime_notes (
      id SERIAL PRIMARY KEY,
      prime_id INTEGER REFERENCES primes(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS outreach_events (
      id SERIAL PRIMARY KEY,
      prime_id INTEGER REFERENCES primes(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      touchpoint VARCHAR(50) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      notes TEXT,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS outreach_events_prime_touchpoint ON outreach_events(prime_id, touchpoint);

    -- Structured past performance records
    CREATE TABLE IF NOT EXISTS past_performance (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      contract_number VARCHAR(100),
      contract_title VARCHAR(255),
      agency VARCHAR(255),
      prime_or_sub VARCHAR(20) DEFAULT 'prime',
      award_amount BIGINT,
      period_start DATE,
      period_end DATE,
      naics_code VARCHAR(20),
      set_aside VARCHAR(100),
      description TEXT,
      relevance_tags TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- UEI lookup cache
    CREATE TABLE IF NOT EXISTS uei_cache (
      uei VARCHAR(20) PRIMARY KEY,
      data JSONB,
      cached_at TIMESTAMP DEFAULT NOW()
    );

    -- Prime-side accounts (primes register to find subs)
    CREATE TABLE IF NOT EXISTS prime_accounts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      company_name VARCHAR(255) NOT NULL,
      cage_code VARCHAR(20),
      uei VARCHAR(20),
      website VARCHAR(500),
      naics_codes TEXT,
      certifications TEXT,
      capabilities TEXT,
      agency_focus TEXT,
      teaming_needs TEXT,
      is_public BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Teaming requests
    CREATE TABLE IF NOT EXISTS teaming_requests (
      id SERIAL PRIMARY KEY,
      from_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      to_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE SET NULL,
      message TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      from_type VARCHAR(20) DEFAULT 'sub',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Shared opportunities posted by primes
    CREATE TABLE IF NOT EXISTS shared_opportunities (
      id SERIAL PRIMARY KEY,
      prime_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      naics_codes TEXT,
      set_aside VARCHAR(100),
      agency VARCHAR(255),
      response_deadline TIMESTAMP,
      value_min BIGINT,
      value_max BIGINT,
      roles_needed TEXT,
      requirements TEXT,
      status VARCHAR(50) DEFAULT 'open',
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Sub expressions of interest on shared opportunities
    CREATE TABLE IF NOT EXISTS opportunity_interests (
      id SERIAL PRIMARY KEY,
      shared_opp_id INTEGER REFERENCES shared_opportunities(id) ON DELETE CASCADE,
      sub_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      message TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(shared_opp_id, sub_user_id)
    );

    -- Saved/bookmarked opportunities
    CREATE TABLE IF NOT EXISTS saved_opportunities (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, opportunity_id)
    );

    -- Notifications system
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT,
      link VARCHAR(500),
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Add searches tracking to organizations for SubK features
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS searches_used INTEGER DEFAULT 0;
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS searches_limit INTEGER DEFAULT 100;

    -- Proposal tracker for GovCon capture management
    CREATE TABLE IF NOT EXISTS proposals (
      id SERIAL PRIMARY KEY,
      org_id INT REFERENCES organizations(id) ON DELETE CASCADE,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      opportunity_id INT REFERENCES opportunities(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'drafting',
      deadline TIMESTAMP,
      team_members JSONB DEFAULT '[]',
      sections JSONB DEFAULT '[]',
      estimated_value NUMERIC DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_proposals_org_id ON proposals(org_id);
    CREATE INDEX IF NOT EXISTS idx_proposals_user_id ON proposals(user_id);

    -- Competitive Intelligence tracking
    CREATE TABLE IF NOT EXISTS competitive_intel (
      id SERIAL PRIMARY KEY,
      org_id INT REFERENCES organizations(id) ON DELETE CASCADE,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      competitor_name TEXT NOT NULL,
      opportunity_id INT REFERENCES opportunities(id) ON DELETE SET NULL,
      threat_level TEXT DEFAULT 'medium',
      notes TEXT,
      strengths TEXT,
      weaknesses TEXT,
      contract_value NUMERIC DEFAULT 0,
      outcome TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_competitive_intel_org_id ON competitive_intel(org_id);
    CREATE INDEX IF NOT EXISTS idx_competitive_intel_user_id ON competitive_intel(user_id);

    -- Enhanced sub profile fields for v3.27 capability statement generator
    ALTER TABLE sub_profiles ADD COLUMN IF NOT EXISTS company_description TEXT DEFAULT '';
    ALTER TABLE sub_profiles ADD COLUMN IF NOT EXISTS founded_year INTEGER;
    ALTER TABLE sub_profiles ADD COLUMN IF NOT EXISTS employee_count TEXT DEFAULT '';
    ALTER TABLE sub_profiles ADD COLUMN IF NOT EXISTS annual_revenue TEXT DEFAULT '';
    ALTER TABLE sub_profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(50) DEFAULT '';
    ALTER TABLE sub_profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255) DEFAULT '';
    ALTER TABLE sub_profiles ADD COLUMN IF NOT EXISTS capabilities TEXT DEFAULT '';
    ALTER TABLE sub_profiles ADD COLUMN IF NOT EXISTS differentiators TEXT DEFAULT '';
    ALTER TABLE sub_profiles ADD COLUMN IF NOT EXISTS key_personnel JSON DEFAULT '[]';
    ALTER TABLE sub_profiles ADD COLUMN IF NOT EXISTS share_token VARCHAR(100);
  `);
  // Cleanup: delete fake seeded opportunities — they have SAM-20xx notice IDs which aren't real
  await pool.query(`
    DELETE FROM opportunities
    WHERE sam_notice_id LIKE 'SAM-20%'
       OR sam_notice_id LIKE 'LIVE-%'
       OR sam_notice_id LIKE 'live-%'
  `).then(r => {
    if (r.rowCount > 0) console.log(`Deleted ${r.rowCount} fake seeded opportunities`);
  }).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
  `);

  // Audit logging
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(50) NOT NULL,
      resource_type VARCHAR(50) NOT NULL,
      resource_id VARCHAR(100),
      ip_address VARCHAR(100),
      details JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
  `);

  // Login history for suspicious login detection
  await pool.query(`
    CREATE TABLE IF NOT EXISTS login_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      ip_address VARCHAR(100),
      user_agent VARCHAR(500),
      success BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_login_history_created ON login_history(created_at);
  `);

  // 2FA columns on users
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_secret VARCHAR(255);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_enabled BOOLEAN DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_backup_codes JSONB;
  `);

  // FEATURE 2: Database tables for USASpending, Capture, Forecast, and AI Proposals
  await pool.query(`
    CREATE TABLE IF NOT EXISTS spending_cache (
      id SERIAL PRIMARY KEY,
      cache_key VARCHAR(500) UNIQUE NOT NULL,
      data JSONB NOT NULL,
      fetched_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours'
    );

    CREATE TABLE IF NOT EXISTS capture_items (
      id SERIAL PRIMARY KEY,
      org_id INTEGER REFERENCES organizations(id),
      user_id INTEGER REFERENCES users(id),
      opportunity_id INTEGER REFERENCES opportunities(id),
      title VARCHAR(500) NOT NULL,
      phase VARCHAR(50) DEFAULT 'lead',
      pwin INTEGER DEFAULT 10,
      gate_criteria JSONB DEFAULT '[]',
      milestones JSONB DEFAULT '[]',
      notes TEXT,
      go_no_go VARCHAR(20),
      estimated_value NUMERIC,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_capture_items_org ON capture_items(org_id);
    CREATE INDEX IF NOT EXISTS idx_capture_items_phase ON capture_items(phase);
    ALTER TABLE capture_items ADD COLUMN IF NOT EXISTS estimated_value NUMERIC;

    CREATE TABLE IF NOT EXISTS forecast_opportunities (
      id SERIAL PRIMARY KEY,
      org_id INTEGER REFERENCES organizations(id),
      title VARCHAR(500),
      agency VARCHAR(300),
      naics_code VARCHAR(20),
      estimated_value_min NUMERIC,
      estimated_value_max NUMERIC,
      estimated_timeline VARCHAR(100),
      source VARCHAR(100),
      source_url TEXT,
      description TEXT,
      status VARCHAR(50) DEFAULT 'forecast',
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_forecast_org ON forecast_opportunities(org_id);

    CREATE TABLE IF NOT EXISTS past_performance_narratives (
      id SERIAL PRIMARY KEY,
      org_id INTEGER REFERENCES organizations(id),
      user_id INTEGER REFERENCES users(id),
      title VARCHAR(500),
      content TEXT,
      opportunity_id INTEGER,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ppn_org ON past_performance_narratives(org_id);

    -- FEATURE 8: Labor Rate Benchmarking
    CREATE TABLE IF NOT EXISTS rate_benchmarks (
      id SERIAL PRIMARY KEY,
      org_id INTEGER REFERENCES organizations(id),
      category VARCHAR(200),
      rate NUMERIC,
      region VARCHAR(100),
      experience_level VARCHAR(50),
      source VARCHAR(200),
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_rate_benchmarks_org ON rate_benchmarks(org_id);

    -- FEATURE 10: Compliance Readiness Checker
    CREATE TABLE IF NOT EXISTS compliance_items (
      id SERIAL PRIMARY KEY,
      org_id INTEGER REFERENCES organizations(id),
      requirement_key VARCHAR(200),
      category VARCHAR(100),
      status VARCHAR(50) DEFAULT 'pending',
      expiration_date DATE,
      notes TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_compliance_items_org ON compliance_items(org_id);

    -- FEATURE 13: FOIA Request Center
    CREATE TABLE IF NOT EXISTS foia_requests (
      id SERIAL PRIMARY KEY,
      org_id INTEGER REFERENCES organizations(id),
      user_id INTEGER REFERENCES users(id),
      title VARCHAR(500),
      agency VARCHAR(300),
      template_type VARCHAR(100),
      request_text TEXT,
      status VARCHAR(50) DEFAULT 'draft',
      tracking_number VARCHAR(200),
      submitted_date DATE,
      response_date DATE,
      documents JSONB DEFAULT '[]',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_foia_requests_org ON foia_requests(org_id);
    CREATE INDEX IF NOT EXISTS idx_foia_requests_user ON foia_requests(user_id);

    -- FEATURE 14: Subcontracting Plan Builder
    CREATE TABLE IF NOT EXISTS subcon_plans (
      id SERIAL PRIMARY KEY,
      org_id INTEGER REFERENCES organizations(id),
      title VARCHAR(500),
      contract_value NUMERIC,
      sb_goal_pct NUMERIC DEFAULT 23,
      sdb_goal_pct NUMERIC DEFAULT 5,
      wosb_goal_pct NUMERIC DEFAULT 5,
      hubzone_goal_pct NUMERIC DEFAULT 3,
      sdvosb_goal_pct NUMERIC DEFAULT 3,
      identified_subs JSONB DEFAULT '[]',
      actuals JSONB DEFAULT '{}',
      plan_text TEXT,
      status VARCHAR(50) DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_subcon_plans_org ON subcon_plans(org_id);

    -- FEATURE 15: GovCon Event Calendar
    CREATE TABLE IF NOT EXISTS govcon_events (
      id SERIAL PRIMARY KEY,
      org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
      title VARCHAR(500) NOT NULL,
      event_type VARCHAR(100),
      agency VARCHAR(300),
      location VARCHAR(500),
      start_date DATE,
      end_date DATE,
      url TEXT,
      description TEXT,
      rsvp_status VARCHAR(50) DEFAULT 'none',
      notes TEXT,
      is_global BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_govcon_events_org ON govcon_events(org_id);
    CREATE INDEX IF NOT EXISTS idx_govcon_events_start_date ON govcon_events(start_date);

    -- FEATURE 16: Document Collaboration (versioning and comments)
    CREATE TABLE IF NOT EXISTS doc_comments (
      id SERIAL PRIMARY KEY,
      proposal_id INTEGER REFERENCES proposals(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      section VARCHAR(200),
      content TEXT,
      resolved BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_doc_comments_proposal ON doc_comments(proposal_id);

    CREATE TABLE IF NOT EXISTS doc_versions (
      id SERIAL PRIMARY KEY,
      proposal_id INTEGER REFERENCES proposals(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      version_number INTEGER,
      snapshot JSONB,
      change_summary TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_doc_versions_proposal ON doc_versions(proposal_id);

    -- FEATURE 17: Automated Market Research Reports
    CREATE TABLE IF NOT EXISTS market_research_reports (
      id SERIAL PRIMARY KEY,
      org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(500),
      naics VARCHAR(20),
      agency VARCHAR(300),
      content TEXT,
      data_snapshot JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_market_research_org ON market_research_reports(org_id);

    -- FEATURE 18: Contract Vehicle Tracker
    CREATE TABLE IF NOT EXISTS contract_vehicles (
      id SERIAL PRIMARY KEY,
      org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(500),
      vehicle_type VARCHAR(100),
      contract_number VARCHAR(200),
      agency VARCHAR(300),
      ceiling_value NUMERIC,
      current_value NUMERIC,
      start_date DATE,
      end_date DATE,
      option_years INTEGER DEFAULT 0,
      naics_codes JSONB DEFAULT '[]',
      status VARCHAR(50) DEFAULT 'active',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_contract_vehicles_org ON contract_vehicles(org_id);
    CREATE INDEX IF NOT EXISTS idx_contract_vehicles_status ON contract_vehicles(status);

    -- FEATURE 19: Government Contact Database
    CREATE TABLE IF NOT EXISTS gov_contacts (
      id SERIAL PRIMARY KEY,
      org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(300) NOT NULL,
      title VARCHAR(300),
      agency VARCHAR(300),
      office VARCHAR(300),
      email VARCHAR(300),
      phone VARCHAR(50),
      linkedin VARCHAR(500),
      notes TEXT,
      last_interaction DATE,
      interaction_count INTEGER DEFAULT 0,
      tags JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_gov_contacts_org ON gov_contacts(org_id);
    CREATE INDEX IF NOT EXISTS idx_gov_contacts_agency ON gov_contacts(agency);

    -- FEATURE 20: Bid/No-Bid Decision Tool
    CREATE TABLE IF NOT EXISTS bid_decisions (
      id SERIAL PRIMARY KEY,
      org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE SET NULL,
      title VARCHAR(500),
      criteria JSONB DEFAULT '{}',
      total_score NUMERIC,
      recommendation VARCHAR(50),
      decision VARCHAR(50),
      decision_date DATE,
      rationale TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_bid_decisions_org ON bid_decisions(org_id);
    CREATE INDEX IF NOT EXISTS idx_bid_decisions_user ON bid_decisions(user_id);

    -- FEATURE 21: Revenue Forecasting
    CREATE TABLE IF NOT EXISTS revenue_entries (
      id SERIAL PRIMARY KEY,
      org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
      title VARCHAR(500),
      amount NUMERIC,
      month DATE,
      source VARCHAR(100),
      is_actual BOOLEAN DEFAULT false,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_revenue_entries_org ON revenue_entries(org_id);
    CREATE INDEX IF NOT EXISTS idx_revenue_entries_month ON revenue_entries(month);
  `);

  // Clean up expired refresh tokens and old login history on startup
  await pool.query(`DELETE FROM refresh_tokens WHERE expires_at < NOW()`);
  await pool.query(`DELETE FROM login_history WHERE created_at < NOW() - INTERVAL '90 days'`).catch(() => {});
  await pool.query(`DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '365 days'`).catch(() => {});
  console.log('SumX CRM database initialized');
};

module.exports = { pool, initDb };





