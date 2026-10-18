-- Existing unowned demo rows are preserved but never exposed to signed-in users.
ALTER TABLE todos ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX todos_user_created ON todos(user_id, created_at DESC, id DESC);

CREATE TABLE api_keys (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 key_hash TEXT NOT NULL UNIQUE,
 prefix TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
 last_used_at TEXT
);
CREATE INDEX api_keys_user ON api_keys(user_id);

CREATE TABLE waitlist (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 name TEXT NOT NULL DEFAULT '',
 consent INTEGER NOT NULL CHECK(consent = 1),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE rate_limits (
 key TEXT PRIMARY KEY,
 window_start INTEGER NOT NULL,
 count INTEGER NOT NULL
);
