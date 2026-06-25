-- DocuMind AI Database Schema
-- Run this in your Supabase SQL Editor to initialize the database tables.

-- Enable the pgvector extension (pre-installed in Supabase, needs to be enabled once)
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(50) UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  filename    VARCHAR(255) NOT NULL,
  page_count  INT,
  chunk_count INT,
  status      VARCHAR(20) DEFAULT 'processing',  -- 'processing' | 'ready' | 'failed'
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Document chunks table (stores text and its vector embedding together)
CREATE TABLE IF NOT EXISTS document_chunks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_text   TEXT NOT NULL,
  page_number  INT,
  chunk_index  INT,               -- sequence order within the document
  embedding    VECTOR(384)        -- 384 dimensions to match all-MiniLM-L6-v2 output
);

-- Index for fast cosine similarity search (using HNSW)
CREATE INDEX IF NOT EXISTS document_chunks_hnsw_idx 
  ON document_chunks 
  USING hnsw (embedding vector_cosine_ops);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID REFERENCES documents(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  role         VARCHAR(10) NOT NULL,   -- 'user' | 'assistant'
  content      TEXT NOT NULL,
  citations    JSONB,                  -- Array of source citation objects: [{ page, chunk_text, score }]
  created_at   TIMESTAMP DEFAULT NOW()
);
