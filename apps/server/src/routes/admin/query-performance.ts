/**
 * Query Performance Monitoring API
 * Provides endpoints for monitoring and analyzing database query performance
 */

import { Router, Request, Response } from 'express'
import { prisma } from '../../lib/prisma-optimized'
import { queryAnalyzer } from '../../lib/query-analyzer'
import { requireAuth, requireRole } from '../../middleware/auth'

const router = Router()

// Require admin role for all query performance endpoints
router.use(requireAuth)
router.use(requireRole('ADMIN'))

/**
 * Get query performance statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = queryAnalyzer.getStatistics()
    
    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('Error fetching query statistics:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch query statistics'
    })
  }
})

/**
 * Get slow queries
 */
router.get('/slow-queries', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50
    const slowQueries = queryAnalyzer.getSlowQueries().slice(0, limit)
    
    res.json({
      success: true,
      data: {
        queries: slowQueries,
        count: slowQueries.length
      }
    })
  } catch (error) {
    console.error('Error fetching slow queries:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch slow queries'
    })
  }
})

/**
 * Get query patterns
 */
router.get('/patterns', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50
    const patterns = queryAnalyzer.getQueryPatterns().slice(0, limit)
    
    res.json({
      success: true,
      data: {
        patterns,
        count: patterns.length
      }
    })
  } catch (error) {
    console.error('Error fetching query patterns:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch query patterns'
    })
  }
})

/**
 * Get index usage statistics (PostgreSQL only)
 */
router.get('/index-usage', async (req: Request, res: Response) => {
  try {
    if (process.env.DATABASE_PROVIDER !== 'postgresql') {
      return res.json({
        success: true,
        data: {
          message: 'Index usage statistics are only available for PostgreSQL',
          indexes: []
        }
      })
    }

    const indexUsage = await prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch,
        pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
      FROM pg_stat_user_indexes
      ORDER BY idx_scan DESC
      LIMIT 100
    `
    
    res.json({
      success: true,
      data: {
        indexes: indexUsage
      }
    })
  } catch (error) {
    console.error('Error fetching index usage:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch index usage'
    })
  }
})

/**
 * Get unused indexes (PostgreSQL only)
 */
router.get('/unused-indexes', async (req: Request, res: Response) => {
  try {
    if (process.env.DATABASE_PROVIDER !== 'postgresql') {
      return res.json({
        success: true,
        data: {
          message: 'Unused index detection is only available for PostgreSQL',
          indexes: []
        }
      })
    }

    const unusedIndexes = await prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
      FROM pg_stat_user_indexes
      WHERE idx_scan = 0
      AND indexrelid NOT IN (
        SELECT conindid FROM pg_constraint WHERE contype = 'p'
      )
      ORDER BY pg_relation_size(indexrelid) DESC
    `
    
    res.json({
      success: true,
      data: {
        indexes: unusedIndexes
      }
    })
  } catch (error) {
    console.error('Error fetching unused indexes:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unused indexes'
    })
  }
})

/**
 * Get table statistics
 */
router.get('/table-stats', async (req: Request, res: Response) => {
  try {
    const tableStats = []
    
    // Get row counts for each table
    const tables = [
      'user', 'session', 'apiKey', 'pipeline', 'pipelineRun',
      'taskExecution', 'executionLog', 'fileUpload', 'artifact'
    ]
    
    for (const table of tables) {
      try {
        const count = await (prisma as any)[table].count()
        const stats: any = { table, rowCount: count }
        
        // Get additional stats for PostgreSQL
        if (process.env.DATABASE_PROVIDER === 'postgresql') {
          const pgStats = await prisma.$queryRaw`
            SELECT 
              pg_size_pretty(pg_total_relation_size(quote_ident(${table}) || 's')) AS total_size,
              pg_size_pretty(pg_relation_size(quote_ident(${table}) || 's')) AS table_size,
              pg_size_pretty(pg_indexes_size(quote_ident(${table}) || 's')) AS indexes_size
            FROM pg_tables
            WHERE tablename = ${table + 's'}
            LIMIT 1
          `
          
          if (pgStats && (pgStats as any).length > 0) {
            Object.assign(stats, (pgStats as any)[0])
          }
        }
        
        tableStats.push(stats)
      } catch (error) {
        console.error(`Error getting stats for table ${table}:`, error)
      }
    }
    
    res.json({
      success: true,
      data: {
        tables: tableStats
      }
    })
  } catch (error) {
    console.error('Error fetching table statistics:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch table statistics'
    })
  }
})

/**
 * Clear query metrics
 */
router.post('/clear-metrics', async (req: Request, res: Response) => {
  try {
    queryAnalyzer.clearMetrics()
    
    res.json({
      success: true,
      message: 'Query metrics cleared successfully'
    })
  } catch (error) {
    console.error('Error clearing query metrics:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to clear query metrics'
    })
  }
})

/**
 * Get query optimization suggestions
 */
router.post('/analyze-query', async (req: Request, res: Response) => {
  try {
    const { query, model } = req.body
    
    if (!query || !model) {
      return res.status(400).json({
        success: false,
        error: 'Query and model are required'
      })
    }
    
    // Get execution plan for PostgreSQL
    let executionPlan = null
    if (process.env.DATABASE_PROVIDER === 'postgresql') {
      try {
        const plan = await prisma.$queryRaw`EXPLAIN ANALYZE ${query}`
        executionPlan = plan
      } catch (error) {
        console.error('Error getting execution plan:', error)
      }
    }
    
    // Generate suggestions based on query pattern
    const suggestions = []
    
    // Check for missing WHERE clauses
    if (!query.toLowerCase().includes('where')) {
      suggestions.push('Consider adding WHERE clauses to filter results')
    }
    
    // Check for missing LIMIT
    if (!query.toLowerCase().includes('limit') && query.toLowerCase().includes('select')) {
      suggestions.push('Consider adding LIMIT to prevent fetching too many rows')
    }
    
    // Check for SELECT *
    if (query.includes('SELECT *') || query.includes('select *')) {
      suggestions.push('Avoid SELECT * - specify only needed columns')
    }
    
    // Model-specific suggestions
    switch (model) {
      case 'PipelineRun':
        suggestions.push('Consider filtering by status and date range')
        suggestions.push('Use cursor-based pagination for large result sets')
        break
      
      case 'ExecutionLog':
        suggestions.push('Always filter by timestamp to limit results')
        suggestions.push('Consider log archival for old entries')
        break
      
      case 'FileUpload':
        suggestions.push('Filter by user and status for better performance')
        suggestions.push('Exclude metadata fields in list queries')
        break
    }
    
    res.json({
      success: true,
      data: {
        query,
        model,
        suggestions,
        executionPlan
      }
    })
  } catch (error) {
    console.error('Error analyzing query:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to analyze query'
    })
  }
})

/**
 * Get real-time query performance metrics
 */
router.get('/realtime', async (req: Request, res: Response) => {
  try {
    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    })
    
    // Send initial data
    res.write(`data: ${JSON.stringify({
      type: 'connected',
      timestamp: new Date()
    })}\n\n`)
    
    // Listen for query events
    const handleQueryExecuted = (metrics: any) => {
      res.write(`data: ${JSON.stringify({
        type: 'query',
        metrics
      })}\n\n`)
    }
    
    const handleSlowQuery = (metrics: any) => {
      res.write(`data: ${JSON.stringify({
        type: 'slowQuery',
        metrics
      })}\n\n`)
    }
    
    const handleQueryError = (metrics: any) => {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        metrics
      })}\n\n`)
    }
    
    // Register event listeners
    queryAnalyzer.on('queryExecuted', handleQueryExecuted)
    queryAnalyzer.on('slowQuery', handleSlowQuery)
    queryAnalyzer.on('queryError', handleQueryError)
    
    // Clean up on disconnect
    req.on('close', () => {
      queryAnalyzer.off('queryExecuted', handleQueryExecuted)
      queryAnalyzer.off('slowQuery', handleSlowQuery)
      queryAnalyzer.off('queryError', handleQueryError)
    })
  } catch (error) {
    console.error('Error setting up real-time metrics:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to setup real-time metrics'
    })
  }
})

export default router