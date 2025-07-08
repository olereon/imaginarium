/**
 * Fixture loader for pipeline templates
 */

import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

interface TemplateFixture {
  id: string
  name: string
  description: string
  category: string
  isPublic: boolean
  configuration: Record<string, any>
  parameters: Record<string, any>
  usageCount: number
  tags: string[]
  difficulty: string
  estimatedTime: string
  cost: string
}

async function loadFixtures() {
  console.log('📦 Loading pipeline template fixtures...')

  const fixtureFiles = [
    'content-creation-templates.json',
    'data-analysis-templates.json',
    'workflow-automation-templates.json',
    'ai-integration-templates.json',
    'image-processing-templates.json'
  ]

  let totalLoaded = 0
  let totalSkipped = 0

  for (const file of fixtureFiles) {
    const filePath = join(__dirname, file)
    console.log(`📄 Loading ${file}...`)

    try {
      const fileContent = readFileSync(filePath, 'utf-8')
      const templates: TemplateFixture[] = JSON.parse(fileContent)

      for (const template of templates) {
        try {
          // Check if template already exists
          const existing = await prisma.pipelineTemplate.findUnique({
            where: { id: template.id }
          })

          if (existing) {
            console.log(`  ⏭️  Skipping ${template.name} (already exists)`)
            totalSkipped++
            continue
          }

          // Create the template
          await prisma.pipelineTemplate.create({
            data: {
              id: template.id,
              name: template.name,
              description: template.description,
              category: template.category,
              isPublic: template.isPublic,
              configuration: JSON.stringify(template.configuration),
              parameters: JSON.stringify(template.parameters),
              usageCount: template.usageCount,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          })

          console.log(`  ✅ Created ${template.name}`)
          totalLoaded++
        } catch (error) {
          console.error(`  ❌ Failed to create ${template.name}:`, error)
        }
      }
    } catch (error) {
      console.error(`❌ Failed to load ${file}:`, error)
    }
  }

  console.log('')
  console.log(`📊 Fixture loading complete:`)
  console.log(`   ✅ Loaded: ${totalLoaded} templates`)
  console.log(`   ⏭️  Skipped: ${totalSkipped} templates`)
  console.log('')
}

async function clearFixtures() {
  console.log('🧹 Clearing existing fixture templates...')
  
  const fixtureFiles = [
    'content-creation-templates.json',
    'data-analysis-templates.json',
    'workflow-automation-templates.json',
    'ai-integration-templates.json',
    'image-processing-templates.json'
  ]

  const fixtureIds: string[] = []

  for (const file of fixtureFiles) {
    const filePath = join(__dirname, file)
    try {
      const fileContent = readFileSync(filePath, 'utf-8')
      const templates: TemplateFixture[] = JSON.parse(fileContent)
      fixtureIds.push(...templates.map(t => t.id))
    } catch (error) {
      console.error(`❌ Failed to read ${file}:`, error)
    }
  }

  const deleted = await prisma.pipelineTemplate.deleteMany({
    where: {
      id: {
        in: fixtureIds
      }
    }
  })

  console.log(`🗑️  Deleted ${deleted.count} fixture templates`)
}

async function main() {
  const command = process.argv[2]

  switch (command) {
    case 'load':
      await loadFixtures()
      break
    case 'clear':
      await clearFixtures()
      break
    case 'reload':
      await clearFixtures()
      await loadFixtures()
      break
    default:
      console.log('Usage: tsx load-fixtures.ts [load|clear|reload]')
      console.log('')
      console.log('Commands:')
      console.log('  load   - Load fixture templates into database')
      console.log('  clear  - Remove fixture templates from database')
      console.log('  reload - Clear and reload all fixture templates')
      process.exit(1)
  }
}

main()
  .catch((error) => {
    console.error('❌ Fixture loading failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })