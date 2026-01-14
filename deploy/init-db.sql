-- Scoliologic Wiki - Database Initialization Script
-- This script is executed when PostgreSQL container starts for the first time

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For full-text search
CREATE EXTENSION IF NOT EXISTS "vector";   -- For embeddings (if pgvector is installed)

-- Create schema for wiki
CREATE SCHEMA IF NOT EXISTS wiki;

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA wiki TO wiki;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA wiki TO wiki;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA wiki TO wiki;

-- Set default search path
ALTER DATABASE wiki SET search_path TO wiki, public;

-- Create index for full-text search (will be used by the application)
-- Note: Actual tables are created by Drizzle migrations
