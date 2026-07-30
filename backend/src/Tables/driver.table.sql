CREATE TABLE IF NOT EXISTS driver (
  driver_id SERIAL PRIMARY KEY,
  user_id INT UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  license_number VARCHAR(50),
  is_license_verified BOOLEAN DEFAULT FALSE,
  is_request_accepted BOOLEAN DEFAULT FALSE,
  requested_garden_manager_id INT
);