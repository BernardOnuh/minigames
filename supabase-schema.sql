-- Run this in Supabase Dashboard → SQL Editor

-- Games listing table
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'arcade',
  icon TEXT,
  reward TEXT,
  thumb_bg TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Game config (settings per game)
CREATE TABLE IF NOT EXISTS game_config (
  id SERIAL PRIMARY KEY,
  game_id TEXT UNIQUE NOT NULL,
  game_title TEXT NOT NULL,
  game_type TEXT NOT NULL DEFAULT 'arcade',
  icon TEXT,
  thumb_bg TEXT,
  base_xp INTEGER DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  wallet TEXT PRIMARY KEY,
  username TEXT,
  avatar_color TEXT DEFAULT '#a78bfa',
  avatar_text TEXT DEFAULT '#000',
  xp INTEGER DEFAULT 0,
  earnings NUMERIC DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  email TEXT,
  referral_code_used TEXT,
  onboarded_at TIMESTAMPTZ,
  drip_tx TEXT,
  waitlist_tx TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Game results (sessions)
CREATE TABLE IF NOT EXISTS game_results (
  id SERIAL PRIMARY KEY,
  wallet TEXT NOT NULL REFERENCES user_profiles(wallet),
  game_id UUID NOT NULL REFERENCES games(id),
  score INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  status TEXT DEFAULT 'playing',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Weekly leaderboard
CREATE TABLE IF NOT EXISTS leaderboard_weekly (
  wallet TEXT PRIMARY KEY REFERENCES user_profiles(wallet),
  username TEXT,
  xp INTEGER DEFAULT 0,
  earnings NUMERIC DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  avatar_color TEXT DEFAULT '#a78bfa',
  avatar_text TEXT DEFAULT '#000',
  rank INTEGER DEFAULT 999
);

-- Lobby chat
CREATE TABLE IF NOT EXISTS lobby_chat (
  id SERIAL PRIMARY KEY,
  wallet TEXT NOT NULL,
  username TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Match tables (for multiplayer)
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL,
  round INTEGER DEFAULT 1,
  pool NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'waiting',
  started_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS match_players (
  id SERIAL PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES matches(id),
  wallet TEXT NOT NULL
);

-- Enable RLS
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Allow anon to insert/update game_results
CREATE POLICY "anon_insert_game_results" ON game_results
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update_game_results" ON game_results
  FOR UPDATE TO anon USING (true);

-- Allow anon to select/update user_profiles
CREATE POLICY "anon_select_user_profiles" ON user_profiles
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_user_profiles" ON user_profiles
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update_user_profiles" ON user_profiles
  FOR UPDATE TO anon USING (true);

-- Allow anon to read games, game_config, leaderboard
CREATE POLICY "anon_select_games" ON games FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_game_config" ON game_config FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_leaderboard" ON leaderboard_weekly FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_leaderboard" ON leaderboard_weekly FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_leaderboard" ON leaderboard_weekly FOR UPDATE TO anon USING (true);

-- Insert game data
INSERT INTO games (game_id, title, type, icon, reward, thumb_bg) VALUES
  ('flappy_bird', 'Flappy Bird', 'arcade', '🐦', '50 XP', '#7c3aed'),
  ('snake', 'Snake Game', 'arcade', '🐍', '50 XP', '#059669'),
  ('trivia', 'Trivia Master', 'trivia', '🧠', '75 XP', '#d97706'),
  ('mini_golf', 'Doodle Mini Golf', 'arcade', '🏌️', '50-300 XP', 'linear-gradient(135deg,#0a1f3f,#1a3f5f)'),
  ('fruit_blitz', 'Fruit Blitz', 'arcade', '🍉', '50-200 XP', 'linear-gradient(135deg,#1a0a2e,#2d1b4e)')
ON CONFLICT (game_id) DO NOTHING;

INSERT INTO game_config (game_id, game_title, game_type, icon, thumb_bg, base_xp) VALUES
  ('flappy_bird', 'Flappy Bird', 'arcade', '🐦', '#7c3aed', 50),
  ('snake', 'Snake Game', 'arcade', '🐍', '#059669', 50),
  ('trivia', 'Trivia Master', 'trivia', '🧠', '#d97706', 75),
  ('mini_golf', 'Doodle Mini Golf', 'arcade', '🏌️', 'linear-gradient(135deg,#0a1f3f,#1a3f5f)', 100),
  ('fruit_blitz', 'Fruit Blitz', 'arcade', '🍉', 'linear-gradient(135deg,#1a0a2e,#2d1b4e)', 75)
ON CONFLICT (game_id) DO NOTHING;
