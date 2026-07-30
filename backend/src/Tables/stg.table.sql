CREATE TABLE IF NOT EXISTS stg (
  stg_id SERIAL PRIMARY KEY,
  user_id INT UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  is_doc_verified BOOLEAN DEFAULT FALSE,
  verification_doc_type VARCHAR(50),
  verification_doc_url TEXT,
  is_request_accepted BOOLEAN DEFAULT FALSE,
  requested_garden_manager_id INT -- Reference to manager if needed
);