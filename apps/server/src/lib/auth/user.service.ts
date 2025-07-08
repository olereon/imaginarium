/**
 * User service for authentication and user management
 */

import { hash, compare } from 'bcryptjs'
import { randomBytes, createHash } from 'crypto'
import { UserRepository } from '../repositories/user.repository.js'
import type { User, CreateUserInput, UpdateUserInput } from '@imaginarium/shared'

export class UserService {
  constructor(private userRepository: UserRepository) {}

  /**
   * Create a new user with hashed password
   */
  async createUser(input: Omit<CreateUserInput, 'passwordHash'> & { password: string }): Promise<User> {
    const { password, ...userData } = input
    const passwordHash = await hash(password, 12)
    
    return await this.userRepository.create({
      ...userData,
      passwordHash,
    })
  }

  /**
   * Authenticate user with email and password
   */
  async authenticateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findByEmailActive(email)
    if (!user || !user.isActive) {
      return null
    }

    const isValidPassword = await compare(password, user.passwordHash)
    if (!isValidPassword) {
      return null
    }

    // Update last login
    await this.userRepository.updateLastLogin(user.id)
    
    return user
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<boolean> {
    const user = await this.userRepository.findByIdActive(userId)
    if (!user) {
      throw new Error('User not found')
    }

    const isValidOldPassword = await compare(oldPassword, user.passwordHash)
    if (!isValidOldPassword) {
      throw new Error('Invalid current password')
    }

    const newPasswordHash = await hash(newPassword, 12)
    await this.userRepository.update(userId, { passwordHash: newPasswordHash })
    
    return true
  }

  /**
   * Generate password reset token
   */
  async generatePasswordResetToken(email: string): Promise<string | null> {
    const user = await this.userRepository.findByEmailActive(email)
    if (!user) {
      return null
    }

    const resetToken = randomBytes(32).toString('hex')
    const hashedToken = createHash('sha256').update(resetToken).digest('hex')
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    await this.userRepository.resetPassword(user.id, hashedToken, expiresAt)
    
    return resetToken // Return unhashed token for email
  }

  /**
   * Reset password using token
   */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const hashedToken = createHash('sha256').update(token).digest('hex')
    const user = await this.userRepository.findByPasswordResetToken(hashedToken)
    
    if (!user) {
      throw new Error('Invalid or expired reset token')
    }

    const newPasswordHash = await hash(newPassword, 12)
    await this.userRepository.update(user.id, { passwordHash: newPasswordHash })
    await this.userRepository.clearPasswordResetToken(user.id)
    
    return true
  }

  /**
   * Generate email verification token
   */
  async generateEmailVerificationToken(userId: string): Promise<string> {
    const verificationToken = randomBytes(32).toString('hex')
    const hashedToken = createHash('sha256').update(verificationToken).digest('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    await this.userRepository.setEmailVerificationToken(userId, hashedToken, expiresAt)
    
    return verificationToken // Return unhashed token for email
  }

  /**
   * Verify email using token
   */
  async verifyEmail(token: string): Promise<boolean> {
    const hashedToken = createHash('sha256').update(token).digest('hex')
    const user = await this.userRepository.findByEmailVerificationToken(hashedToken)
    
    if (!user) {
      throw new Error('Invalid or expired verification token')
    }

    await this.userRepository.verifyEmail(user.id)
    await this.userRepository.clearEmailVerificationToken(user.id)
    
    return true
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updates: UpdateUserInput): Promise<User> {
    // Remove sensitive fields that shouldn't be updated through this method
    const { passwordHash, ...safeUpdates } = updates as any
    
    return await this.userRepository.update(userId, safeUpdates)
  }

  /**
   * Deactivate user account (soft delete)
   */
  async deactivateUser(userId: string, deletedBy?: string): Promise<User> {
    return await this.userRepository.softDelete(userId, deletedBy)
  }

  /**
   * Restore deactivated user account
   */
  async restoreUser(userId: string): Promise<User> {
    return await this.userRepository.restore(userId)
  }

  /**
   * Get user profile with stats
   */
  async getUserProfile(userId: string): Promise<User & { stats: any } | null> {
    const user = await this.userRepository.findByIdActive(userId)
    if (!user) {
      return null
    }

    const stats = await this.userRepository.getUserStats(userId)
    
    // Remove sensitive fields
    const { passwordHash, passwordResetToken, passwordResetExpires, 
            emailVerificationToken, emailVerificationExpires, 
            twoFactorSecret, ...safeUser } = user

    return {
      ...safeUser,
      stats,
    }
  }

  /**
   * Check if user can create more pipelines
   */
  async canCreatePipeline(userId: string): Promise<boolean> {
    const user = await this.userRepository.findByIdActive(userId)
    if (!user) {
      return false
    }

    const stats = await this.userRepository.getUserStats(userId)
    return stats.pipelines < user.maxPipelines
  }

  /**
   * Check if user can execute more pipelines this month
   */
  async canExecutePipeline(userId: string): Promise<boolean> {
    const user = await this.userRepository.findByIdActive(userId)
    if (!user) {
      return false
    }

    // Count executions this month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const monthlyExecutions = await this.userRepository.count({
      userId,
      queuedAt: {
        gte: startOfMonth,
      },
    })

    return monthlyExecutions < user.maxExecutionsPerMonth
  }
}