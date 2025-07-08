/**
 * Performance testing factory for generating large datasets
 */

import { PrismaClient } from '@prisma/client'
import { BaseFactory } from './index'
import { UserFactory } from './user.factory'
import { PipelineFactory } from './pipeline.factory'
import { ExecutionFactory } from './execution.factory'
import { FileFactory } from './file.factory'
import { TemplateFactory } from './template.factory'
import type { FactoryConfig, PerformanceDatasetConfig, RelationshipConfig } from './types'

export class PerformanceFactory extends BaseFactory<any> {
  private userFactory: UserFactory
  private pipelineFactory: PipelineFactory
  private executionFactory: ExecutionFactory
  private fileFactory: FileFactory
  private templateFactory: TemplateFactory

  constructor(config: FactoryConfig) {
    super(config)
    this.userFactory = new UserFactory(config)
    this.pipelineFactory = new PipelineFactory(config)
    this.executionFactory = new ExecutionFactory(config)
    this.fileFactory = new FileFactory(config)
    this.templateFactory = new TemplateFactory(config)
  }

  build(): any {
    throw new Error('Performance factory does not support single item generation')
  }

  buildMany(): any[] {
    throw new Error('Performance factory does not support single item generation')
  }

  async create(): Promise<any> {
    throw new Error('Performance factory does not support single item generation')
  }

  async createMany(): Promise<any[]> {
    throw new Error('Performance factory does not support single item generation')
  }

  /**
   * Generate a complete performance dataset
   */
  async generatePerformanceDataset(config: PerformanceDatasetConfig, relationships: RelationshipConfig): Promise<{
    users: any[]
    pipelines: any[]
    executions: any[]
    tasks: any[]
    logs: any[]
    files: any[]
    artifacts: any[]
    templates: any[]
    sessions: any[]
    apiKeys: any[]
    stats: Record<string, any>
  }> {
    const startTime = Date.now()
    console.log('🚀 Starting performance dataset generation...')
    
    // Clear existing data if requested
    await this.clearDatabase()
    
    // Generate users first (required for all other entities)
    console.log('👥 Generating users...')
    const users = await this.generateUsers(config.users)
    
    // Generate templates (independent)
    console.log('📋 Generating templates...')
    const templates = await this.generateTemplates(config.templates)
    
    // Generate pipelines (requires users)
    console.log('🔧 Generating pipelines...')
    const pipelines = await this.generatePipelines(config.pipelines, users, relationships.userToPipelines)
    
    // Generate files (requires users)
    console.log('📁 Generating files...')
    const files = await this.generateFiles(config.files, users, relationships.userToFiles)
    
    // Generate executions (requires users and pipelines)
    console.log('⚡ Generating executions...')
    const executions = await this.generateExecutions(config.executions, users, pipelines, relationships)
    
    // Generate tasks (requires executions)
    console.log('📝 Generating tasks...')
    const tasks = await this.generateTasks(executions, relationships.executionToTasks)
    
    // Generate logs (requires executions)
    console.log('📊 Generating logs...')
    const logs = await this.generateLogs(executions, relationships.executionToLogs)
    
    // Generate artifacts (requires executions and tasks)
    console.log('🎯 Generating artifacts...')
    const artifacts = await this.generateArtifacts(executions, tasks, relationships.taskToArtifacts)
    
    // Generate sessions (requires users)
    console.log('🔐 Generating sessions...')
    const sessions = await this.generateSessions(users, relationships.userToSessions)
    
    // Generate API keys (requires users)
    console.log('🔑 Generating API keys...')
    const apiKeys = await this.generateApiKeys(users, relationships.userToApiKeys)
    
    const endTime = Date.now()
    const totalTime = endTime - startTime
    
    const stats = {
      generationTime: totalTime,
      totalRecords: users.length + pipelines.length + executions.length + tasks.length + 
                   logs.length + files.length + artifacts.length + templates.length + 
                   sessions.length + apiKeys.length,
      userStats: this.userFactory.generateUserStats(users),
      pipelineStats: this.pipelineFactory.generatePipelineStats(pipelines),
      executionStats: this.executionFactory.generateExecutionStats(executions),
      fileStats: this.fileFactory.generateFileStats(files),
      templateStats: this.templateFactory.generateTemplateStats(templates),
      performance: {
        recordsPerSecond: Math.round((users.length + pipelines.length + executions.length + tasks.length + 
                                   logs.length + files.length + artifacts.length + templates.length + 
                                   sessions.length + apiKeys.length) / (totalTime / 1000)),
        avgTimePerRecord: totalTime / (users.length + pipelines.length + executions.length + tasks.length + 
                                     logs.length + files.length + artifacts.length + templates.length + 
                                     sessions.length + apiKeys.length)
      }
    }
    
    console.log('✅ Performance dataset generation completed!')
    console.log(`📊 Generated ${stats.totalRecords} records in ${totalTime}ms`)
    console.log(`🚀 Performance: ${stats.performance.recordsPerSecond} records/second`)
    
    return {
      users,
      pipelines,
      executions,
      tasks,
      logs,
      files,
      artifacts,
      templates,
      sessions,
      apiKeys,
      stats
    }
  }

  /**
   * Generate small dataset for development
   */
  async generateDevelopmentDataset(): Promise<any> {
    const config: PerformanceDatasetConfig = {
      users: 50,
      pipelines: 200,
      executions: 1000,
      files: 500,
      artifacts: 2000,
      logs: 5000,
      sessions: 150,
      apiKeys: 100,
      templates: 20
    }
    
    const relationships: RelationshipConfig = {
      userToPipelines: 4,
      pipelineToExecutions: 5,
      executionToTasks: 8,
      executionToLogs: 15,
      taskToArtifacts: 3,
      userToSessions: 3,
      userToApiKeys: 2,
      userToFiles: 10
    }
    
    return await this.generatePerformanceDataset(config, relationships)
  }

  /**
   * Generate medium dataset for testing
   */
  async generateTestingDataset(): Promise<any> {
    const config: PerformanceDatasetConfig = {
      users: 500,
      pipelines: 2000,
      executions: 10000,
      files: 5000,
      artifacts: 20000,
      logs: 50000,
      sessions: 1500,
      apiKeys: 1000,
      templates: 100
    }
    
    const relationships: RelationshipConfig = {
      userToPipelines: 4,
      pipelineToExecutions: 5,
      executionToTasks: 8,
      executionToLogs: 15,
      taskToArtifacts: 3,
      userToSessions: 3,
      userToApiKeys: 2,
      userToFiles: 10
    }
    
    return await this.generatePerformanceDataset(config, relationships)
  }

  /**
   * Generate large dataset for performance testing
   */
  async generateLargeDataset(): Promise<any> {
    const config: PerformanceDatasetConfig = {
      users: 10000,
      pipelines: 50000,
      executions: 200000,
      files: 100000,
      artifacts: 500000,
      logs: 1000000,
      sessions: 30000,
      apiKeys: 20000,
      templates: 1000
    }
    
    const relationships: RelationshipConfig = {
      userToPipelines: 5,
      pipelineToExecutions: 4,
      executionToTasks: 10,
      executionToLogs: 20,
      taskToArtifacts: 2,
      userToSessions: 3,
      userToApiKeys: 2,
      userToFiles: 10
    }
    
    return await this.generatePerformanceDataset(config, relationships)
  }

  /**
   * Generate stress test dataset
   */
  async generateStressTestDataset(): Promise<any> {
    const config: PerformanceDatasetConfig = {
      users: 100000,
      pipelines: 500000,
      executions: 2000000,
      files: 1000000,
      artifacts: 5000000,
      logs: 10000000,
      sessions: 300000,
      apiKeys: 200000,
      templates: 10000
    }
    
    const relationships: RelationshipConfig = {
      userToPipelines: 5,
      pipelineToExecutions: 4,
      executionToTasks: 12,
      executionToLogs: 25,
      taskToArtifacts: 2,
      userToSessions: 3,
      userToApiKeys: 2,
      userToFiles: 10
    }
    
    return await this.generatePerformanceDataset(config, relationships)
  }

  // Private generation methods
  private async clearDatabase(): Promise<void> {
    console.log('🧹 Clearing existing data...')
    
    // Clear in order to respect foreign key constraints
    await this.config.prisma.executionLog.deleteMany()
    await this.config.prisma.taskExecution.deleteMany()
    await this.config.prisma.artifact.deleteMany()
    await this.config.prisma.pipelineRun.deleteMany()
    await this.config.prisma.fileReference.deleteMany()
    await this.config.prisma.thumbnail.deleteMany()
    await this.config.prisma.fileUpload.deleteMany()
    await this.config.prisma.pipelineVersion.deleteMany()
    await this.config.prisma.pipelineTemplate.deleteMany()
    await this.config.prisma.pipeline.deleteMany()
    await this.config.prisma.apiKey.deleteMany()
    await this.config.prisma.session.deleteMany()
    await this.config.prisma.user.deleteMany()
    await this.config.prisma.providerCredential.deleteMany()
    
    console.log('✅ Database cleared')
  }

  private async generateUsers(count: number): Promise<any[]> {
    return await this.userFactory.createPerformanceUsers(count)
  }

  private async generateTemplates(count: number): Promise<any[]> {
    return await this.templateFactory.createPerformanceTemplates(count)
  }

  private async generatePipelines(count: number, users: any[], pipelinesPerUser: number): Promise<any[]> {
    const pipelines: any[] = []
    
    for (const user of users) {
      const userPipelineCount = Math.min(pipelinesPerUser, Math.ceil(count / users.length))
      const userPipelines = await this.pipelineFactory.createPerformancePipelines(userPipelineCount, user.id)
      pipelines.push(...userPipelines)
      
      if (pipelines.length >= count) break
    }
    
    return pipelines.slice(0, count)
  }

  private async generateFiles(count: number, users: any[], filesPerUser: number): Promise<any[]> {
    const files: any[] = []
    
    for (const user of users) {
      const userFileCount = Math.min(filesPerUser, Math.ceil(count / users.length))
      const userFiles = await this.fileFactory.createPerformanceFiles(user.id, userFileCount)
      files.push(...userFiles)
      
      if (files.length >= count) break
    }
    
    return files.slice(0, count)
  }

  private async generateExecutions(
    count: number, 
    users: any[], 
    pipelines: any[], 
    relationships: RelationshipConfig
  ): Promise<any[]> {
    const executions: any[] = []
    
    for (const pipeline of pipelines) {
      const executionCount = Math.min(relationships.pipelineToExecutions, Math.ceil(count / pipelines.length))
      const pipelineExecutions = await this.executionFactory.createPerformanceExecutions(
        pipeline.id, 
        pipeline.userId, 
        executionCount
      )
      executions.push(...pipelineExecutions)
      
      if (executions.length >= count) break
    }
    
    return executions.slice(0, count)
  }

  private async generateTasks(executions: any[], tasksPerExecution: number): Promise<any[]> {
    const tasks: any[] = []
    
    for (const execution of executions) {
      const executionTasks = await this.executionFactory.createTaskExecutions(execution.id, tasksPerExecution)
      tasks.push(...executionTasks)
    }
    
    return tasks
  }

  private async generateLogs(executions: any[], logsPerExecution: number): Promise<any[]> {
    const logs: any[] = []
    
    for (const execution of executions) {
      const executionLogs = await this.executionFactory.createExecutionLogs(execution.id, logsPerExecution)
      logs.push(...executionLogs)
    }
    
    return logs
  }

  private async generateArtifacts(executions: any[], tasks: any[], artifactsPerTask: number): Promise<any[]> {
    const artifacts: any[] = []
    
    for (const task of tasks) {
      const taskArtifacts = await this.fileFactory.createArtifacts(task.runId, artifactsPerTask)
      artifacts.push(...taskArtifacts)
    }
    
    return artifacts
  }

  private async generateSessions(users: any[], sessionsPerUser: number): Promise<any[]> {
    const sessions: any[] = []
    
    for (const user of users) {
      for (let i = 0; i < sessionsPerUser; i++) {
        const session = await this.createSession(user.id)
        sessions.push(session)
      }
    }
    
    return sessions
  }

  private async generateApiKeys(users: any[], keysPerUser: number): Promise<any[]> {
    const apiKeys: any[] = []
    
    for (const user of users) {
      for (let i = 0; i < keysPerUser; i++) {
        const apiKey = await this.createApiKey(user.id)
        apiKeys.push(apiKey)
      }
    }
    
    return apiKeys
  }

  private async createSession(userId: string): Promise<any> {
    return await this.config.prisma.session.create({
      data: {
        userId,
        token: this.generateToken(),
        refreshToken: this.generateToken(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        userAgent: this.randomElement([
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
        ]),
        ipAddress: `192.168.1.${this.randomInt(1, 255)}`,
        deviceType: this.randomElement(['desktop', 'mobile', 'tablet']),
        browser: this.randomElement(['chrome', 'firefox', 'safari', 'edge']),
        os: this.randomElement(['windows', 'macos', 'linux', 'ios', 'android']),
        country: this.randomElement(['US', 'UK', 'CA', 'DE', 'FR', 'AU', 'JP']),
        city: this.randomElement(['New York', 'London', 'Toronto', 'Berlin', 'Paris', 'Sydney', 'Tokyo']),
        sessionType: this.randomElement(['WEB', 'MOBILE', 'API', 'CLI']),
        isRevoked: this.randomBoolean(0.05),
        lastUsedAt: this.randomDate(1)
      }
    })
  }

  private async createApiKey(userId: string): Promise<any> {
    const key = this.generateApiKey()
    
    return await this.config.prisma.apiKey.create({
      data: {
        userId,
        name: `API Key ${this.getSequence('apikey')}`,
        description: `Generated API key for user ${userId}`,
        key,
        keyPrefix: key.substring(0, 8),
        permissions: JSON.stringify(['read', 'write']),
        scopes: JSON.stringify(['pipelines', 'executions', 'files']),
        rateLimit: this.randomInt(100, 10000),
        rateLimitWindow: 'hour',
        totalRequests: this.randomInt(0, 100000),
        lastUsedAt: this.randomBoolean(0.7) ? this.randomDate(30) : null,
        lastUsedIp: `192.168.1.${this.randomInt(1, 255)}`,
        expiresAt: this.randomBoolean(0.3) ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null, // 1 year
        isActive: this.randomBoolean(0.9),
        isRevoked: this.randomBoolean(0.05)
      }
    })
  }

  private generateToken(): string {
    return Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 36).toString(36)
    ).join('')
  }

  private generateApiKey(): string {
    const prefix = 'sk-'
    const key = Array.from({ length: 48 }, () => 
      Math.floor(Math.random() * 36).toString(36)
    ).join('')
    return prefix + key
  }

  /**
   * Generate realistic time-series data
   */
  async generateTimeSeriesData(days: number = 30): Promise<any[]> {
    const data: any[] = []
    const now = new Date()
    
    for (let i = days; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      
      // Generate hourly data points
      for (let hour = 0; hour < 24; hour++) {
        const timestamp = new Date(date.getTime() + hour * 60 * 60 * 1000)
        
        data.push({
          timestamp,
          executions: this.randomInt(10, 100),
          successRate: this.randomInt(85, 98) / 100,
          avgDuration: this.randomInt(5000, 60000),
          errorRate: this.randomInt(1, 5) / 100,
          activeUsers: this.randomInt(5, 50),
          memoryUsage: this.randomInt(500, 2000),
          cpuUsage: this.randomInt(20, 80),
          diskUsage: this.randomInt(30, 70),
          networkTraffic: this.randomInt(1000, 50000)
        })
      }
    }
    
    return data
  }

  /**
   * Generate realistic user activity patterns
   */
  async generateUserActivityData(users: any[], days: number = 30): Promise<any[]> {
    const activities: any[] = []
    
    for (const user of users) {
      const userActivities = this.generateUserActivities(user.id, days)
      activities.push(...userActivities)
    }
    
    return activities
  }

  private generateUserActivities(userId: string, days: number): any[] {
    const activities: any[] = []
    const now = new Date()
    
    for (let i = days; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      
      // Skip some days to simulate realistic usage patterns
      if (this.randomBoolean(0.3)) continue
      
      // Generate activities for this day
      const activityCount = this.randomInt(1, 20)
      
      for (let j = 0; j < activityCount; j++) {
        const timestamp = new Date(date.getTime() + this.randomInt(0, 24 * 60 * 60 * 1000))
        
        activities.push({
          userId,
          timestamp,
          type: this.randomElement(['login', 'logout', 'pipeline_created', 'pipeline_executed', 'file_uploaded', 'settings_changed']),
          details: JSON.stringify({
            userAgent: 'Mozilla/5.0 (compatible; Imaginarium/1.0)',
            ip: `192.168.1.${this.randomInt(1, 255)}`,
            duration: this.randomInt(1000, 300000)
          })
        })
      }
    }
    
    return activities
  }

  /**
   * Generate benchmark data for performance testing
   */
  async generateBenchmarkData(): Promise<{
    queryBenchmarks: any[]
    insertBenchmarks: any[]
    updateBenchmarks: any[]
    deleteBenchmarks: any[]
  }> {
    const queryBenchmarks = await this.generateQueryBenchmarks()
    const insertBenchmarks = await this.generateInsertBenchmarks()
    const updateBenchmarks = await this.generateUpdateBenchmarks()
    const deleteBenchmarks = await this.generateDeleteBenchmarks()
    
    return {
      queryBenchmarks,
      insertBenchmarks,
      updateBenchmarks,
      deleteBenchmarks
    }
  }

  private async generateQueryBenchmarks(): Promise<any[]> {
    const benchmarks: any[] = []
    
    // Simple queries
    benchmarks.push({
      name: 'Simple User Query',
      query: 'SELECT * FROM users WHERE email = ?',
      params: ['test@example.com'],
      expectedRows: 1,
      category: 'simple'
    })
    
    // Complex queries
    benchmarks.push({
      name: 'Complex Pipeline Query',
      query: `
        SELECT p.*, u.name as user_name, COUNT(pr.id) as execution_count
        FROM pipelines p
        JOIN users u ON p.userId = u.id
        LEFT JOIN pipeline_runs pr ON p.id = pr.pipelineId
        WHERE p.status = 'PUBLISHED'
        GROUP BY p.id, u.name
        ORDER BY execution_count DESC
        LIMIT 10
      `,
      params: [],
      expectedRows: 10,
      category: 'complex'
    })
    
    // Aggregation queries
    benchmarks.push({
      name: 'Daily Statistics',
      query: `
        SELECT 
          DATE(pr.queuedAt) as date,
          COUNT(*) as total_executions,
          AVG(pr.duration) as avg_duration,
          SUM(pr.actualCost) as total_cost
        FROM pipeline_runs pr
        WHERE pr.queuedAt >= DATE('now', '-30 days')
        GROUP BY DATE(pr.queuedAt)
        ORDER BY date DESC
      `,
      params: [],
      expectedRows: 30,
      category: 'aggregation'
    })
    
    return benchmarks
  }

  private async generateInsertBenchmarks(): Promise<any[]> {
    return [
      {
        name: 'Single User Insert',
        operation: 'INSERT INTO users (id, email, passwordHash, name) VALUES (?, ?, ?, ?)',
        batchSize: 1,
        iterations: 1000,
        category: 'single'
      },
      {
        name: 'Batch User Insert',
        operation: 'INSERT INTO users (id, email, passwordHash, name) VALUES (?, ?, ?, ?)',
        batchSize: 100,
        iterations: 100,
        category: 'batch'
      },
      {
        name: 'Bulk Pipeline Insert',
        operation: 'INSERT INTO pipelines (id, userId, name, configuration) VALUES (?, ?, ?, ?)',
        batchSize: 500,
        iterations: 20,
        category: 'bulk'
      }
    ]
  }

  private async generateUpdateBenchmarks(): Promise<any[]> {
    return [
      {
        name: 'Single User Update',
        operation: 'UPDATE users SET lastLoginAt = ? WHERE id = ?',
        batchSize: 1,
        iterations: 1000,
        category: 'single'
      },
      {
        name: 'Batch Pipeline Update',
        operation: 'UPDATE pipelines SET updatedAt = ? WHERE userId = ?',
        batchSize: 100,
        iterations: 100,
        category: 'batch'
      },
      {
        name: 'Bulk Status Update',
        operation: 'UPDATE pipeline_runs SET status = ? WHERE status = ?',
        batchSize: 1000,
        iterations: 10,
        category: 'bulk'
      }
    ]
  }

  private async generateDeleteBenchmarks(): Promise<any[]> {
    return [
      {
        name: 'Single Record Delete',
        operation: 'DELETE FROM execution_logs WHERE id = ?',
        batchSize: 1,
        iterations: 1000,
        category: 'single'
      },
      {
        name: 'Batch Delete',
        operation: 'DELETE FROM execution_logs WHERE runId = ?',
        batchSize: 100,
        iterations: 100,
        category: 'batch'
      },
      {
        name: 'Bulk Cleanup',
        operation: 'DELETE FROM execution_logs WHERE timestamp < ?',
        batchSize: 10000,
        iterations: 5,
        category: 'bulk'
      }
    ]
  }

  /**
   * Generate realistic load test scenarios
   */
  async generateLoadTestScenarios(): Promise<any[]> {
    return [
      {
        name: 'Normal Load',
        description: 'Typical daily usage pattern',
        duration: 60, // minutes
        users: 100,
        rampUp: 10, // minutes
        requests: [
          { endpoint: '/api/pipelines', method: 'GET', weight: 30 },
          { endpoint: '/api/pipelines', method: 'POST', weight: 10 },
          { endpoint: '/api/pipelines/:id/execute', method: 'POST', weight: 20 },
          { endpoint: '/api/executions', method: 'GET', weight: 25 },
          { endpoint: '/api/files', method: 'POST', weight: 15 }
        ]
      },
      {
        name: 'High Load',
        description: 'Peak usage scenario',
        duration: 30,
        users: 500,
        rampUp: 5,
        requests: [
          { endpoint: '/api/pipelines', method: 'GET', weight: 40 },
          { endpoint: '/api/pipelines', method: 'POST', weight: 15 },
          { endpoint: '/api/pipelines/:id/execute', method: 'POST', weight: 30 },
          { endpoint: '/api/executions', method: 'GET', weight: 15 }
        ]
      },
      {
        name: 'Stress Test',
        description: 'Maximum capacity test',
        duration: 15,
        users: 1000,
        rampUp: 2,
        requests: [
          { endpoint: '/api/pipelines/:id/execute', method: 'POST', weight: 60 },
          { endpoint: '/api/executions', method: 'GET', weight: 40 }
        ]
      }
    ]
  }
}