CREATE TYPE assignment_status_type_enum AS ENUM (
'ACTIVE',
'COMPLETED',
'CANCELLED'
);

CREATE TABLE driver_stg_assignments (
assignment_id SERIAL PRIMARY KEY,
driver_id INT NOT NULL REFERENCES driver(driver_id) ON DELETE CASCADE,
stg_id INT NOT NULL REFERENCES stg(stg_id) ON DELETE CASCADE,
manager_id INT NOT NULL REFERENCES manager(manager_id) ON DELETE CASCADE,
status assignment_status_type_enum DEFAULT 'ACTIVE',
assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT unique_active_stg UNIQUE(stg_id)
);