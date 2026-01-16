-- Scoliologic Wiki - Database Initialization Script
-- This script is executed when PostgreSQL container starts for the first time

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For full-text search
CREATE EXTENSION IF NOT EXISTS "vector";   -- For AI vector embeddings (pgvector)

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

-- IVFFlat index for vector similarity search (pgvector)
-- This index significantly speeds up vector searches for >10k records
-- The index will be created after the table exists (via application migration)

-- Function to create IVFFlat index on page_embeddings table
-- Called after Drizzle migrations create the table
CREATE OR REPLACE FUNCTION create_embedding_index()
RETURNS void AS $$
BEGIN
    -- Check if table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'page_embeddings') THEN
        -- Check if index doesn't exist
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_page_embeddings_vector') THEN
            -- Create IVFFlat index for cosine similarity
            -- lists = 100 is optimal for 10k-100k vectors
            EXECUTE 'CREATE INDEX idx_page_embeddings_vector ON page_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)';
            RAISE NOTICE 'Created IVFFlat index on page_embeddings';
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to create index on search_history for analytics
CREATE OR REPLACE FUNCTION create_search_indexes()
RETURNS void AS $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'search_history') THEN
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_search_history_query_trgm') THEN
            EXECUTE 'CREATE INDEX idx_search_history_query_trgm ON search_history USING gin (query gin_trgm_ops)';
            RAISE NOTICE 'Created trigram index on search_history';
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;
