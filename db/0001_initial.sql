CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS invite_codes (code TEXT PRIMARY KEY, used_by TEXT, revoked INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, used_at TEXT);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS game_saves (user_id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS scores (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, challenge_date TEXT NOT NULL, score INTEGER NOT NULL, moves INTEGER NOT NULL, highest_tile INTEGER NOT NULL, created_at TEXT NOT NULL, UNIQUE(user_id, challenge_date));
CREATE INDEX IF NOT EXISTS scores_date_score ON scores(challenge_date, score DESC);
