/**
 * Pipeline Version repository for managing pipeline version history
 */

import {
  PipelineVersion,
  type CreatePipelineVersionInput,
  type UpdatePipelineVersionInput,
} from '@imaginarium/shared';
import { BaseRepository } from './base.repository.js';
import { prisma } from '../database.js';

export class PipelineVersionRepository extends BaseRepository<
  PipelineVersion,
  CreatePipelineVersionInput,
  UpdatePipelineVersionInput
> {
  constructor() {
    super(prisma.pipelineVersion);
  }

  /**
   * Find all versions for a pipeline
   */
  async findByPipelineId(pipelineId: string): Promise<PipelineVersion[]> {
    return await prisma.pipelineVersion.findMany({
      where: { pipelineId },
      orderBy: { version: 'desc' },
    });
  }

  /**
   * Find specific version of a pipeline
   */
  async findByPipelineIdAndVersion(
    pipelineId: string,
    version: number
  ): Promise<PipelineVersion | null> {
    return await prisma.pipelineVersion.findUnique({
      where: {
        pipelineId_version: {
          pipelineId,
          version,
        },
      },
    });
  }

  /**
   * Get latest version number for a pipeline
   */
  async getLatestVersion(pipelineId: string): Promise<number> {
    const latest = await prisma.pipelineVersion.findFirst({
      where: { pipelineId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    return latest?.version ?? 0;
  }

  /**
   * Create new version with auto-incrementing version number
   */
  async createVersion(
    pipelineId: string,
    configuration: object,
    changelog: string,
    createdBy: string
  ): Promise<PipelineVersion> {
    const latestVersion = await this.getLatestVersion(pipelineId);
    const newVersion = latestVersion + 1;

    return await prisma.pipelineVersion.create({
      data: {
        pipelineId,
        version: newVersion,
        configuration: JSON.stringify(configuration),
        changelog,
        createdBy,
      },
    });
  }

  /**
   * Get version history with metadata
   */
  async getVersionHistory(
    pipelineId: string,
    limit = 50
  ): Promise<Array<PipelineVersion & { configSize: number }>> {
    const versions = await prisma.pipelineVersion.findMany({
      where: { pipelineId },
      orderBy: { version: 'desc' },
      take: limit,
    });

    return versions.map(version => ({
      ...version,
      configSize: version.configuration.length, // Rough size indicator
    }));
  }

  /**
   * Compare two versions and return diff summary
   */
  async compareVersions(
    pipelineId: string,
    fromVersion: number,
    toVersion: number
  ): Promise<{
    from: PipelineVersion | null;
    to: PipelineVersion | null;
    hasChanges: boolean;
  }> {
    const [from, to] = await Promise.all([
      this.findByPipelineIdAndVersion(pipelineId, fromVersion),
      this.findByPipelineIdAndVersion(pipelineId, toVersion),
    ]);

    const hasChanges = from?.configuration !== to?.configuration;

    return { from, to, hasChanges };
  }

  /**
   * Restore pipeline to specific version
   */
  async restoreToVersion(
    pipelineId: string,
    targetVersion: number
  ): Promise<PipelineVersion | null> {
    const version = await this.findByPipelineIdAndVersion(pipelineId, targetVersion);
    if (!version) {
      return null;
    }

    // Update the pipeline's current configuration to match this version
    await prisma.pipeline.update({
      where: { id: pipelineId },
      data: {
        configuration: version.configuration,
        version: { increment: 1 }, // Increment main version
        updatedAt: new Date(),
      },
    });

    // Create a new version entry for this restoration
    return await this.createVersion(
      pipelineId,
      JSON.parse(version.configuration),
      `Restored from version ${targetVersion}`,
      version.createdBy
    );
  }

  /**
   * Clean up old versions (keep latest N versions)
   */
  async cleanupOldVersions(pipelineId: string, keepCount = 10): Promise<number> {
    const versions = await prisma.pipelineVersion.findMany({
      where: { pipelineId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true },
    });

    if (versions.length <= keepCount) {
      return 0;
    }

    const versionsToDelete = versions.slice(keepCount);
    const idsToDelete = versionsToDelete.map(v => v.id);

    const result = await prisma.pipelineVersion.deleteMany({
      where: {
        id: { in: idsToDelete },
      },
    });

    return result.count;
  }

  /**
   * Get version statistics for a pipeline
   */
  async getVersionStats(pipelineId: string): Promise<{
    totalVersions: number;
    latestVersion: number;
    oldestVersion: number;
    firstCreated: Date | null;
    lastCreated: Date | null;
  }> {
    const stats = await prisma.pipelineVersion.aggregate({
      where: { pipelineId },
      _count: { id: true },
      _min: { version: true, createdAt: true },
      _max: { version: true, createdAt: true },
    });

    return {
      totalVersions: stats._count.id,
      latestVersion: stats._max.version ?? 0,
      oldestVersion: stats._min.version ?? 0,
      firstCreated: stats._min.createdAt,
      lastCreated: stats._max.createdAt,
    };
  }
}
