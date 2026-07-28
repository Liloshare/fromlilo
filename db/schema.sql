CREATE TABLE IF NOT EXISTS review_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  source_type TEXT NOT NULL,
  image_key TEXT NOT NULL,
  image_filename TEXT NOT NULL,
  annotation_filename TEXT,
  action TEXT NOT NULL,
  note TEXT,
  issue_types TEXT,
  missing_class TEXT,
  box_count INTEGER DEFAULT 0,
  status TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(user_email, source_type, image_key)
);

CREATE INDEX IF NOT EXISTS idx_review_results_user_email
ON review_results(user_email);

CREATE INDEX IF NOT EXISTS idx_review_results_image
ON review_results(source_type, image_key);

CREATE INDEX IF NOT EXISTS idx_review_results_updated_at
ON review_results(updated_at);
