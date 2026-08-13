CREATE TYPE verification_doc_type_enum AS ENUM (
  'AADHAAR',
  'PAN',
);

CREATE TYPE doc_verification_status_enum AS ENUM (
  'PENDING',
  'VERIFIED',
  'REJECTED'
);

CREATE TABLE IF NOT EXISTS stg (
  stg_id SERIAL PRIMARY KEY,
  user_id INT UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  verification_doc_type verification_doc_type_enum,
  verification_doc_url TEXT,
  doc_verification_status doc_verification_status_enum DEFAULT 'PENDING'::doc_verification_status_enum,
  is_request_accepted BOOLEAN DEFAULT FALSE,
  requested_garden_manager_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);