CREATE TYPE doc_verification_status_enum AS ENUM (
  'PENDING',
  'VERIFIED',
  'REJECTED'
);

CREATE TABLE IF NOT EXISTS driver (
  driver_id SERIAL PRIMARY KEY,
  user_id INT UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  is_request_accepted BOOLEAN DEFAULT FALSE,
  doc_verification_type VARCHAR(50) DEFAULT "DRIVING_LICENSE" CHECK (doc_verification_type = 'DRIVING_LICENSE'),
  verification_doc_url TEXT,
  doc_verification_status doc_verification_status_enum DEFAULT 'PENDING'::doc_verification_status_enum;
  requested_garden_manager_id INT
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);