/**
 * Data factory functions for test data generation
 */

import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

export * from './user.factory'
export * from './pipeline.factory'
export * from './execution.factory'
export * from './file.factory'
export * from './template.factory'
export * from './performance.factory'

// Re-export types for convenience
export type { 
  UserCreateInput,
  PipelineCreateInput,
  ExecutionCreateInput,
  FileCreateInput,
  TemplateCreateInput
} from './types'

// Factory configuration
export interface FactoryConfig {
  prisma: PrismaClient
  environment: 'development' | 'testing' | 'performance'
  seed?: number
  locale?: string
}

// Base factory class
export abstract class BaseFactory<T> {
  protected config: FactoryConfig
  protected sequenceCounters: Map<string, number> = new Map()

  constructor(config: FactoryConfig) {
    this.config = config
    
    // Set deterministic seed if provided
    if (config.seed) {
      this.setSeed(config.seed)
    }
  }

  protected setSeed(seed: number): void {
    // Simple seeded random number generator
    let currentSeed = seed
    Math.random = () => {
      currentSeed = (currentSeed * 9301 + 49297) % 233280
      return currentSeed / 233280
    }
  }

  protected getSequence(key: string): number {
    const current = this.sequenceCounters.get(key) || 0
    this.sequenceCounters.set(key, current + 1)
    return current + 1
  }

  protected randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  protected randomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)]
  }

  protected randomBoolean(probability = 0.5): boolean {
    return Math.random() < probability
  }

  protected randomDate(daysAgo: number = 30): Date {
    const now = new Date()
    const pastDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000))
    const randomTime = pastDate.getTime() + Math.random() * (now.getTime() - pastDate.getTime())
    return new Date(randomTime)
  }

  protected async hashPassword(password: string): Promise<string> {
    return hash(password, 12)
  }

  // Abstract methods to be implemented by specific factories
  abstract create(overrides?: Partial<T>): Promise<T>
  abstract createMany(count: number, overrides?: Partial<T>): Promise<T[]>
  abstract build(overrides?: Partial<T>): T
  abstract buildMany(count: number, overrides?: Partial<T>): T[]
}

// Utility functions
export const generateId = (prefix: string = 'id'): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export const generateEmail = (domain: string = 'example.com'): string => {
  const username = Math.random().toString(36).substr(2, 8)
  return `${username}@${domain}`
}

export const generateName = (): { firstName: string; lastName: string; fullName: string } => {
  const firstNames = [
    'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry',
    'Ivy', 'Jack', 'Kate', 'Liam', 'Mia', 'Noah', 'Olivia', 'Paul',
    'Quinn', 'Ruby', 'Sam', 'Tina', 'Uma', 'Victor', 'Wendy', 'Xander',
    'Yara', 'Zoe'
  ]
  
  const lastNames = [
    'Anderson', 'Brown', 'Clark', 'Davis', 'Evans', 'Fisher', 'Garcia',
    'Harris', 'Johnson', 'King', 'Lee', 'Miller', 'Nelson', 'Parker',
    'Quinn', 'Roberts', 'Smith', 'Taylor', 'Wilson', 'Young'
  ]
  
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
  
  return {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`
  }
}

export const generateCompanyName = (): string => {
  const adjectives = [
    'Global', 'Digital', 'Advanced', 'Smart', 'Creative', 'Dynamic',
    'Innovative', 'Modern', 'Progressive', 'Strategic', 'Tech', 'Future'
  ]
  
  const nouns = [
    'Solutions', 'Systems', 'Technologies', 'Innovations', 'Labs',
    'Studios', 'Works', 'Dynamics', 'Enterprises', 'Group', 'Corp'
  ]
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  
  return `${adjective} ${noun}`
}

export const generateLoremText = (words: number = 20): string => {
  const loremWords = [
    'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing',
    'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore',
    'et', 'dolore', 'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam',
    'quis', 'nostrud', 'exercitation', 'ullamco', 'laboris', 'nisi',
    'aliquip', 'ex', 'ea', 'commodo', 'consequat', 'duis', 'aute',
    'irure', 'in', 'reprehenderit', 'voluptate', 'velit', 'esse',
    'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
    'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa',
    'qui', 'officia', 'deserunt', 'mollit', 'anim', 'id', 'est',
    'laborum'
  ]
  
  const result = []
  for (let i = 0; i < words; i++) {
    result.push(loremWords[Math.floor(Math.random() * loremWords.length)])
  }
  
  return result.join(' ')
}

export const generateTimezone = (): string => {
  const timezones = [
    'UTC',
    'America/New_York',
    'America/Los_Angeles',
    'America/Chicago',
    'America/Denver',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Mumbai',
    'Australia/Sydney',
    'Australia/Melbourne'
  ]
  
  return timezones[Math.floor(Math.random() * timezones.length)]
}

export const generateLocation = (): string => {
  const locations = [
    'New York, NY',
    'Los Angeles, CA',
    'Chicago, IL',
    'San Francisco, CA',
    'Seattle, WA',
    'Boston, MA',
    'Austin, TX',
    'London, UK',
    'Paris, France',
    'Berlin, Germany',
    'Tokyo, Japan',
    'Sydney, Australia',
    'Toronto, Canada',
    'Amsterdam, Netherlands',
    'Stockholm, Sweden'
  ]
  
  return locations[Math.floor(Math.random() * locations.length)]
}

export const generateWebsite = (companyName: string): string => {
  const domain = companyName.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')
  
  const tlds = ['com', 'io', 'tech', 'ai', 'co']
  const tld = tlds[Math.floor(Math.random() * tlds.length)]
  
  return `https://www.${domain}.${tld}`
}

export const generateBio = (name: string, company: string): string => {
  const templates = [
    `${name} is a passionate developer working at ${company}. Specializes in building scalable automation solutions.`,
    `Senior engineer at ${company} with expertise in AI and machine learning systems.`,
    `${name} leads the development team at ${company}, focusing on innovative pipeline automation.`,
    `Full-stack developer passionate about creating efficient workflow automation tools.`,
    `${name} is an experienced architect building next-generation automation platforms at ${company}.`,
    `Product manager at ${company} with a focus on user experience and automation workflows.`,
    `${name} combines technical expertise with creative problem-solving to build powerful automation tools.`
  ]
  
  return templates[Math.floor(Math.random() * templates.length)]
}