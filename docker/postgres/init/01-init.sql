-- Initialize Imaginarium database

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS imaginarium;

-- Set default search path
ALTER DATABASE imaginarium SET search_path TO imaginarium, public;

-- Create application user (if different from postgres user)
-- This will only run if the user doesn't exist
DO $$ 
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'imaginarium_app') THEN
      CREATE USER imaginarium_app WITH PASSWORD 'app_password_change_in_production';
      GRANT CONNECT ON DATABASE imaginarium TO imaginarium_app;
      GRANT USAGE ON SCHEMA imaginarium TO imaginarium_app;
      GRANT CREATE ON SCHEMA imaginarium TO imaginarium_app;
   END IF;
END
$$;