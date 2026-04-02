const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
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
    CREATE UNIQUE INDEX IF NOT EXISTS sequence_events_lead_touchpoint ON sequence_events(lead_id, touchpoint);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_refresh_token TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_email VARCHAR(255);
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
    CREATE UNIQUE INDEX IF NOT EXISTS sequence_events_lead_touchpoint ON sequence_events(lead_id, touchpoint);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_refresh_token TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_email VARCHAR(255);
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
  `);
  console.log('Database initialized');
};

module.exports = { pool, initDb };
