# Database Indexing Strategy

## Overview

This document outlines the comprehensive indexing strategy for Imaginarium's database, covering both SQLite (development) and PostgreSQL (production) environments. The strategy is designed to optimize query performance, support scalability, and minimize index maintenance overhead.

## Index Design Principles

### 1. **Selective Indexing**
- Only create indexes that support frequent queries
- Avoid over-indexing to minimize write performance impact
- Consider index maintenance costs vs. query performance benefits

### 2. **Composite Index Order**
- Place most selective columns first
- Follow query patterns (WHERE clause order)
- Consider sort order requirements

### 3. **Covering Indexes**
- Include frequently selected columns to avoid table lookups
- Balance index size vs. performance gains

### 4. **Partial Indexes**
- Use WHERE clauses to index only relevant rows
- Particularly useful for soft deletes and status filtering

## SQLite vs PostgreSQL Differences

### SQLite Limitations
- No concurrent index creation
- Limited index types (B-tree only)
- No partial indexes (in older versions)
- No expression indexes
- Simpler query planner

### PostgreSQL Advantages
- Multiple index types (B-tree, Hash, GIN, GiST, BRIN)
- Concurrent index creation
- Partial and expression indexes
- Advanced query planner with better statistics
- Parallel query execution

## Index Categories

### 1. **Primary Key Indexes** (Automatic)
All tables have automatic indexes on primary keys (`id` fields).

### 2. **Foreign Key Indexes** (Critical)
```sql
-- User relations
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_pipelines_user_id ON pipelines(user_id);
CREATE INDEX idx_pipeline_runs_user_id ON pipeline_runs(user_id);
CREATE INDEX idx_pipeline_runs_pipeline_id ON pipeline_runs(pipeline_id);
CREATE INDEX idx_task_executions_run_id ON task_executions(run_id);
CREATE INDEX idx_execution_logs_run_id ON execution_logs(run_id);
CREATE INDEX idx_artifacts_run_id ON artifacts(run_id);
CREATE INDEX idx_file_references_run_id ON file_references(run_id);
```

### 3. **Status and State Indexes**
```sql
-- Execution status tracking
CREATE INDEX idx_pipeline_runs_status ON pipeline_runs(status);
CREATE INDEX idx_task_executions_status ON task_executions(status);
CREATE INDEX idx_pipelines_status ON pipelines(status);
CREATE INDEX idx_file_uploads_status ON file_uploads(status);

-- Composite status indexes for common queries
CREATE INDEX idx_pipeline_runs_user_status ON pipeline_runs(user_id, status);
CREATE INDEX idx_pipeline_runs_pipeline_status ON pipeline_runs(pipeline_id, status);
```

### 4. **Temporal Indexes**
```sql
-- Chronological queries
CREATE INDEX idx_pipeline_runs_queued_at ON pipeline_runs(queued_at);
CREATE INDEX idx_pipeline_runs_started_at ON pipeline_runs(started_at);
CREATE INDEX idx_pipeline_runs_completed_at ON pipeline_runs(completed_at);
CREATE INDEX idx_execution_logs_timestamp ON execution_logs(timestamp);
CREATE INDEX idx_file_uploads_uploaded_at ON file_uploads(uploaded_at);
```

### 5. **Soft Delete Indexes**
```sql
-- Partial indexes for active records (PostgreSQL)
CREATE INDEX idx_users_active ON users(id) WHERE deleted_at IS NULL;
CREATE INDEX idx_pipelines_active ON pipelines(id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sessions_active ON sessions(id) WHERE deleted_at IS NULL;

-- For SQLite (no partial index support)
CREATE INDEX idx_users_deleted_at ON users(deleted_at);
CREATE INDEX idx_pipelines_deleted_at ON pipelines(deleted_at);
```

### 6. **Search and Lookup Indexes**
```sql
-- Email and token lookups
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE UNIQUE INDEX idx_sessions_token ON sessions(token);
CREATE UNIQUE INDEX idx_api_keys_key ON api_keys(key);
CREATE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix);

-- PostgreSQL text search indexes
CREATE INDEX idx_users_name_gin ON users USING gin(name gin_trgm_ops);
CREATE INDEX idx_pipelines_name_gin ON pipelines USING gin(name gin_trgm_ops);
CREATE INDEX idx_users_company_gin ON users USING gin(company gin_trgm_ops);
```

### 7. **Performance-Critical Composite Indexes**
```sql
-- Queue processing
CREATE INDEX idx_pipeline_runs_queue ON pipeline_runs(status, priority, queued_at) 
  WHERE status IN ('QUEUED', 'PENDING');

-- User activity tracking
CREATE INDEX idx_pipeline_runs_user_timeline ON pipeline_runs(user_id, queued_at);
CREATE INDEX idx_sessions_user_active ON sessions(user_id, is_revoked) 
  WHERE deleted_at IS NULL;

-- Execution monitoring
CREATE INDEX idx_task_executions_run_order ON task_executions(run_id, execution_order);
CREATE INDEX idx_execution_logs_run_level ON execution_logs(run_id, level, timestamp);
```

### 8. **Analytics and Reporting Indexes**
```sql
-- Cost analysis
CREATE INDEX idx_pipeline_runs_cost ON pipeline_runs(actual_cost) 
  WHERE actual_cost IS NOT NULL;

-- Performance analysis
CREATE INDEX idx_pipeline_runs_duration ON pipeline_runs(duration) 
  WHERE duration IS NOT NULL;

-- Token usage
CREATE INDEX idx_pipeline_runs_tokens ON pipeline_runs(tokens_used) 
  WHERE tokens_used IS NOT NULL;
```

## PostgreSQL-Specific Optimizations

### 1. **GIN Indexes for JSON Fields**
```sql
-- JSONB search optimization
CREATE INDEX idx_pipeline_configuration_gin ON pipelines USING gin(configuration);
CREATE INDEX idx_pipeline_runs_inputs_gin ON pipeline_runs USING gin(inputs);
CREATE INDEX idx_pipeline_runs_outputs_gin ON pipeline_runs USING gin(outputs);
CREATE INDEX idx_artifacts_metadata_gin ON artifacts USING gin(metadata);
```

### 2. **Partial Indexes for Common Filters**
```sql
-- Public content discovery
CREATE INDEX idx_pipelines_public_published ON pipelines(published_at) 
  WHERE is_public = true AND deleted_at IS NULL;

-- Active API keys
CREATE INDEX idx_api_keys_active_valid ON api_keys(user_id, expires_at) 
  WHERE is_active = true AND is_revoked = false AND deleted_at IS NULL;

-- Failed executions for monitoring
CREATE INDEX idx_pipeline_runs_failed_recent ON pipeline_runs(pipeline_id, completed_at) 
  WHERE status = 'FAILED' AND completed_at > NOW() - INTERVAL '7 days';
```

### 3. **Expression Indexes**
```sql
-- Case-insensitive email search
CREATE INDEX idx_users_email_lower ON users(LOWER(email));

-- Date-based queries
CREATE INDEX idx_pipeline_runs_date ON pipeline_runs(DATE(queued_at));

-- Computed fields
CREATE INDEX idx_file_uploads_size_mb ON file_uploads((size / 1048576));
```

### 4. **Multicolumn Statistics**
```sql
-- Help query planner understand correlated columns
CREATE STATISTICS stat_pipeline_runs_status_priority ON status, priority FROM pipeline_runs;
CREATE STATISTICS stat_users_role_active ON role, is_active FROM users;
```

## Index Maintenance Strategy

### 1. **Regular Maintenance Tasks**
```sql
-- PostgreSQL
VACUUM ANALYZE; -- Update statistics and reclaim space
REINDEX CONCURRENTLY; -- Rebuild indexes without locking

-- Monitor index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan;

-- Find unused indexes
SELECT schemaname, tablename, indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND indexrelid NOT IN (
  SELECT conindid FROM pg_constraint WHERE contype = 'p'
);
```

### 2. **Index Monitoring Queries**
```sql
-- Index size monitoring
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;

-- Missing index detection (slow queries without index usage)
SELECT
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
AND mean_time > 1000 -- queries taking more than 1 second
ORDER BY mean_time DESC;
```

### 3. **Index Creation Best Practices**
```sql
-- Create indexes concurrently in production
CREATE INDEX CONCURRENTLY idx_name ON table_name(column_name);

-- Create indexes with specific tablespace
CREATE INDEX idx_name ON table_name(column_name) TABLESPACE fast_ssd;

-- Create indexes with custom fill factor for frequently updated tables
CREATE INDEX idx_name ON table_name(column_name) WITH (fillfactor = 70);
```

## Migration Strategy

### 1. **Development to Production Migration**

#### Step 1: Analyze Development Patterns
```bash
# Export query patterns from development
npm run analyze:queries:export > query-patterns.json
```

#### Step 2: Generate PostgreSQL-Specific Indexes
```sql
-- Run the migration script
psql -d imaginarium -f migrations/indexes/postgresql-indexes.sql
```

#### Step 3: Validate Index Usage
```sql
-- Check that indexes are being used
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan > 0
ORDER BY idx_scan DESC;
```

### 2. **Index Migration Script**
```sql
-- migrations/indexes/postgresql-indexes.sql
BEGIN;

-- Drop SQLite-specific indexes if they exist
DROP INDEX IF EXISTS idx_simple_index;

-- Create PostgreSQL-optimized indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_gin 
  ON users USING gin(email gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pipeline_runs_queue_partial 
  ON pipeline_runs(priority, queued_at) 
  WHERE status IN ('QUEUED', 'PENDING');

-- Add more indexes...

COMMIT;
```

## Performance Benchmarks

### Expected Query Performance Improvements

| Query Type | Without Index | With Index | Improvement |
|------------|---------------|------------|-------------|
| User lookup by email | 45ms | 0.5ms | 90x |
| Pipeline runs by status | 320ms | 3ms | 106x |
| Execution logs by run | 890ms | 12ms | 74x |
| Public pipelines list | 560ms | 8ms | 70x |
| Task execution order | 230ms | 2ms | 115x |

### Index Size Considerations

| Table | Row Count | Index Count | Total Index Size | Table Size Ratio |
|-------|-----------|-------------|------------------|------------------|
| users | 10K | 12 | 4MB | 0.8x |
| pipeline_runs | 1M | 18 | 245MB | 1.2x |
| execution_logs | 10M | 9 | 1.8GB | 0.9x |
| artifacts | 5M | 15 | 890MB | 1.1x |

## Query Optimization Examples

### 1. **Queue Processing Query**
```sql
-- Optimized query using composite index
SELECT * FROM pipeline_runs
WHERE status IN ('QUEUED', 'PENDING')
ORDER BY priority DESC, queued_at ASC
LIMIT 10;
-- Uses: idx_pipeline_runs_queue
```

### 2. **User Activity Dashboard**
```sql
-- Optimized query using multiple indexes
SELECT 
  p.id,
  p.name,
  pr.status,
  pr.queued_at,
  pr.duration
FROM pipelines p
INNER JOIN pipeline_runs pr ON p.id = pr.pipeline_id
WHERE p.user_id = $1
  AND p.deleted_at IS NULL
  AND pr.queued_at >= NOW() - INTERVAL '30 days'
ORDER BY pr.queued_at DESC
LIMIT 20;
-- Uses: idx_pipelines_user_id, idx_pipeline_runs_pipeline_id, idx_pipeline_runs_queued_at
```

### 3. **Execution Monitoring Query**
```sql
-- Optimized query for real-time monitoring
SELECT 
  te.id,
  te.node_name,
  te.status,
  te.progress,
  COUNT(el.id) as log_count,
  MAX(el.timestamp) as last_log
FROM task_executions te
LEFT JOIN execution_logs el ON te.id = el.task_id
WHERE te.run_id = $1
GROUP BY te.id, te.node_name, te.status, te.progress
ORDER BY te.execution_order;
-- Uses: idx_task_executions_run_order, idx_execution_logs_task_id
```

## Monitoring and Alerts

### 1. **Slow Query Alerts**
Configure alerts when queries exceed thresholds:
- Single query > 5 seconds
- Average query time > 1 second
- Query error rate > 5%

### 2. **Index Health Monitoring**
- Index bloat > 50%
- Unused indexes after 30 days
- Missing indexes for frequent queries

### 3. **Performance Metrics**
Track these KPIs:
- Query response time (p50, p95, p99)
- Index hit ratio (target > 95%)
- Cache hit ratio (target > 80%)
- Dead tuple ratio (target < 10%)

## Best Practices

1. **Test index changes in staging** before applying to production
2. **Create indexes during low-traffic periods** or use CONCURRENTLY
3. **Monitor index usage** and remove unused indexes
4. **Keep statistics updated** with regular ANALYZE
5. **Consider partitioning** for very large tables (>100M rows)
6. **Use index hints sparingly** - let the query planner work
7. **Document all custom indexes** with their purpose
8. **Review execution plans** for critical queries regularly

## Conclusion

This indexing strategy provides a solid foundation for query performance while maintaining reasonable write performance and storage overhead. Regular monitoring and adjustment based on actual usage patterns will ensure optimal performance as the application scales.