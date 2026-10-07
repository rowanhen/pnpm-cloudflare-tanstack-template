CREATE TABLE todos (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
 completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0, 1)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX todos_created_at ON todos(created_at DESC, id DESC);
