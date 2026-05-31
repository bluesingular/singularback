-- T2: Replace IVFFlat with HNSW for memory_entries embedding index.
-- HNSW is faster for datasets < 500k vectors (current scale).
-- Switch to IVFFlat when any company has > 500k memory entries.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  ) THEN
    DROP INDEX IF EXISTS memory_entries_embedding_idx;

    -- HNSW parameters: m=16 (bi-directional links), ef_construction=64 (build quality)
    -- These are the defaults recommended by pgvector for general use.
    CREATE INDEX memory_entries_embedding_idx
      ON memory_entries
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);

    RAISE NOTICE 'HNSW index created on memory_entries.embedding';
  ELSE
    RAISE NOTICE 'pgvector not loaded — HNSW index skipped';
  END IF;
END$$;
