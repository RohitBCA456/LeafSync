CREATE TYPE doc_verification_type AS ENUM (
  'AADHAAR',
  'PAN',
  'VOTER_ID',
  'DRIVING_LICENSE',
  'FACTORY_LICENSE'
);

CREATE TYPE doc_verification_status AS ENUM (
  'PENDING',
  'VERIFIED',
  'REJECTED'
);

CREATE TABLE IF NOT EXISTS stg (
  stg_id SERIAL PRIMARY KEY,
  user_id INT UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  is_doc_verified BOOLEAN DEFAULT FALSE,
  verification_doc_type doc_verification_type,
  verification_doc_url TEXT,
  doc_verification_status doc_verification_status DEFAULT 'PENDING'::doc_verification_status,
  is_request_accepted BOOLEAN DEFAULT FALSE,
  requested_garden_manager_id INT
);