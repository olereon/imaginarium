/**
 * Base repository providing common CRUD operations
 */

import { prisma } from '../prisma.js';
import type { Prisma } from '@prisma/client';

export interface IBaseRepository<T, TCreate, TUpdate> {
  create(data: TCreate): Promise<T>;
  findById(id: string): Promise<T | null>;
  findMany(params?: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, unknown>;
    skip?: number;
    take?: number;
  }): Promise<T[]>;
  update(id: string, data: TUpdate): Promise<T>;
  delete(id: string): Promise<T>;
  count(where?: Record<string, unknown>): Promise<number>;
}

export abstract class BaseRepository<T, TCreate, TUpdate>
  implements IBaseRepository<T, TCreate, TUpdate>
{
  protected abstract model: any;

  async create(data: TCreate): Promise<T> {
    return await this.model.create({ data });
  }

  async findById(id: string): Promise<T | null> {
    return await this.model.findUnique({ where: { id } });
  }

  async findMany(
    params: {
      where?: Record<string, unknown>;
      orderBy?: Record<string, unknown>;
      skip?: number;
      take?: number;
    } = {}
  ): Promise<T[]> {
    return await this.model.findMany(params);
  }

  async update(id: string, data: TUpdate): Promise<T> {
    return await this.model.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<T> {
    return await this.model.delete({ where: { id } });
  }

  async count(where?: Record<string, unknown>): Promise<number> {
    return await this.model.count({ where });
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.model.count({ where: { id } });
    return count > 0;
  }

  async findFirst(where: Record<string, unknown>): Promise<T | null> {
    return await this.model.findFirst({ where });
  }

  async findUnique(where: Record<string, unknown>): Promise<T | null> {
    return await this.model.findUnique({ where });
  }

  async upsert(params: {
    where: Record<string, unknown>;
    create: TCreate;
    update: TUpdate;
  }): Promise<T> {
    return await this.model.upsert(params);
  }

  async deleteMany(where: Record<string, unknown>): Promise<{ count: number }> {
    return await this.model.deleteMany({ where });
  }

  async updateMany(params: {
    where: Record<string, unknown>;
    data: Partial<TUpdate>;
  }): Promise<{ count: number }> {
    return await this.model.updateMany(params);
  }
}

export { prisma };
