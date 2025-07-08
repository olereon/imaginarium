/**
 * Query Analysis and Performance Monitoring System
 * Tracks query performance, identifies slow queries, and provides optimization suggestions
 */

import { PrismaClient } from '@prisma/client';
import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';

export interface QueryMetrics {
  id: string;
  query: string;
  model: string;
  operation: string;
  duration: number;
  timestamp: Date;
  params?: any;
  result?: {
    count?: number;
    affectedRows?: number;
  };
  error?: string;
  stackTrace?: string;
  userId?: string;
  sessionId?: string;
}

export interface QueryAnalysis {
  query: string;
  model: string;
  operation: string;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  totalExecutions: number;
  errorRate: number;
  lastExecuted: Date;
  suggestions: string[];
  indexRecommendations: string[];
  isSlowQuery: boolean;
}

export interface QueryPattern {
  pattern: string;
  frequency: number;
  avgDuration: number;
  operations: string[];
  models: string[];
  suggestions: string[];
}

export class QueryAnalyzer extends EventEmitter {
  private metrics: Map<string, QueryMetrics[]> = new Map();
  private patterns: Map<string, QueryPattern> = new Map();
  private slowQueryThreshold: number = 1000; // 1 second
  private analysisInterval: ReturnType<typeof setInterval>;
  private isEnabled: boolean = true;

  constructor(
    private _prisma: PrismaClient,
    private options: {
      slowQueryThreshold?: number;
      enableLogging?: boolean;
      enableAnalysis?: boolean;
      analysisIntervalMs?: number;
    } = {}
  ) {
    super();

    this.slowQueryThreshold = options.slowQueryThreshold || 1000;
    this.isEnabled = options.enableAnalysis !== false;

    if (this.isEnabled) {
      this.setupQueryMiddleware();
      this.startAnalysis(options.analysisIntervalMs || 60000); // Analyze every minute
    }
  }

  /**
   * Setup Prisma middleware to capture query metrics
   */
  private setupQueryMiddleware(): void {
    this._prisma.$use(async (params, next) => {
      const start = performance.now();
      const queryId = this.generateQueryId();

      try {
        const result = await next(params);
        const duration = performance.now() - start;

        await this.recordQueryMetrics({
          id: queryId,
          query: this.formatQuery(params),
          model: params.model || 'unknown',
          operation: params.action,
          duration,
          timestamp: new Date(),
          params: this.sanitizeParams(params),
          result: this.extractResultMetrics(result),
        });

        return result;
      } catch (error) {
        const duration = performance.now() - start;

        await this.recordQueryMetrics({
          id: queryId,
          query: this.formatQuery(params),
          model: params.model || 'unknown',
          operation: params.action,
          duration,
          timestamp: new Date(),
          params: this.sanitizeParams(params),
          error: error.message,
          stackTrace: error.stack,
        });

        throw error;
      }
    });
  }

  /**
   * Record query metrics
   */
  private async recordQueryMetrics(metrics: QueryMetrics): Promise<void> {
    const queryHash = this.hashQuery(metrics.query);

    if (!this.metrics.has(queryHash)) {
      this.metrics.set(queryHash, []);
    }

    this.metrics.get(queryHash)!.push(metrics);

    // Keep only last 1000 executions per query
    const queryMetrics = this.metrics.get(queryHash)!;
    if (queryMetrics.length > 1000) {
      queryMetrics.splice(0, queryMetrics.length - 1000);
    }

    // Emit events for monitoring
    if (metrics.duration > this.slowQueryThreshold) {
      this.emit('slowQuery', metrics);
    }

    if (metrics.error) {
      this.emit('queryError', metrics);
    }

    this.emit('queryExecuted', metrics);
  }

  /**
   * Analyze query patterns and performance
   */
  private async analyzeQueries(): Promise<void> {
    const analyses = new Map<string, QueryAnalysis>();

    for (const [queryHash, queryMetrics] of this.metrics) {
      if (queryMetrics.length === 0) continue;

      const analysis = this.analyzeQueryMetrics(queryMetrics);
      analyses.set(queryHash, analysis);

      // Emit analysis results
      if (analysis.isSlowQuery) {
        this.emit('slowQueryAnalysis', analysis);
      }
    }

    // Analyze patterns
    this.analyzeQueryPatterns();

    // Emit overall analysis
    this.emit('analysisComplete', {
      totalQueries: analyses.size,
      slowQueries: Array.from(analyses.values()).filter(a => a.isSlowQuery).length,
      patterns: Array.from(this.patterns.values()),
    });
  }

  /**
   * Analyze metrics for a specific query
   */
  private analyzeQueryMetrics(metrics: QueryMetrics[]): QueryAnalysis {
    const durations = metrics.map(m => m.duration);
    const errors = metrics.filter(m => m.error).length;
    const latest = metrics[metrics.length - 1];

    const analysis: QueryAnalysis = {
      query: latest.query,
      model: latest.model,
      operation: latest.operation,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      totalExecutions: metrics.length,
      errorRate: errors / metrics.length,
      lastExecuted: latest.timestamp,
      suggestions: [],
      indexRecommendations: [],
      isSlowQuery: durations.some(d => d > this.slowQueryThreshold),
    };

    // Generate suggestions
    analysis.suggestions = this.generateSuggestions(analysis, metrics);
    analysis.indexRecommendations = this.generateIndexRecommendations(analysis, metrics);

    return analysis;
  }

  /**
   * Analyze query patterns
   */
  private analyzeQueryPatterns(): void {
    const patterns = new Map<
      string,
      {
        frequency: number;
        durations: number[];
        operations: Set<string>;
        models: Set<string>;
      }
    >();

    for (const [, queryMetrics] of this.metrics) {
      for (const metric of queryMetrics) {
        const pattern = this.extractQueryPattern(metric.query);

        if (!patterns.has(pattern)) {
          patterns.set(pattern, {
            frequency: 0,
            durations: [],
            operations: new Set(),
            models: new Set(),
          });
        }

        const patternData = patterns.get(pattern)!;
        patternData.frequency++;
        patternData.durations.push(metric.duration);
        patternData.operations.add(metric.operation);
        patternData.models.add(metric.model);
      }
    }

    // Convert to QueryPattern objects
    this.patterns.clear();
    for (const [pattern, data] of patterns) {
      this.patterns.set(pattern, {
        pattern,
        frequency: data.frequency,
        avgDuration: data.durations.reduce((a, b) => a + b, 0) / data.durations.length,
        operations: Array.from(data.operations),
        models: Array.from(data.models),
        suggestions: this.generatePatternSuggestions(pattern, data),
      });
    }
  }

  /**
   * Generate optimization suggestions
   */
  private generateSuggestions(analysis: QueryAnalysis, _metrics: QueryMetrics[]): string[] {
    const suggestions: string[] = [];

    // Slow query suggestions
    if (analysis.avgDuration > this.slowQueryThreshold) {
      suggestions.push('Consider adding appropriate indexes for this query');
      suggestions.push('Review query structure and consider optimization');
    }

    // High error rate suggestions
    if (analysis.errorRate > 0.1) {
      suggestions.push('High error rate detected - review query parameters and constraints');
    }

    // Frequent execution suggestions
    if (analysis.totalExecutions > 1000) {
      suggestions.push('Frequently executed query - consider caching results');
      suggestions.push('Review if this query can be optimized or batched');
    }

    // Model-specific suggestions
    if (analysis.model === 'PipelineRun') {
      suggestions.push('Consider using cursor-based pagination for large result sets');
      suggestions.push('Add status and date filters to reduce result set size');
    }

    if (analysis.model === 'ExecutionLog') {
      suggestions.push('Consider log archival strategy for better performance');
      suggestions.push('Use time-based partitioning for large log tables');
    }

    // Operation-specific suggestions
    if (analysis.operation === 'findMany') {
      suggestions.push('Consider using pagination (take/skip) for large result sets');
      suggestions.push('Add appropriate where clauses to filter results');
    }

    if (analysis.operation === 'count') {
      suggestions.push('Consider using approximate counts for large tables');
      suggestions.push("Cache count results if they don't need to be real-time");
    }

    return suggestions;
  }

  /**
   * Generate index recommendations
   */
  private generateIndexRecommendations(analysis: QueryAnalysis, metrics: QueryMetrics[]): string[] {
    const recommendations: string[] = [];

    // Extract WHERE clauses and suggest indexes
    const whereFields = this.extractWhereFields(metrics);

    if (whereFields.length > 0) {
      recommendations.push(`Consider adding index on: ${whereFields.join(', ')}`);
    }

    // Model-specific index recommendations
    switch (analysis.model) {
      case 'PipelineRun':
        recommendations.push('Ensure indexes on: [pipelineId, status, queuedAt]');
        recommendations.push('Consider composite index: [userId, status, queuedAt]');
        break;

      case 'TaskExecution':
        recommendations.push('Ensure indexes on: [runId, status, executionOrder]');
        recommendations.push('Consider composite index: [runId, nodeId, status]');
        break;

      case 'ExecutionLog':
        recommendations.push('Ensure indexes on: [runId, timestamp, level]');
        recommendations.push('Consider composite index: [runId, taskId, timestamp]');
        break;

      case 'FileUpload':
        recommendations.push('Ensure indexes on: [userId, status, uploadedAt]');
        recommendations.push('Consider composite index: [userId, mimeType, status]');
        break;
    }

    return recommendations;
  }

  /**
   * Generate pattern-based suggestions
   */
  private generatePatternSuggestions(pattern: string, data: any): string[] {
    const suggestions: string[] = [];

    if (data.frequency > 100) {
      suggestions.push('High frequency pattern - consider caching');
    }

    if (data.durations.some((d: number) => d > this.slowQueryThreshold)) {
      suggestions.push('Slow pattern detected - review query structure');
    }

    if (data.operations.has('findMany') && data.operations.has('count')) {
      suggestions.push('Consider combining count and findMany operations');
    }

    return suggestions;
  }

  /**
   * Start periodic analysis
   */
  private startAnalysis(intervalMs: number): void {
    this.analysisInterval = setInterval(() => {
      this.analyzeQueries();
    }, intervalMs);
  }

  /**
   * Stop periodic analysis
   */
  public stopAnalysis(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
  }

  /**
   * Get query analysis results
   */
  public getQueryAnalysis(): QueryAnalysis[] {
    const analyses: QueryAnalysis[] = [];

    for (const [, queryMetrics] of this.metrics) {
      if (queryMetrics.length > 0) {
        analyses.push(this.analyzeQueryMetrics(queryMetrics));
      }
    }

    return analyses.sort((a, b) => b.avgDuration - a.avgDuration);
  }

  /**
   * Get query patterns
   */
  public getQueryPatterns(): QueryPattern[] {
    return Array.from(this.patterns.values()).sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Get slow queries
   */
  public getSlowQueries(): QueryAnalysis[] {
    return this.getQueryAnalysis().filter(a => a.isSlowQuery);
  }

  /**
   * Get query statistics
   */
  public getStatistics(): {
    totalQueries: number;
    uniqueQueries: number;
    slowQueries: number;
    avgDuration: number;
    errorRate: number;
    topModels: { model: string; count: number }[];
    topOperations: { operation: string; count: number }[];
  } {
    const allMetrics = Array.from(this.metrics.values()).flat();
    const analyses = this.getQueryAnalysis();

    const modelCounts = new Map<string, number>();
    const operationCounts = new Map<string, number>();

    for (const metric of allMetrics) {
      modelCounts.set(metric.model, (modelCounts.get(metric.model) || 0) + 1);
      operationCounts.set(metric.operation, (operationCounts.get(metric.operation) || 0) + 1);
    }

    return {
      totalQueries: allMetrics.length,
      uniqueQueries: this.metrics.size,
      slowQueries: analyses.filter(a => a.isSlowQuery).length,
      avgDuration: allMetrics.reduce((sum, m) => sum + m.duration, 0) / allMetrics.length,
      errorRate: allMetrics.filter(m => m.error).length / allMetrics.length,
      topModels: Array.from(modelCounts.entries())
        .map(([model, count]) => ({ model, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      topOperations: Array.from(operationCounts.entries())
        .map(([operation, count]) => ({ operation, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    };
  }

  /**
   * Clear metrics
   */
  public clearMetrics(): void {
    this.metrics.clear();
    this.patterns.clear();
  }

  /**
   * Enable/disable query analysis
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  // Helper methods
  private generateQueryId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private formatQuery(params: any): string {
    return `${params.model || 'unknown'}.${params.action}(${JSON.stringify(params.args || {})})`;
  }

  private sanitizeParams(params: any): any {
    // Remove sensitive data from params
    const sanitized = { ...params };

    if (sanitized.args && sanitized.args.data) {
      const { password, passwordHash, token, secret, ...safeData } = sanitized.args.data;
      // Remove sensitive fields
      void password;
      void passwordHash;
      void token;
      void secret;
      sanitized.args.data = safeData;
    }

    return sanitized;
  }

  private extractResultMetrics(result: any): any {
    if (Array.isArray(result)) {
      return { count: result.length };
    }

    if (result && typeof result === 'object' && result.count !== undefined) {
      return { count: result.count };
    }

    return {};
  }

  private hashQuery(query: string): string {
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private extractQueryPattern(query: string): string {
    // Extract pattern by removing specific values
    return query
      .replace(/"[^"]*"/g, '"<string>"')
      .replace(/\d+/g, '<number>')
      .replace(/\[.*?\]/g, '<array>')
      .replace(/\{.*?\}/g, '<object>');
  }

  private extractWhereFields(metrics: QueryMetrics[]): string[] {
    const fields = new Set<string>();

    for (const metric of metrics) {
      try {
        const parsed = JSON.parse(metric.query.split('(')[1].split(')')[0]);
        if (parsed.where) {
          this.extractFieldsFromWhere(parsed.where, fields);
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    return Array.from(fields);
  }

  private extractFieldsFromWhere(whereClause: any, fields: Set<string>): void {
    if (!whereClause || typeof whereClause !== 'object') return;

    for (const [key, value] of Object.entries(whereClause)) {
      if (key === 'AND' || key === 'OR') {
        if (Array.isArray(value)) {
          value.forEach(clause => this.extractFieldsFromWhere(clause, fields));
        }
      } else if (typeof value === 'object' && value !== null) {
        fields.add(key);
        this.extractFieldsFromWhere(value, fields);
      } else {
        fields.add(key);
      }
    }
  }
}

// Export singleton instance
export const queryAnalyzer = new QueryAnalyzer(new PrismaClient(), {
  enableLogging: process.env.NODE_ENV === 'development',
  enableAnalysis: process.env.NODE_ENV !== 'test',
  slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000'),
});
