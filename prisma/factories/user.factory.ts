/**
 * User factory for generating test users
 */

import { User, UserRole } from '@prisma/client';
import {
  BaseFactory,
  generateId,
  generateEmail,
  generateName,
  generateCompanyName,
  generateLocation,
  generateWebsite,
  generateBio,
  generateTimezone,
} from './index';
import type { UserCreateInput, FactoryConfig } from './types';

export class UserFactory extends BaseFactory<User> {
  constructor(config: FactoryConfig) {
    super(config);
  }

  build(overrides: Partial<UserCreateInput> = {}): User {
    const sequence = this.getSequence('user');
    const name = generateName();
    const company = generateCompanyName();
    const location = generateLocation();
    const timezone = generateTimezone();

    const defaultData: UserCreateInput = {
      email: overrides.email || generateEmail('imaginarium.dev'),
      passwordHash: '$2b$12$LQv3c1yqBwlI4QlkUjJj.eqY8mNnWJJcZTrQQYkN0qKKBvNKpGfOG', // 'password123'
      name: overrides.name || name.fullName,
      firstName: overrides.firstName || name.firstName,
      lastName: overrides.lastName || name.lastName,
      avatar: overrides.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sequence}`,
      bio: overrides.bio || generateBio(name.fullName, company),
      company: overrides.company || company,
      location: overrides.location || location,
      website: overrides.website || generateWebsite(company),
      timezone: overrides.timezone || timezone,
      role: overrides.role || this.randomElement<UserRole>(['ADMIN', 'EDITOR', 'VIEWER']),
      isActive: overrides.isActive !== undefined ? overrides.isActive : this.randomBoolean(0.9),
      emailVerified:
        overrides.emailVerified !== undefined ? overrides.emailVerified : this.randomBoolean(0.8),
      emailOnPipelineComplete:
        overrides.emailOnPipelineComplete !== undefined
          ? overrides.emailOnPipelineComplete
          : this.randomBoolean(0.7),
      emailOnPipelineError:
        overrides.emailOnPipelineError !== undefined
          ? overrides.emailOnPipelineError
          : this.randomBoolean(0.9),
      emailOnWeeklyReport:
        overrides.emailOnWeeklyReport !== undefined
          ? overrides.emailOnWeeklyReport
          : this.randomBoolean(0.3),
      maxPipelines: overrides.maxPipelines || this.randomInt(5, 100),
      maxExecutionsPerMonth: overrides.maxExecutionsPerMonth || this.randomInt(50, 1000),
      twoFactorEnabled:
        overrides.twoFactorEnabled !== undefined
          ? overrides.twoFactorEnabled
          : this.randomBoolean(0.2),
      lastLoginAt: overrides.lastLoginAt || (this.randomBoolean(0.8) ? this.randomDate(7) : null),
    };

    const user = {
      id: generateId('user'),
      ...defaultData,
      ...overrides,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      deletedBy: null,
      passwordResetToken: null,
      passwordResetExpires: null,
      emailVerificationToken: null,
      emailVerificationExpires: null,
      twoFactorSecret: null,
    } as User;

    return user;
  }

  buildMany(count: number, overrides: Partial<UserCreateInput> = {}): User[] {
    return Array.from({ length: count }, () => this.build(overrides));
  }

  async create(overrides: Partial<UserCreateInput> = {}): Promise<User> {
    const userData = this.build(overrides);

    // Hash password if provided
    if (overrides.passwordHash) {
      userData.passwordHash = await this.hashPassword(overrides.passwordHash);
    }

    return await this.config.prisma.user.create({
      data: userData,
    });
  }

  async createMany(count: number, overrides: Partial<UserCreateInput> = {}): Promise<User[]> {
    const users: User[] = [];

    for (let i = 0; i < count; i++) {
      const user = await this.create(overrides);
      users.push(user);
    }

    return users;
  }

  // Specialized factory methods
  async createAdmin(overrides: Partial<UserCreateInput> = {}): Promise<User> {
    return await this.create({
      role: 'ADMIN',
      maxPipelines: 1000,
      maxExecutionsPerMonth: 10000,
      emailVerified: true,
      isActive: true,
      ...overrides,
    });
  }

  async createEditor(overrides: Partial<UserCreateInput> = {}): Promise<User> {
    return await this.create({
      role: 'EDITOR',
      maxPipelines: 50,
      maxExecutionsPerMonth: 1000,
      emailVerified: true,
      isActive: true,
      ...overrides,
    });
  }

  async createViewer(overrides: Partial<UserCreateInput> = {}): Promise<User> {
    return await this.create({
      role: 'VIEWER',
      maxPipelines: 10,
      maxExecutionsPerMonth: 100,
      emailVerified: true,
      isActive: true,
      ...overrides,
    });
  }

  async createInactiveUser(overrides: Partial<UserCreateInput> = {}): Promise<User> {
    return await this.create({
      isActive: false,
      emailVerified: false,
      lastLoginAt: null,
      ...overrides,
    });
  }

  async createPremiumUser(overrides: Partial<UserCreateInput> = {}): Promise<User> {
    return await this.create({
      role: 'EDITOR',
      maxPipelines: 500,
      maxExecutionsPerMonth: 5000,
      emailVerified: true,
      isActive: true,
      twoFactorEnabled: true,
      ...overrides,
    });
  }

  async createTestUser(overrides: Partial<UserCreateInput> = {}): Promise<User> {
    const sequence = this.getSequence('testuser');

    return await this.create({
      email: `test${sequence}@example.com`,
      passwordHash: 'test123',
      name: `Test User ${sequence}`,
      firstName: 'Test',
      lastName: `User${sequence}`,
      company: 'Test Company',
      role: 'VIEWER',
      emailVerified: true,
      isActive: true,
      ...overrides,
    });
  }

  // Bulk operations
  async createUserHierarchy(): Promise<{ admin: User; editors: User[]; viewers: User[] }> {
    const admin = await this.createAdmin({
      email: 'admin@imaginarium.dev',
      name: 'System Administrator',
      firstName: 'System',
      lastName: 'Administrator',
    });

    const editors = await Promise.all([
      this.createEditor({
        email: 'editor1@imaginarium.dev',
        name: 'Lead Editor',
        firstName: 'Lead',
        lastName: 'Editor',
      }),
      this.createEditor({
        email: 'editor2@imaginarium.dev',
        name: 'Senior Editor',
        firstName: 'Senior',
        lastName: 'Editor',
      }),
    ]);

    const viewers = await Promise.all([
      this.createViewer({
        email: 'viewer1@imaginarium.dev',
        name: 'Demo User',
        firstName: 'Demo',
        lastName: 'User',
      }),
      this.createViewer({
        email: 'viewer2@imaginarium.dev',
        name: 'Test User',
        firstName: 'Test',
        lastName: 'User',
      }),
    ]);

    return { admin, editors, viewers };
  }

  async createDiverseUserSet(count: number = 20): Promise<User[]> {
    const users: User[] = [];

    // Create different types of users
    const adminCount = Math.max(1, Math.floor(count * 0.1));
    const editorCount = Math.floor(count * 0.3);
    const viewerCount = count - adminCount - editorCount;

    // Create admins
    for (let i = 0; i < adminCount; i++) {
      users.push(await this.createAdmin());
    }

    // Create editors
    for (let i = 0; i < editorCount; i++) {
      users.push(await this.createEditor());
    }

    // Create viewers
    for (let i = 0; i < viewerCount; i++) {
      users.push(await this.createViewer());
    }

    return users;
  }

  // Performance testing
  async createPerformanceUsers(count: number): Promise<User[]> {
    const batchSize = 100;
    const users: User[] = [];

    for (let i = 0; i < count; i += batchSize) {
      const currentBatchSize = Math.min(batchSize, count - i);
      const batch = this.buildMany(currentBatchSize);

      // Use createMany for better performance
      const createdUsers = await this.config.prisma.user.createMany({
        data: batch.map(user => ({
          ...user,
          id: undefined, // Let Prisma generate IDs
        })),
      });

      // Fetch the created users
      const fetchedUsers = await this.config.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: currentBatchSize,
      });

      users.push(...fetchedUsers);
    }

    return users;
  }

  // Utility methods
  generateUserStats(users: User[]): Record<string, any> {
    const stats = {
      total: users.length,
      byRole: {
        ADMIN: users.filter(u => u.role === 'ADMIN').length,
        EDITOR: users.filter(u => u.role === 'EDITOR').length,
        VIEWER: users.filter(u => u.role === 'VIEWER').length,
      },
      active: users.filter(u => u.isActive).length,
      emailVerified: users.filter(u => u.emailVerified).length,
      twoFactorEnabled: users.filter(u => u.twoFactorEnabled).length,
      recentlyActive: users.filter(u => {
        if (!u.lastLoginAt) return false;
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return u.lastLoginAt > weekAgo;
      }).length,
    };

    return stats;
  }
}
