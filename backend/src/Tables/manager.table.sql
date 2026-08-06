CREATE TYPE doc_verification_status_enum AS ENUM (
  'PENDING',
  'VERIFIED',
  'REJECTED'
);

CREATE TABLE IF NOT EXISTS manager (
  manager_id SERIAL PRIMARY KEY,
  user_id INT UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  factor_verification JSONB DEFAULT '{}'::jsonb
  doc_verification_status doc_verification_status_enum DEFAULT 'PENDING'::doc_verification_status_enum;
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);