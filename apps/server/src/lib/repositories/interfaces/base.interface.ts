/**
 * Base repository interface with generic CRUD methods, pagination, filtering, and transaction support
 */

import type { Prisma } from '@prisma/client';

// Generic pagination interface
export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
  cursor?: string;
}

// Generic pagination result
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
    nextCursor?: string;
    previousCursor?: string;
  };
}

// Generic filter interface
export interface FilterOptions<T = any> {
  where?: Partial<T> | Record<string, any>;
  search?: string;
  searchFields?: string[];
  dateRange?: {
    field: string;
    from?: Date;
    to?: Date;
  };
  orderBy?:
    | Array<{
        field: string;
        direction: 'asc' | 'desc';
      }>
    | Record<string, 'asc' | 'desc'>;
  include?: Record<string, any>;
  select?: Record<string, any>;
}

// Soft delete interface
export interface SoftDeleteOptions {
  includeDeleted?: boolean;
  deletedOnly?: boolean;
  deletedBy?: string;
}

// Bulk operation result
export interface BulkOperationResult {
  count: number;
  affectedIds?: string[];
  errors?: Array<{
    id: string;
    error: string;
  }>;
}

// Transaction context interface
export interface TransactionContext {
  tx: Prisma.TransactionClient;
}

// Base repository interface
export interface IBaseRepository<T, TCreate, TUpdate, TWhereInput = any> {
  // Basic CRUD operations
  create(data: TCreate, context?: TransactionContext): Promise<T>;
  findById(id: string, options?: FilterOptions<T>, context?: TransactionContext): Promise<T | null>;
  findMany(options?: FilterOptions<T>, context?: TransactionContext): Promise<T[]>;
  findManyPaginated(
    options?: FilterOptions<T> & PaginationOptions,
    context?: TransactionContext
  ): Promise<PaginatedResult<T>>;
  update(id: string, data: TUpdate, context?: TransactionContext): Promise<T>;
  delete(id: string, context?: TransactionContext): Promise<T>;
  count(options?: FilterOptions<T>, context?: TransactionContext): Promise<number>;

  // Advanced operations
  exists(id: string, context?: TransactionContext): Promise<boolean>;
  findFirst(options: FilterOptions<T>, context?: TransactionContext): Promise<T | null>;
  findUnique(
    where: TWhereInput,
    options?: FilterOptions<T>,
    context?: TransactionContext
  ): Promise<T | null>;
  upsert(
    params: {
      where: TWhereInput;
      create: TCreate;
      update: TUpdate;
    },
    context?: TransactionContext
  ): Promise<T>;

  // Bulk operations
  createMany(data: TCreate[], context?: TransactionContext): Promise<BulkOperationResult>;
  updateMany(
    where: Partial<T> | Record<string, any>,
    data: Partial<TUpdate>,
    context?: TransactionContext
  ): Promise<BulkOperationResult>;
  deleteMany(
    where: Partial<T> | Record<string, any>,
    context?: TransactionContext
  ): Promise<BulkOperationResult>;

  // Search and filtering
  search(
    query: string,
    options?: {
      fields?: string[];
      fuzzy?: boolean;
      limit?: number;
      filters?: FilterOptions<T>;
    },
    context?: TransactionContext
  ): Promise<T[]>;

  // Aggregation
  aggregate(
    options: {
      where?: Partial<T> | Record<string, any>;
      groupBy?: string[];
      having?: Record<string, any>;
      orderBy?: Record<string, 'asc' | 'desc'>;
      select?: Record<string, any>;
      _count?: boolean | Record<string, boolean>;
      _avg?: Record<string, boolean>;
      _sum?: Record<string, boolean>;
      _min?: Record<string, boolean>;
      _max?: Record<string, boolean>;
    },
    context?: TransactionContext
  ): Promise<any>;

  // Soft delete support (if applicable)
  softDelete?(id: string, deletedBy?: string, context?: TransactionContext): Promise<T>;
  restore?(id: string, context?: TransactionContext): Promise<T>;
  findWithDeleted?(
    options?: FilterOptions<T> & SoftDeleteOptions,
    context?: TransactionContext
  ): Promise<T[]>;

  // Validation
  validate?(data: TCreate | TUpdate): Promise<{ isValid: boolean; errors: string[] }>;

  // Caching support
  getCached?(key: string): Promise<T | null>;
  setCached?(key: string, data: T, ttl?: number): Promise<void>;
  clearCache?(pattern?: string): Promise<void>;
}

// Extended repository interface with soft delete
export interface ISoftDeleteRepository<T, TCreate, TUpdate, TWhereInput = any>
  extends IBaseRepository<T, TCreate, TUpdate, TWhereInput> {
  softDelete(id: string, deletedBy?: string, context?: TransactionContext): Promise<T>;
  restore(id: string, context?: TransactionContext): Promise<T>;
  findWithDeleted(
    options?: FilterOptions<T> & SoftDeleteOptions,
    context?: TransactionContext
  ): Promise<T[]>;
  findActive(options?: FilterOptions<T>, context?: TransactionContext): Promise<T[]>;
  findDeleted(options?: FilterOptions<T>, context?: TransactionContext): Promise<T[]>;
  permanentDelete(id: string, context?: TransactionContext): Promise<T>;
}

// Repository factory interface
export interface IRepositoryFactory {
  withTransaction<T>(operation: (context: TransactionContext) => Promise<T>): Promise<T>;

  // Get repository instances
  getUserRepository(): IUserRepository;
  getPipelineRepository(): IPipelineRepository;
  getExecutionRepository(): IExecutionRepository;
  getFileRepository(): IFileRepository;
}

// Import repository interfaces that will be defined
export interface IUserRepository extends ISoftDeleteRepository<any, any, any> {}
export interface IPipelineRepository extends ISoftDeleteRepository<any, any, any> {}
export interface IExecutionRepository extends IBaseRepository<any, any, any> {}
export interface IFileRepository extends IBaseRepository<any, any, any> {}
