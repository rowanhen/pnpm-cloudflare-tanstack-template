-- Existing keys and orders keep their original permissions and fulfilment.
ALTER TABLE api_keys ADD COLUMN scope TEXT NOT NULL DEFAULT 'todos:read'
 CHECK (scope IN ('todos:read', 'summary:read'));
ALTER TABLE orders ADD COLUMN credits INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0);
ALTER TABLE orders ADD COLUMN price_id TEXT;

CREATE TABLE credit_accounts (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0 AND balance <= 9007199254740991)
);

CREATE TABLE credit_grants (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
 credits INTEGER NOT NULL CHECK (credits > 0),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX credit_grants_user ON credit_grants(user_id, created_at DESC);

CREATE TABLE paid_requests (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 key_id TEXT REFERENCES api_keys(id) ON DELETE SET NULL,
 idempotency_key TEXT NOT NULL,
 operation TEXT NOT NULL,
 input_hash TEXT NOT NULL,
 credits INTEGER NOT NULL CHECK (credits > 0),
 response TEXT NOT NULL CHECK (json_valid(response)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
 UNIQUE(user_id, idempotency_key)
);
CREATE INDEX paid_requests_user ON paid_requests(user_id, created_at DESC);
