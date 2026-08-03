CREATE TABLE IF NOT EXISTS driver (
  driver_id SERIAL PRIMARY KEY,
  user_id INT UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  is_request_accepted BOOLEAN DEFAULT FALSE,
  verification_doc_type VARCHAR(50),
  verification_doc_url TEXT,
  doc_verification_status VARCHAR(500) DEFAULT 'PENDING';
  requested_garden_manager_id INT
);