/**
 * API Key service for managing service authentication
 */

import { randomBytes, createHash } from 'crypto'
import { prisma } from '../prisma.js'
import type { ApiKey } from '@imaginarium/shared'

export interface CreateApiKeyInput {
  userId: string
  name: string
  description?: string
  permissions: string[]
  scopes?: string[]
  allowedIps?: string[]
  allowedDomains?: string[]
  rateLimit?: number
  rateLimitWindow?: string
  expiresAt?: Date
}

export class ApiKeyService {
  /**
   * Generate a new API key
   */
  private generateApiKey(): { key: string; hashedKey: string; prefix: string } {
    const key = `sk_${randomBytes(32).toString('hex')}`
    const hashedKey = createHash('sha256').update(key).digest('hex')
    const prefix = key.substring(0, 8)
    
    return { key, hashedKey, prefix }
  }

  /**
   * Create a new API key
   */
  async createApiKey(input: CreateApiKeyInput): Promise<{ apiKey: ApiKey; plainKey: string }> {
    const { key, hashedKey, prefix } = this.generateApiKey()
    
    const apiKey = await prisma.apiKey.create({
      data: {
        userId: input.userId,
        name: input.name,
        description: input.description,
        key: hashedKey,
        keyPrefix: prefix,
        permissions: JSON.stringify(input.permissions),
        scopes: input.scopes ? JSON.stringify(input.scopes) : null,
        allowedIps: input.allowedIps ? JSON.stringify(input.allowedIps) : null,
        allowedDomains: input.allowedDomains ? JSON.stringify(input.allowedDomains) : null,
        rateLimit: input.rateLimit,
        rateLimitWindow: input.rateLimitWindow,
        expiresAt: input.expiresAt,
      },
    })

    return { apiKey, plainKey: key }
  }

  /**
   * Validate an API key and return user info
   */
  async validateApiKey(key: string): Promise<{ user: any; apiKey: ApiKey } | null> {
    const hashedKey = createHash('sha256').update(key).digest('hex')
    
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        key: hashedKey,
        isActive: true,
        isRevoked: false,
        deletedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            deletedAt: true,
          }
        }
      }
    })

    if (!apiKey || !apiKey.user.isActive || apiKey.user.deletedAt) {
      return null
    }

    // Update usage tracking
    await this.updateUsage(apiKey.id, key)

    return { user: apiKey.user, apiKey }
  }

  /**
   * Check if API key has specific permission
   */
  hasPermission(apiKey: ApiKey, permission: string): boolean {
    try {
      const permissions = JSON.parse(apiKey.permissions) as string[]
      return permissions.includes(permission) || permissions.includes('*')
    } catch {
      return false
    }
  }

  /**
   * Check if API key has specific scope
   */
  hasScope(apiKey: ApiKey, scope: string): boolean {
    if (!apiKey.scopes) {
      return true // No scope restrictions
    }
    
    try {
      const scopes = JSON.parse(apiKey.scopes) as string[]
      return scopes.includes(scope) || scopes.includes('*')
    } catch {
      return false
    }
  }

  /**
   * Check if IP address is allowed
   */
  isIpAllowed(apiKey: ApiKey, ipAddress: string): boolean {
    if (!apiKey.allowedIps) {
      return true // No IP restrictions
    }
    
    try {
      const allowedIps = JSON.parse(apiKey.allowedIps) as string[]
      return allowedIps.includes(ipAddress) || allowedIps.includes('*')
    } catch {
      return false
    }
  }

  /**
   * Check if domain is allowed
   */
  isDomainAllowed(apiKey: ApiKey, domain: string): boolean {
    if (!apiKey.allowedDomains) {
      return true // No domain restrictions
    }
    
    try {
      const allowedDomains = JSON.parse(apiKey.allowedDomains) as string[]
      return allowedDomains.includes(domain) || allowedDomains.includes('*')
    } catch {
      return false
    }
  }

  /**
   * Update API key usage tracking
   */
  private async updateUsage(apiKeyId: string, sourceIp?: string): Promise<void> {
    await prisma.apiKey.update({
      where: { id: apiKeyId },
      data: {
        totalRequests: { increment: 1 },
        lastUsedAt: new Date(),
        lastUsedIp: sourceIp,
      }
    })
  }

  /**
   * List API keys for a user
   */
  async listApiKeys(userId: string): Promise<Omit<ApiKey, 'key'>[]> {
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      }
    })

    // Remove the actual key from response
    return apiKeys.map(({ key, ...apiKey }) => apiKey)
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(id: string, reason?: string): Promise<ApiKey> {
    return await prisma.apiKey.update({
      where: { id },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason,
      }
    })
  }

  /**
   * Delete an API key (soft delete)
   */
  async deleteApiKey(id: string): Promise<ApiKey> {
    return await prisma.apiKey.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      }
    })
  }

  /**
   * Update API key settings
   */
  async updateApiKey(
    id: string, 
    updates: {
      name?: string
      description?: string
      permissions?: string[]
      scopes?: string[]
      allowedIps?: string[]
      allowedDomains?: string[]
      rateLimit?: number
      rateLimitWindow?: string
      expiresAt?: Date
      isActive?: boolean
    }
  ): Promise<ApiKey> {
    const updateData: any = { ...updates }
    
    if (updates.permissions) {
      updateData.permissions = JSON.stringify(updates.permissions)
    }
    if (updates.scopes) {
      updateData.scopes = JSON.stringify(updates.scopes)
    }
    if (updates.allowedIps) {
      updateData.allowedIps = JSON.stringify(updates.allowedIps)
    }
    if (updates.allowedDomains) {
      updateData.allowedDomains = JSON.stringify(updates.allowedDomains)
    }

    return await prisma.apiKey.update({
      where: { id },
      data: updateData,
    })
  }

  /**
   * Get API key usage statistics
   */
  async getUsageStats(id: string): Promise<{
    totalRequests: number
    lastUsedAt: Date | null
    lastUsedIp: string | null
    isActive: boolean
    isRevoked: boolean
    expiresAt: Date | null
  }> {
    const apiKey = await prisma.apiKey.findUnique({
      where: { id },
      select: {
        totalRequests: true,
        lastUsedAt: true,
        lastUsedIp: true,
        isActive: true,
        isRevoked: true,
        expiresAt: true,
      }
    })

    if (!apiKey) {
      throw new Error('API key not found')
    }

    return apiKey
  }
}