/**
 * Fixture utilities and exports
 */

import { PrismaClient } from '@prisma/client';
import contentCreationTemplates from './content-creation-templates.json';
import dataAnalysisTemplates from './data-analysis-templates.json';
import workflowAutomationTemplates from './workflow-automation-templates.json';
import aiIntegrationTemplates from './ai-integration-templates.json';
import imageProcessingTemplates from './image-processing-templates.json';

export interface TemplateFixture {
  id: string;
  name: string;
  description: string;
  category: string;
  isPublic: boolean;
  configuration: Record<string, any>;
  parameters: Record<string, any>;
  usageCount: number;
  tags: string[];
  difficulty: string;
  estimatedTime: string;
  cost: string;
}

export const fixtures = {
  contentCreation: contentCreationTemplates as TemplateFixture[],
  dataAnalysis: dataAnalysisTemplates as TemplateFixture[],
  workflowAutomation: workflowAutomationTemplates as TemplateFixture[],
  aiIntegration: aiIntegrationTemplates as TemplateFixture[],
  imageProcessing: imageProcessingTemplates as TemplateFixture[],
};

export const allFixtures = [
  ...fixtures.contentCreation,
  ...fixtures.dataAnalysis,
  ...fixtures.workflowAutomation,
  ...fixtures.aiIntegration,
  ...fixtures.imageProcessing,
];

export const fixturesByCategory = {
  'content-creation': fixtures.contentCreation,
  'data-analysis': fixtures.dataAnalysis,
  automation: fixtures.workflowAutomation,
  'ai-integration': fixtures.aiIntegration,
  'image-processing': fixtures.imageProcessing,
};

export const fixturesByDifficulty = {
  beginner: allFixtures.filter(f => f.difficulty === 'beginner'),
  intermediate: allFixtures.filter(f => f.difficulty === 'intermediate'),
  advanced: allFixtures.filter(f => f.difficulty === 'advanced'),
  expert: allFixtures.filter(f => f.difficulty === 'expert'),
};

export const fixturesByCost = {
  low: allFixtures.filter(f => f.cost.includes('low')),
  medium: allFixtures.filter(f => f.cost.includes('medium')),
  high: allFixtures.filter(f => f.cost.includes('high')),
};

export const publicFixtures = allFixtures.filter(f => f.isPublic);
export const privateFixtures = allFixtures.filter(f => !f.isPublic);

/**
 * Load a specific fixture into the database
 */
export async function loadFixture(prisma: PrismaClient, fixture: TemplateFixture) {
  return await prisma.pipelineTemplate.upsert({
    where: { id: fixture.id },
    update: {
      name: fixture.name,
      description: fixture.description,
      category: fixture.category,
      isPublic: fixture.isPublic,
      configuration: JSON.stringify(fixture.configuration),
      parameters: JSON.stringify(fixture.parameters),
      usageCount: fixture.usageCount,
      updatedAt: new Date(),
    },
    create: {
      id: fixture.id,
      name: fixture.name,
      description: fixture.description,
      category: fixture.category,
      isPublic: fixture.isPublic,
      configuration: JSON.stringify(fixture.configuration),
      parameters: JSON.stringify(fixture.parameters),
      usageCount: fixture.usageCount,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

/**
 * Load all fixtures into the database
 */
export async function loadAllFixtures(prisma: PrismaClient) {
  const results = [];

  for (const fixture of allFixtures) {
    try {
      const result = await loadFixture(prisma, fixture);
      results.push({ success: true, fixture: result });
    } catch (error) {
      results.push({ success: false, fixture: fixture.id, error });
    }
  }

  return results;
}

/**
 * Load fixtures by category
 */
export async function loadFixturesByCategory(
  prisma: PrismaClient,
  category: keyof typeof fixturesByCategory
) {
  const fixtures = fixturesByCategory[category];
  const results = [];

  for (const fixture of fixtures) {
    try {
      const result = await loadFixture(prisma, fixture);
      results.push({ success: true, fixture: result });
    } catch (error) {
      results.push({ success: false, fixture: fixture.id, error });
    }
  }

  return results;
}

/**
 * Get fixture by ID
 */
export function getFixtureById(id: string): TemplateFixture | undefined {
  return allFixtures.find(f => f.id === id);
}

/**
 * Search fixtures by name or description
 */
export function searchFixtures(query: string): TemplateFixture[] {
  const lowercaseQuery = query.toLowerCase();
  return allFixtures.filter(
    f =>
      f.name.toLowerCase().includes(lowercaseQuery) ||
      f.description.toLowerCase().includes(lowercaseQuery) ||
      f.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
  );
}

/**
 * Get fixture statistics
 */
export function getFixtureStats() {
  return {
    total: allFixtures.length,
    byCategory: Object.keys(fixturesByCategory).reduce(
      (acc, category) => {
        acc[category] = fixturesByCategory[category as keyof typeof fixturesByCategory].length;
        return acc;
      },
      {} as Record<string, number>
    ),
    byDifficulty: Object.keys(fixturesByDifficulty).reduce(
      (acc, difficulty) => {
        acc[difficulty] =
          fixturesByDifficulty[difficulty as keyof typeof fixturesByDifficulty].length;
        return acc;
      },
      {} as Record<string, number>
    ),
    byCost: Object.keys(fixturesByCost).reduce(
      (acc, cost) => {
        acc[cost] = fixturesByCost[cost as keyof typeof fixturesByCost].length;
        return acc;
      },
      {} as Record<string, number>
    ),
    public: publicFixtures.length,
    private: privateFixtures.length,
  };
}
