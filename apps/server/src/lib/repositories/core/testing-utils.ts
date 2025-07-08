/**
 * Repository testing utilities for unit and integration tests
 */

import { jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { DatabaseManager } from './database-manager.js';
import { CacheManager } from './cache-manager.js';
import { BatchOperationManager } from './batch-operations.js';
import type {
  IBaseRepository,
  TransactionContext,
  BulkOperationResult,
  PaginatedResult,
  FilterOptions,
} from '../interfaces/index.js';

/**
 * Mock database manager for testing
 */
export class MockDatabaseManager extends DatabaseManager {
  private mockClient: any;
  private mockTransactionFn: jest.Mock;

  constructor() {
    super();
    this.mockClient = this.createMockClient();
    this.mockTransactionFn = jest.fn();
  }

  private createMockClient(): any {
    return {
      $transaction: this.mockTransactionFn,
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
      $disconnect: jest.fn(),
      user: this.createMockModel(),
      pipeline: this.createMockModel(),
      pipelineRun: this.createMockModel(),
      taskExecution: this.createMockModel(),
      executionLog: this.createMockModel(),
      fileUpload: this.createMockModel(),
      artifact: this.createMockModel(),
    };
  }

  private createMockModel(): any {
    return {
      create: jest.fn(),
      createMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    };
  }

  getClient(): any {
    return this.mockClient;
  }

  getMockClient(): any {
    return this.mockClient;
  }

  getMockTransactionFn(): jest.Mock {
    return this.mockTransactionFn;
  }

  async executeTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return await fn(this.mockClient);
  }

  setupMockTransactionSuccess(): void {
    this.mockTransactionFn.mockImplementation(async (fn: any) => {
      return await fn(this.mockClient);
    });
  }

  setupMockTransactionFailure(error: Error): void {
    this.mockTransactionFn.mockRejectedValue(error);
  }

  reset(): void {
    jest.clearAllMocks();
  }
}

/**
 * Mock cache manager for testing
 */
export class MockCacheManager extends CacheManager {
  private cache: Map<string, any> = new Map();
  private getMock: jest.Mock;
  private setMock: jest.Mock;
  private deleteMock: jest.Mock;

  constructor() {
    super();
    this.getMock = jest.fn();
    this.setMock = jest.fn();
    this.deleteMock = jest.fn();
  }

  async get<T>(key: string): Promise<T | null> {
    this.getMock(key);
    return this.cache.get(key) || null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.setMock(key, value, ttl);
    this.cache.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    this.deleteMock(key);
    return this.cache.delete(key);
  }

  async deletePattern(pattern: string): Promise<number> {
    const keys = Array.from(this.cache.keys()).filter(key =>
      key.includes(pattern.replace('*', ''))
    );

    keys.forEach(key => this.cache.delete(key));
    return keys.length;
  }

  getMockGet(): jest.Mock {
    return this.getMock;
  }

  getMockSet(): jest.Mock {
    return this.setMock;
  }

  getMockDelete(): jest.Mock {
    return this.deleteMock;
  }

  reset(): void {
    this.cache.clear();
    jest.clearAllMocks();
  }

  seed(data: Record<string, any>): void {
    Object.entries(data).forEach(([key, value]) => {
      this.cache.set(key, value);
    });
  }
}

/**
 * Mock batch operation manager for testing
 */
export class MockBatchOperationManager extends BatchOperationManager {
  private executeBatchMock: jest.Mock;

  constructor() {
    super();
    this.executeBatchMock = jest.fn();
  }

  async executeBatch<T, R>(
    operation: any,
    config: any = {}
  ): Promise<BulkOperationResult & { results: Array<R | null> }> {
    return this.executeBatchMock(operation, config);
  }

  getMockExecuteBatch(): jest.Mock {
    return this.executeBatchMock;
  }

  setupMockBatchSuccess<R>(results: Array<R | null>): void {
    this.executeBatchMock.mockResolvedValue({
      count: results.filter(r => r !== null).length,
      affectedIds: [],
      errors: [],
      results,
      total: results.length,
      successful: results.filter(r => r !== null).length,
      failed: results.filter(r => r === null).length,
    });
  }

  setupMockBatchFailure(error: Error): void {
    this.executeBatchMock.mockRejectedValue(error);
  }

  reset(): void {
    jest.clearAllMocks();
  }
}

/**
 * Base repository test helper
 */
export class RepositoryTestHelper<T, TCreate, TUpdate> {
  private mockDb: MockDatabaseManager;
  private mockCache: MockCacheManager;
  private mockBatch: MockBatchOperationManager;
  private repository: IBaseRepository<T, TCreate, TUpdate>;

  constructor(repository: IBaseRepository<T, TCreate, TUpdate>) {
    this.repository = repository;
    this.mockDb = new MockDatabaseManager();
    this.mockCache = new MockCacheManager();
    this.mockBatch = new MockBatchOperationManager();
  }

  /**
   * Setup mocks for the repository
   */
  setupMocks(): void {
    // Replace instances in repository with mocks
    if ('dbManager' in this.repository) {
      (this.repository as any).dbManager = this.mockDb;
    }
    if ('cacheManager' in this.repository) {
      (this.repository as any).cacheManager = this.mockCache;
    }
    if ('batchManager' in this.repository) {
      (this.repository as any).batchManager = this.mockBatch;
    }
  }

  /**
   * Get mock database manager
   */
  getMockDb(): MockDatabaseManager {
    return this.mockDb;
  }

  /**
   * Get mock cache manager
   */
  getMockCache(): MockCacheManager {
    return this.mockCache;
  }

  /**
   * Get mock batch manager
   */
  getMockBatch(): MockBatchOperationManager {
    return this.mockBatch;
  }

  /**
   * Setup mock data for model operations
   */
  setupMockData(
    modelName: string,
    data: {
      create?: any;
      findUnique?: any;
      findFirst?: any;
      findMany?: any[];
      update?: any;
      delete?: any;
      count?: number;
      aggregate?: any;
    }
  ): void {
    const model = this.mockDb.getMockClient()[modelName];

    if (data.create) {
      model.create.mockResolvedValue(data.create);
    }
    if (data.findUnique) {
      model.findUnique.mockResolvedValue(data.findUnique);
    }
    if (data.findFirst) {
      model.findFirst.mockResolvedValue(data.findFirst);
    }
    if (data.findMany) {
      model.findMany.mockResolvedValue(data.findMany);
    }
    if (data.update) {
      model.update.mockResolvedValue(data.update);
    }
    if (data.delete) {
      model.delete.mockResolvedValue(data.delete);
    }
    if (data.count !== undefined) {
      model.count.mockResolvedValue(data.count);
    }
    if (data.aggregate) {
      model.aggregate.mockResolvedValue(data.aggregate);
    }
  }

  /**
   * Verify model method was called with specific arguments
   */
  verifyModelCall(modelName: string, method: string, expectedArgs: any[]): void {
    const model = this.mockDb.getMockClient()[modelName];
    expect(model[method]).toHaveBeenCalledWith(...expectedArgs);
  }

  /**
   * Verify cache operations
   */
  verifyCacheGet(key: string): void {
    expect(this.mockCache.getMockGet()).toHaveBeenCalledWith(key);
  }

  verifyCacheSet(key: string, value: any, ttl?: number): void {
    expect(this.mockCache.getMockSet()).toHaveBeenCalledWith(key, value, ttl);
  }

  verifyCacheDelete(key: string): void {
    expect(this.mockCache.getMockDelete()).toHaveBeenCalledWith(key);
  }

  /**
   * Setup cache with initial data
   */
  seedCache(data: Record<string, any>): void {
    this.mockCache.seed(data);
  }

  /**
   * Reset all mocks
   */
  reset(): void {
    this.mockDb.reset();
    this.mockCache.reset();
    this.mockBatch.reset();
  }

  /**
   * Create test data factory
   */
  createDataFactory(): TestDataFactory<T, TCreate, TUpdate> {
    return new TestDataFactory<T, TCreate, TUpdate>();
  }

  /**
   * Test repository CRUD operations
   */
  async testCrudOperations(
    createData: TCreate,
    updateData: TUpdate,
    expectedResult: T
  ): Promise<void> {
    const modelName = this.getModelName();

    // Test create
    this.setupMockData(modelName, { create: expectedResult });
    const created = await this.repository.create(createData);
    expect(created).toEqual(expectedResult);
    this.verifyModelCall(modelName, 'create', [{ data: createData }]);

    // Test findById
    this.setupMockData(modelName, { findUnique: expectedResult });
    const found = await this.repository.findById('test-id');
    expect(found).toEqual(expectedResult);
    this.verifyModelCall(modelName, 'findUnique', [{ where: { id: 'test-id' } }]);

    // Test update
    this.setupMockData(modelName, { update: { ...expectedResult, ...updateData } });
    const updated = await this.repository.update('test-id', updateData);
    expect(updated).toEqual({ ...expectedResult, ...updateData });
    this.verifyModelCall(modelName, 'update', [{ where: { id: 'test-id' }, data: updateData }]);

    // Test delete
    this.setupMockData(modelName, { delete: expectedResult });
    const deleted = await this.repository.delete('test-id');
    expect(deleted).toEqual(expectedResult);
    this.verifyModelCall(modelName, 'delete', [{ where: { id: 'test-id' } }]);
  }

  /**
   * Test pagination
   */
  async testPagination(
    mockData: T[],
    totalCount: number,
    options: FilterOptions<T> & { page?: number; limit?: number }
  ): Promise<void> {
    const modelName = this.getModelName();

    this.setupMockData(modelName, {
      findMany: mockData,
      count: totalCount,
    });

    const result = await this.repository.findManyPaginated(options);

    expect(result.data).toEqual(mockData);
    expect(result.pagination.total).toBe(totalCount);
    expect(result.pagination.page).toBe(options.page || 1);
    expect(result.pagination.limit).toBe(options.limit || 10);
  }

  /**
   * Test error handling
   */
  async testErrorHandling(operation: () => Promise<any>, expectedError: Error): Promise<void> {
    const modelName = this.getModelName();
    const model = this.mockDb.getMockClient()[modelName];

    // Setup all model methods to throw error
    Object.keys(model).forEach(method => {
      model[method].mockRejectedValue(expectedError);
    });

    await expect(operation()).rejects.toThrow(expectedError);
  }

  /**
   * Get model name from repository
   */
  private getModelName(): string {
    if ('config' in this.repository) {
      return (this.repository as any).config.modelName;
    }
    return 'unknown';
  }
}

/**
 * Test data factory for generating test data
 */
export class TestDataFactory<T, TCreate, TUpdate> {
  private sequences: Map<string, number> = new Map();

  /**
   * Generate sequential ID
   */
  generateId(prefix = 'test'): string {
    const current = this.sequences.get(prefix) || 0;
    this.sequences.set(prefix, current + 1);
    return `${prefix}-${current + 1}`;
  }

  /**
   * Generate random string
   */
  generateString(length = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate random email
   */
  generateEmail(domain = 'test.com'): string {
    return `${this.generateString(8)}@${domain}`;
  }

  /**
   * Generate random date
   */
  generateDate(daysAgo = 0): Date {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date;
  }

  /**
   * Generate random number
   */
  generateNumber(min = 1, max = 100): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Generate random boolean
   */
  generateBoolean(): boolean {
    return Math.random() > 0.5;
  }

  /**
   * Create array of test data
   */
  createArray<TItem>(factory: () => TItem, count: number): TItem[] {
    return Array.from({ length: count }, factory);
  }

  /**
   * Reset sequences
   */
  reset(): void {
    this.sequences.clear();
  }
}

/**
 * Repository test suite generator
 */
export function createRepositoryTestSuite<T, TCreate, TUpdate>(
  repositoryFactory: () => IBaseRepository<T, TCreate, TUpdate>,
  dataFactory: {
    createValid: () => TCreate;
    createInvalid: () => TCreate;
    updateValid: () => TUpdate;
    expectedResult: () => T;
  }
) {
  return {
    'Repository CRUD Operations': () => {
      let helper: RepositoryTestHelper<T, TCreate, TUpdate>;
      let repository: IBaseRepository<T, TCreate, TUpdate>;

      beforeEach(() => {
        repository = repositoryFactory();
        helper = new RepositoryTestHelper(repository);
        helper.setupMocks();
      });

      afterEach(() => {
        helper.reset();
      });

      test('should create record', async () => {
        const createData = dataFactory.createValid();
        const expected = dataFactory.expectedResult();

        await helper.testCrudOperations(createData, dataFactory.updateValid(), expected);
      });

      test('should handle validation errors', async () => {
        const invalidData = dataFactory.createInvalid();

        await helper.testErrorHandling(
          () => repository.create(invalidData),
          new Error('Validation failed')
        );
      });

      test('should handle not found errors', async () => {
        helper.setupMockData('user', { findUnique: null });

        const result = await repository.findById('nonexistent-id');
        expect(result).toBeNull();
      });

      test('should support pagination', async () => {
        const mockData = helper.createDataFactory().createArray(dataFactory.expectedResult, 5);

        await helper.testPagination(mockData, 50, {
          page: 1,
          limit: 10,
        });
      });
    },
  };
}

/**
 * Integration test helper
 */
export class IntegrationTestHelper {
  private testDb: PrismaClient;
  private originalDb: PrismaClient;

  constructor() {
    // In real implementation, this would connect to a test database
    this.testDb = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL || 'file:./test.db',
        },
      },
    });
  }

  /**
   * Setup test database
   */
  async setupTestDatabase(): Promise<void> {
    // Clear all tables
    await this.testDb.$executeRaw`DELETE FROM users`;
    await this.testDb.$executeRaw`DELETE FROM pipelines`;
    await this.testDb.$executeRaw`DELETE FROM pipeline_runs`;
    // ... other tables
  }

  /**
   * Seed test data
   */
  async seedTestData(data: any): Promise<void> {
    // Insert test data
    for (const [table, records] of Object.entries(data)) {
      for (const record of records as any[]) {
        await (this.testDb as any)[table].create({ data: record });
      }
    }
  }

  /**
   * Cleanup test database
   */
  async cleanup(): Promise<void> {
    await this.testDb.$disconnect();
  }

  /**
   * Get test database client
   */
  getTestClient(): PrismaClient {
    return this.testDb;
  }
}

/**
 * Performance test utilities
 */
export class PerformanceTestHelper {
  /**
   * Measure operation performance
   */
  async measurePerformance<T>(
    operation: () => Promise<T>,
    iterations = 1
  ): Promise<{
    result: T;
    averageTime: number;
    minTime: number;
    maxTime: number;
    totalTime: number;
  }> {
    const times: number[] = [];
    let result: T;

    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      result = await operation();
      const end = process.hrtime.bigint();

      times.push(Number(end - start) / 1000000); // Convert to milliseconds
    }

    return {
      result: result!,
      averageTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      totalTime: times.reduce((a, b) => a + b, 0),
    };
  }

  /**
   * Test concurrent operations
   */
  async testConcurrency<T>(
    operation: () => Promise<T>,
    concurrency: number
  ): Promise<{
    results: T[];
    averageTime: number;
    errors: Error[];
  }> {
    const promises = Array.from({ length: concurrency }, () => {
      const start = process.hrtime.bigint();
      return operation().then(result => ({
        result,
        time: Number(process.hrtime.bigint() - start) / 1000000,
      }));
    });

    const results = await Promise.allSettled(promises);

    const successful = results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<any>).value);

    const errors = results
      .filter(r => r.status === 'rejected')
      .map(r => (r as PromiseRejectedResult).reason);

    return {
      results: successful.map(s => s.result),
      averageTime: successful.reduce((sum, s) => sum + s.time, 0) / successful.length,
      errors,
    };
  }
}

// Export test utilities
export const testUtils = {
  createRepositoryTestSuite,
  RepositoryTestHelper,
  TestDataFactory,
  IntegrationTestHelper,
  PerformanceTestHelper,
  MockDatabaseManager,
  MockCacheManager,
  MockBatchOperationManager,
};
