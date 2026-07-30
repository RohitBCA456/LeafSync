CREATE TABLE IF NOT EXISTS manager (
  manager_id SERIAL PRIMARY KEY,
  user_id INT UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  factor_verification JSONB DEFAULT '{}'::jsonb
  doc_verification_status VARCHAR(500) DEFAULT 'PENDING';
);