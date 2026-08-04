CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  ph_number VARCHAR(15) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('stg', 'driver', 'manager')),
  avatar_url TEXT,
  location GEOGRAPHY(Point, 4326),
  is_email_verified BOOLEAN DEFAULT FALSE,
  refresh_token TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);