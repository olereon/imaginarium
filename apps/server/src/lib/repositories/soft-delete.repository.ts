/**
 * Soft delete repository mixin for models that support soft deletion
 */

import { BaseRepository } from './base.repository.js';
import type { Prisma } from '@prisma/client';

export interface ISoftDeleteRepository<T, TCreate, TUpdate> {
  findManyActive(params?: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, unknown>;
    skip?: number;
    take?: number;
  }): Promise<T[]>;
  findByIdActive(id: string): Promise<T | null>;
  findManyDeleted(params?: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, unknown>;
    skip?: number;
    take?: number;
  }): Promise<T[]>;
  softDelete(id: string, deletedBy?: string): Promise<T>;
  restore(id: string): Promise<T>;
  permanentDelete(id: string): Promise<T>;
  countActive(where?: Record<string, unknown>): Promise<number>;
  countDeleted(where?: Record<string, unknown>): Promise<number>;
}

export abstract class SoftDeleteRepository<T, TCreate, TUpdate>
  extends BaseRepository<T, TCreate, TUpdate>
  implements ISoftDeleteRepository<T, TCreate, TUpdate>
{
  /**
   * Find many records excluding soft deleted ones
   */
  async findManyActive(
    params: {
      where?: Record<string, unknown>;
      orderBy?: Record<string, unknown>;
      skip?: number;
      take?: number;
    } = {}
  ): Promise<T[]> {
    return await this.model.findMany({
      ...params,
      where: {
        ...params.where,
        deletedAt: null,
      },
    });
  }

  /**
   * Find by ID excluding soft deleted records
   */
  async findByIdActive(id: string): Promise<T | null> {
    return await this.model.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  /**
   * Find only soft deleted records
   */
  async findManyDeleted(
    params: {
      where?: Record<string, unknown>;
      orderBy?: Record<string, unknown>;
      skip?: number;
      take?: number;
    } = {}
  ): Promise<T[]> {
    return await this.model.findMany({
      ...params,
      where: {
        ...params.where,
        deletedAt: { not: null },
      },
    });
  }

  /**
   * Soft delete a record by setting deletedAt timestamp
   */
  async softDelete(id: string, deletedBy?: string): Promise<T> {
    const updateData: any = {
      deletedAt: new Date(),
    };

    // Add deletedBy if the model supports it and deletedBy is provided
    if (deletedBy) {
      updateData.deletedBy = deletedBy;
    }

    return await this.model.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Restore a soft deleted record
   */
  async restore(id: string): Promise<T> {
    const updateData: any = {
      deletedAt: null,
    };

    // Clear deletedBy if the model supports it
    try {
      updateData.deletedBy = null;
    } catch {
      // Model doesn't have deletedBy field, ignore
    }

    return await this.model.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Permanently delete a record from the database
   */
  async permanentDelete(id: string): Promise<T> {
    return await this.model.delete({
      where: { id },
    });
  }

  /**
   * Count active (non-deleted) records
   */
  async countActive(where?: Record<string, unknown>): Promise<number> {
    return await this.model.count({
      where: {
        ...where,
        deletedAt: null,
      },
    });
  }

  /**
   * Count soft deleted records
   */
  async countDeleted(where?: Record<string, unknown>): Promise<number> {
    return await this.model.count({
      where: {
        ...where,
        deletedAt: { not: null },
      },
    });
  }

  /**
   * Override base methods to respect soft delete by default
   */
  async findMany(
    params: {
      where?: Record<string, unknown>;
      orderBy?: Record<string, unknown>;
      skip?: number;
      take?: number;
      includeDeleted?: boolean;
    } = {}
  ): Promise<T[]> {
    const { includeDeleted = false, ...otherParams } = params;

    if (includeDeleted) {
      return await super.findMany(otherParams);
    }

    return await this.findManyActive(otherParams);
  }

  async findById(id: string, includeDeleted = false): Promise<T | null> {
    if (includeDeleted) {
      return await super.findById(id);
    }

    return await this.findByIdActive(id);
  }

  async count(where?: Record<string, unknown>, includeDeleted = false): Promise<number> {
    if (includeDeleted) {
      return await super.count(where);
    }

    return await this.countActive(where);
  }

  /**
   * Bulk soft delete multiple records
   */
  async bulkSoftDelete(
    where: Record<string, unknown>,
    deletedBy?: string
  ): Promise<{ count: number }> {
    const updateData: any = {
      deletedAt: new Date(),
    };

    if (deletedBy) {
      updateData.deletedBy = deletedBy;
    }

    return await this.model.updateMany({
      where: {
        ...where,
        deletedAt: null, // Only delete non-deleted records
      },
      data: updateData,
    });
  }

  /**
   * Bulk restore multiple records
   */
  async bulkRestore(where: Record<string, unknown>): Promise<{ count: number }> {
    const updateData: any = {
      deletedAt: null,
    };

    try {
      updateData.deletedBy = null;
    } catch {
      // Model doesn't have deletedBy field, ignore
    }

    return await this.model.updateMany({
      where: {
        ...where,
        deletedAt: { not: null }, // Only restore deleted records
      },
      data: updateData,
    });
  }

  /**
   * Get deleted records older than specified days for cleanup
   */
  async findDeletedOlderThan(days: number): Promise<T[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return await this.model.findMany({
      where: {
        deletedAt: {
          lt: cutoffDate,
        },
      },
    });
  }

  /**
   * Permanently delete records that were soft deleted more than X days ago
   */
  async cleanupOldDeleted(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.model.deleteMany({
      where: {
        deletedAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }
}
