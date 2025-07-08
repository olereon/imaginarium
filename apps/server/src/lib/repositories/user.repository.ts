/**
 * User repository for database operations
 */

import { SoftDeleteRepository } from './soft-delete.repository.js'
import { prisma } from '../prisma.js'
import type { 
  User, 
  CreateUserInput, 
  UpdateUserInput,
  UserRole 
} from '@imaginarium/shared'

export interface IUserRepository {
  findByEmail(email: string, includeDeleted?: boolean): Promise<User | null>
  findByEmailActive(email: string): Promise<User | null>
  findWithSessions(id: string): Promise<User & { sessions: any[] } | null>
  findWithApiKeys(id: string): Promise<User & { apiKeys: any[] } | null>
  updateLastLogin(id: string): Promise<User>
  deactivate(id: string): Promise<User>
  activate(id: string): Promise<User>
  findByRole(role: UserRole): Promise<User[]>
  verifyEmail(id: string): Promise<User>
  resetPassword(id: string, token: string, expiresAt: Date): Promise<User>
  clearPasswordResetToken(id: string): Promise<User>
  setEmailVerificationToken(id: string, token: string, expiresAt: Date): Promise<User>
  clearEmailVerificationToken(id: string): Promise<User>
}

export class UserRepository 
  extends SoftDeleteRepository<User, CreateUserInput, UpdateUserInput> 
  implements IUserRepository {
  
  protected model = prisma.user
  
  async findByEmail(email: string, includeDeleted = false): Promise<User | null> {
    return await this.model.findFirst({
      where: { 
        email,
        ...(includeDeleted ? {} : { deletedAt: null })
      },
    })
  }
  
  async findByEmailActive(email: string): Promise<User | null> {
    return await this.findByEmail(email, false)
  }
  
  async findWithSessions(id: string): Promise<User & { sessions: any[] } | null> {
    return await this.model.findUnique({
      where: { id },
      include: {
        sessions: {
          where: {
            expiresAt: {
              gt: new Date(),
            },
          },
          orderBy: {
            lastUsedAt: 'desc',
          },
        },
      },
    })
  }
  
  async findWithApiKeys(id: string): Promise<User & { apiKeys: any[] } | null> {
    return await this.model.findUnique({
      where: { id },
      include: {
        apiKeys: {
          where: {
            isActive: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    })
  }
  
  async updateLastLogin(id: string): Promise<User> {
    return await this.model.update({
      where: { id },
      data: {
        lastLoginAt: new Date(),
      },
    })
  }
  
  async deactivate(id: string): Promise<User> {
    return await this.model.update({
      where: { id },
      data: {
        isActive: false,
      },
    })
  }
  
  async activate(id: string): Promise<User> {
    return await this.model.update({
      where: { id },
      data: {
        isActive: true,
      },
    })
  }
  
  async findByRole(role: UserRole): Promise<User[]> {
    return await this.model.findMany({
      where: { role },
      orderBy: {
        createdAt: 'desc',
      },
    })
  }
  
  async verifyEmail(id: string): Promise<User> {
    return await this.model.update({
      where: { id },
      data: {
        emailVerified: true,
      },
    })
  }
  
  async findActiveUsers(): Promise<User[]> {
    return await this.model.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        lastLoginAt: 'desc',
      },
    })
  }
  
  async getUserStats(userId: string) {
    const [pipelineCount, executionCount] = await Promise.all([
      prisma.pipeline.count({ where: { userId, deletedAt: null } }),
      prisma.pipelineRun.count({ where: { userId } }),
    ])
    
    return {
      pipelines: pipelineCount,
      executions: executionCount,
    }
  }
  
  async resetPassword(id: string, token: string, expiresAt: Date): Promise<User> {
    return await this.model.update({
      where: { id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: expiresAt,
      },
    })
  }
  
  async clearPasswordResetToken(id: string): Promise<User> {
    return await this.model.update({
      where: { id },
      data: {
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    })
  }
  
  async setEmailVerificationToken(id: string, token: string, expiresAt: Date): Promise<User> {
    return await this.model.update({
      where: { id },
      data: {
        emailVerificationToken: token,
        emailVerificationExpires: expiresAt,
      },
    })
  }
  
  async clearEmailVerificationToken(id: string): Promise<User> {
    return await this.model.update({
      where: { id },
      data: {
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    })
  }
  
  async findByPasswordResetToken(token: string): Promise<User | null> {
    return await this.model.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gt: new Date(),
        },
        deletedAt: null,
      },
    })
  }
  
  async findByEmailVerificationToken(token: string): Promise<User | null> {
    return await this.model.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: {
          gt: new Date(),
        },
        deletedAt: null,
      },
    })
  }
}