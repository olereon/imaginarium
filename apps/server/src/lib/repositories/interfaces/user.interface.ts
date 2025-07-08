/**
 * User repository interface with user-specific operations
 */

import type { User, UserRole, Session, ApiKey } from '@prisma/client';
import type {
  ISoftDeleteRepository,
  FilterOptions,
  PaginatedResult,
  TransactionContext,
  BulkOperationResult,
} from './base.interface.js';

// User-specific types
export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  avatar?: string;
  bio?: string;
  company?: string;
  location?: string;
  website?: string;
  timezone?: string;
  emailOnPipelineComplete?: boolean;
  emailOnPipelineError?: boolean;
  emailOnWeeklyReport?: boolean;
  maxPipelines?: number;
  maxExecutionsPerMonth?: number;
}

export interface UpdateUserInput {
  email?: string;
  passwordHash?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  avatar?: string;
  bio?: string;
  company?: string;
  location?: string;
  website?: string;
  timezone?: string;
  isActive?: boolean;
  emailVerified?: boolean;
  emailOnPipelineComplete?: boolean;
  emailOnPipelineError?: boolean;
  emailOnWeeklyReport?: boolean;
  maxPipelines?: number;
  maxExecutionsPerMonth?: number;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  lastLoginAt?: Date;
}

export interface UserWithRelations extends User {
  sessions?: Session[];
  apiKeys?: ApiKey[];
  pipelines?: any[];
  executions?: any[];
  files?: any[];
}

export interface UserStats {
  totalPipelines: number;
  activePipelines: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalFiles: number;
  storageUsed: number;
  lastActivity: Date | null;
  accountAge: number; // days
}

export interface UserActivity {
  userId: string;
  type:
    | 'login'
    | 'logout'
    | 'pipeline_created'
    | 'pipeline_executed'
    | 'file_uploaded'
    | 'password_changed';
  details: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  notifications?: {
    email?: boolean;
    browser?: boolean;
    mobile?: boolean;
  };
  privacy?: {
    profileVisible?: boolean;
    activityVisible?: boolean;
  };
  dashboard?: {
    defaultView?: string;
    widgets?: string[];
  };
}

// User repository interface
export interface IUserRepository
  extends ISoftDeleteRepository<User, CreateUserInput, UpdateUserInput> {
  // Authentication methods
  findByEmail(
    email: string,
    includeDeleted?: boolean,
    context?: TransactionContext
  ): Promise<User | null>;
  findByEmailActive(email: string, context?: TransactionContext): Promise<User | null>;
  findByPasswordResetToken(token: string, context?: TransactionContext): Promise<User | null>;
  findByEmailVerificationToken(token: string, context?: TransactionContext): Promise<User | null>;
  updateLastLogin(id: string, context?: TransactionContext): Promise<User>;

  // Password management
  resetPassword(
    id: string,
    token: string,
    expiresAt: Date,
    context?: TransactionContext
  ): Promise<User>;
  clearPasswordResetToken(id: string, context?: TransactionContext): Promise<User>;
  updatePassword(id: string, passwordHash: string, context?: TransactionContext): Promise<User>;

  // Email verification
  verifyEmail(id: string, context?: TransactionContext): Promise<User>;
  setEmailVerificationToken(
    id: string,
    token: string,
    expiresAt: Date,
    context?: TransactionContext
  ): Promise<User>;
  clearEmailVerificationToken(id: string, context?: TransactionContext): Promise<User>;

  // Two-factor authentication
  enableTwoFactor(id: string, secret: string, context?: TransactionContext): Promise<User>;
  disableTwoFactor(id: string, context?: TransactionContext): Promise<User>;

  // Account management
  activate(id: string, context?: TransactionContext): Promise<User>;
  deactivate(id: string, context?: TransactionContext): Promise<User>;
  changeRole(id: string, role: UserRole, context?: TransactionContext): Promise<User>;

  // Relationship queries
  findWithSessions(id: string, context?: TransactionContext): Promise<UserWithRelations | null>;
  findWithApiKeys(id: string, context?: TransactionContext): Promise<UserWithRelations | null>;
  findWithPipelines(id: string, context?: TransactionContext): Promise<UserWithRelations | null>;
  findWithExecutions(id: string, context?: TransactionContext): Promise<UserWithRelations | null>;
  findWithFiles(id: string, context?: TransactionContext): Promise<UserWithRelations | null>;

  // Role-based queries
  findByRole(role: UserRole, context?: TransactionContext): Promise<User[]>;
  findAdmins(context?: TransactionContext): Promise<User[]>;
  findActiveUsers(context?: TransactionContext): Promise<User[]>;

  // Statistics and analytics
  getUserStats(userId: string, context?: TransactionContext): Promise<UserStats>;
  getUserActivity(
    userId: string,
    options?: {
      type?: UserActivity['type'];
      from?: Date;
      to?: Date;
      limit?: number;
    },
    context?: TransactionContext
  ): Promise<UserActivity[]>;

  // Preferences
  getUserPreferences(userId: string, context?: TransactionContext): Promise<UserPreferences>;
  updateUserPreferences(
    userId: string,
    preferences: Partial<UserPreferences>,
    context?: TransactionContext
  ): Promise<UserPreferences>;

  // Search and filtering
  searchUsers(
    query: string,
    options?: {
      roles?: UserRole[];
      active?: boolean;
      verified?: boolean;
      limit?: number;
    },
    context?: TransactionContext
  ): Promise<User[]>;

  // Bulk operations
  bulkUpdateRole(
    userIds: string[],
    role: UserRole,
    context?: TransactionContext
  ): Promise<BulkOperationResult>;
  bulkActivate(userIds: string[], context?: TransactionContext): Promise<BulkOperationResult>;
  bulkDeactivate(userIds: string[], context?: TransactionContext): Promise<BulkOperationResult>;

  // Usage and limits
  checkExecutionLimit(
    userId: string,
    context?: TransactionContext
  ): Promise<{
    current: number;
    limit: number;
    canExecute: boolean;
  }>;
  checkPipelineLimit(
    userId: string,
    context?: TransactionContext
  ): Promise<{
    current: number;
    limit: number;
    canCreate: boolean;
  }>;

  // Security
  logSecurityEvent(
    userId: string,
    event: string,
    details: Record<string, any>,
    context?: TransactionContext
  ): Promise<void>;
  getSecurityEvents(
    userId: string,
    options?: {
      from?: Date;
      to?: Date;
      limit?: number;
    },
    context?: TransactionContext
  ): Promise<any[]>;

  // Cleanup and maintenance
  cleanupExpiredTokens(context?: TransactionContext): Promise<number>;
  cleanupInactiveUsers(daysInactive: number, context?: TransactionContext): Promise<number>;

  // Export and import
  exportUserData(userId: string, context?: TransactionContext): Promise<any>;
  importUserData(data: any, context?: TransactionContext): Promise<User>;

  // Audit trail
  getAuditTrail(
    userId: string,
    options?: {
      from?: Date;
      to?: Date;
      limit?: number;
    },
    context?: TransactionContext
  ): Promise<any[]>;
}
