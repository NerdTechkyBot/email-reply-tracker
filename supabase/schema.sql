-- The Global Associates - AI Email Reply Analyzer
-- Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mailboxes table
CREATE TABLE mailboxes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_address TEXT NOT NULL,
    google_user_id TEXT,
    label_ids JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'connected' CHECK (status IN ('connected', 'error', 'disabled')),
    last_synced_at TIMESTAMPTZ,
    last_history_id TEXT,
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, email_address)
);

-- Threads table
CREATE TABLE threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mailbox_id UUID NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
    gmail_thread_id TEXT NOT NULL,
    subject TEXT,
    lead_email TEXT,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(mailbox_id, gmail_thread_id)
);

-- Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    gmail_message_id TEXT NOT NULL UNIQUE,
    direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
    from_address TEXT NOT NULL,
    to_addresses TEXT[] DEFAULT ARRAY[]::TEXT[],
    cc_addresses TEXT[] DEFAULT ARRAY[]::TEXT[],
    subject TEXT,
    snippet TEXT,
    body_plain TEXT,
    body_html TEXT,
    received_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Classifications table
CREATE TABLE classifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'warm', 'neutral', 'negative', 'auto_reply', 'out_of_office', 'spam')),
    confidence_score NUMERIC(3, 2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    interest_level TEXT CHECK (interest_level IN ('high', 'medium', 'low', 'none')),
    summary TEXT,
    category TEXT,
    recommended_action TEXT,
    raw_ai_response JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id)
);

-- Alerts table
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    classification_id UUID NOT NULL REFERENCES classifications(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('email', 'webhook', 'slack')),
    sent_to TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'error')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

-- Settings table
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notify_email TEXT,
    enabled_sentiments TEXT[] DEFAULT ARRAY['positive', 'warm']::TEXT[],
    timezone TEXT DEFAULT 'UTC',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Indexes for performance
CREATE INDEX idx_mailboxes_user_id ON mailboxes(user_id);
CREATE INDEX idx_mailboxes_status ON mailboxes(status);
CREATE INDEX idx_threads_mailbox_id ON threads(mailbox_id);
CREATE INDEX idx_threads_gmail_thread_id ON threads(gmail_thread_id);
CREATE INDEX idx_messages_thread_id ON messages(thread_id);
CREATE INDEX idx_messages_gmail_message_id ON messages(gmail_message_id);
CREATE INDEX idx_messages_direction ON messages(direction);
CREATE INDEX idx_messages_received_at ON messages(received_at DESC);
CREATE INDEX idx_classifications_message_id ON classifications(message_id);
CREATE INDEX idx_classifications_sentiment ON classifications(sentiment);
CREATE INDEX idx_classifications_interest_level ON classifications(interest_level);
CREATE INDEX idx_classifications_created_at ON classifications(created_at DESC);
CREATE INDEX idx_alerts_classification_id ON alerts(classification_id);
CREATE INDEX idx_alerts_status ON alerts(status);

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE mailboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Policies (adjust based on your auth setup)
-- Example: Users can only see their own data
CREATE POLICY "Users can view own data" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can view own mailboxes" ON mailboxes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can view own threads" ON threads FOR SELECT USING (
    mailbox_id IN (SELECT id FROM mailboxes WHERE user_id = auth.uid())
);
CREATE POLICY "Users can view own messages" ON messages FOR SELECT USING (
    thread_id IN (
        SELECT t.id FROM threads t 
        JOIN mailboxes m ON t.mailbox_id = m.id 
        WHERE m.user_id = auth.uid()
    )
);
CREATE POLICY "Users can view own classifications" ON classifications FOR SELECT USING (
    message_id IN (
        SELECT msg.id FROM messages msg
        JOIN threads t ON msg.thread_id = t.id
        JOIN mailboxes m ON t.mailbox_id = m.id
        WHERE m.user_id = auth.uid()
    )
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for settings table
CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
