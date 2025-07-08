import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import { loadAllFixtures } from './fixtures'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  // Create admin user
  const adminPassword = await hash('admin123', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@imaginarium.dev' },
    update: {},
    create: {
      email: 'admin@imaginarium.dev',
      passwordHash: adminPassword,
      name: 'Admin User',
      firstName: 'Admin',
      lastName: 'User',
      bio: 'System administrator with full access to all features.',
      company: 'Imaginarium',
      timezone: 'UTC',
      role: 'ADMIN',
      emailVerified: true,
      maxPipelines: 100,
      maxExecutionsPerMonth: 10000,
    },
  })

  console.log('✅ Created admin user:', admin.email)

  // Create demo user
  const userPassword = await hash('demo123', 12)
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@imaginarium.dev' },
    update: {},
    create: {
      email: 'demo@imaginarium.dev',
      passwordHash: userPassword,
      name: 'Demo User',
      firstName: 'Demo',
      lastName: 'User',
      bio: 'Demo account for testing pipeline automation features.',
      company: 'Demo Corp',
      location: 'San Francisco, CA',
      timezone: 'America/Los_Angeles',
      role: 'EDITOR',
      emailVerified: true,
      emailOnPipelineComplete: true,
      emailOnPipelineError: true,
      emailOnWeeklyReport: false,
      maxPipelines: 25,
      maxExecutionsPerMonth: 500,
    },
  })

  console.log('✅ Created demo user:', demoUser.email)

  // Create sample pipeline
  const samplePipeline = await prisma.pipeline.upsert({
    where: { id: 'sample-pipeline-1' },
    update: {},
    create: {
      id: 'sample-pipeline-1',
      userId: demoUser.id,
      name: 'Sample Image Generator',
      description: 'A simple pipeline that generates an image from a text prompt',
      status: 'PUBLISHED',
      configuration: JSON.stringify({
        nodes: [
          {
            id: 'input-1',
            type: 'text-input',
            position: { x: 100, y: 100 },
            config: {
              label: 'Enter your prompt',
              placeholder: 'Describe the image you want to generate...',
            },
          },
          {
            id: 'ai-1',
            type: 'openai-image',
            position: { x: 400, y: 100 },
            config: {
              model: 'dall-e-3',
              size: '1024x1024',
              quality: 'standard',
            },
          },
          {
            id: 'output-1',
            type: 'image-output',
            position: { x: 700, y: 100 },
            config: {
              format: 'png',
            },
          },
        ],
        connections: [
          {
            id: 'conn-1',
            source: 'input-1',
            target: 'ai-1',
            sourceHandle: 'output',
            targetHandle: 'prompt',
          },
          {
            id: 'conn-2',
            source: 'ai-1',
            target: 'output-1',
            sourceHandle: 'image',
            targetHandle: 'input',
          },
        ],
      }),
      metadata: JSON.stringify({
        tags: ['ai', 'image-generation', 'openai'],
        category: 'content-creation',
        difficulty: 'beginner',
      }),
    },
  })

  console.log('✅ Created sample pipeline:', samplePipeline.name)

  // Create pipeline template
  const template = await prisma.pipelineTemplate.upsert({
    where: { id: 'template-image-gen' },
    update: {},
    create: {
      id: 'template-image-gen',
      pipelineId: samplePipeline.id,
      name: 'Image Generation Template',
      description: 'Template for creating AI-powered image generation pipelines',
      category: 'content-creation',
      isPublic: true,
      configuration: JSON.stringify({
        nodes: [
          {
            id: 'input-{{uuid}}',
            type: 'text-input',
            position: { x: 100, y: 100 },
            config: {
              label: '{{inputLabel}}',
              placeholder: '{{inputPlaceholder}}',
            },
          },
          {
            id: 'ai-{{uuid}}',
            type: '{{aiProvider}}-image',
            position: { x: 400, y: 100 },
            config: {
              model: '{{model}}',
              size: '{{imageSize}}',
              quality: '{{quality}}',
            },
          },
          {
            id: 'output-{{uuid}}',
            type: 'image-output',
            position: { x: 700, y: 100 },
            config: {
              format: '{{outputFormat}}',
            },
          },
        ],
        connections: [
          {
            id: 'conn-{{uuid}}',
            source: 'input-{{uuid}}',
            target: 'ai-{{uuid}}',
            sourceHandle: 'output',
            targetHandle: 'prompt',
          },
          {
            id: 'conn-{{uuid}}-2',
            source: 'ai-{{uuid}}',
            target: 'output-{{uuid}}',
            sourceHandle: 'image',
            targetHandle: 'input',
          },
        ],
      }),
      parameters: JSON.stringify({
        inputLabel: {
          type: 'string',
          default: 'Enter your prompt',
          description: 'Label for the input field',
        },
        inputPlaceholder: {
          type: 'string',
          default: 'Describe the image you want to generate...',
          description: 'Placeholder text for the input field',
        },
        aiProvider: {
          type: 'select',
          options: ['openai', 'stability', 'replicate'],
          default: 'openai',
          description: 'AI provider to use for image generation',
        },
        model: {
          type: 'string',
          default: 'dall-e-3',
          description: 'Model to use for generation',
        },
        imageSize: {
          type: 'select',
          options: ['512x512', '1024x1024', '1792x1024'],
          default: '1024x1024',
          description: 'Output image size',
        },
        quality: {
          type: 'select',
          options: ['standard', 'hd'],
          default: 'standard',
          description: 'Image quality',
        },
        outputFormat: {
          type: 'select',
          options: ['png', 'jpg', 'webp'],
          default: 'png',
          description: 'Output image format',
        },
      }),
    },
  })

  console.log('✅ Created pipeline template:', template.name)

  // Create provider credentials (placeholder - these would be encrypted in real use)
  const openaiCreds = await prisma.providerCredential.upsert({
    where: { id: 'openai-default' },
    update: {},
    create: {
      id: 'openai-default',
      name: 'OpenAI Default',
      provider: 'openai',
      credentials: JSON.stringify({
        apiKey: 'sk-placeholder-key-for-development',
      }),
      isDefault: true,
      isActive: true,
    },
  })

  console.log('✅ Created OpenAI credentials placeholder')

  // Create sample execution
  const execution = await prisma.pipelineRun.create({
    data: {
      pipelineId: samplePipeline.id,
      userId: demoUser.id,
      status: 'COMPLETED',
      inputs: JSON.stringify({
        'input-1': {
          text: 'A beautiful sunset over mountains',
        },
      }),
      outputs: JSON.stringify({
        'output-1': {
          imageUrl: 'https://example.com/generated-image.png',
          format: 'png',
          size: '1024x1024',
        },
      }),
      configuration: samplePipeline.configuration,
      duration: 15000, // 15 seconds
      tokensUsed: 150,
      estimatedCost: 0.04,
      startedAt: new Date(Date.now() - 20000),
      completedAt: new Date(Date.now() - 5000),
    },
  })

  console.log('✅ Created sample execution:', execution.id)

  // Create execution logs
  await prisma.executionLog.createMany({
    data: [
      {
        runId: execution.id,
        level: 'INFO',
        message: 'Pipeline execution started',
        timestamp: new Date(Date.now() - 20000),
      },
      {
        runId: execution.id,
        level: 'INFO',
        message: 'Processing input node: text-input',
        timestamp: new Date(Date.now() - 18000),
      },
      {
        runId: execution.id,
        level: 'INFO',
        message: 'Calling OpenAI DALL-E 3 API',
        timestamp: new Date(Date.now() - 15000),
      },
      {
        runId: execution.id,
        level: 'INFO',
        message: 'Image generated successfully',
        timestamp: new Date(Date.now() - 8000),
      },
      {
        runId: execution.id,
        level: 'INFO',
        message: 'Pipeline execution completed',
        timestamp: new Date(Date.now() - 5000),
      },
    ],
  })

  console.log('✅ Created execution logs')

  // Load fixture templates
  console.log('📦 Loading fixture templates...')
  const fixtureResults = await loadAllFixtures(prisma)
  const successCount = fixtureResults.filter(r => r.success).length
  const failureCount = fixtureResults.filter(r => !r.success).length
  console.log(`✅ Loaded ${successCount} fixture templates`)
  if (failureCount > 0) {
    console.log(`⚠️  Failed to load ${failureCount} fixture templates`)
  }

  console.log('🎉 Database seeding completed successfully!')
  console.log('')
  console.log('👤 Test accounts:')
  console.log('   Admin: admin@imaginarium.dev / admin123')
  console.log('   Demo:  demo@imaginarium.dev / demo123')
  console.log('')
  console.log('📦 Template fixtures:')
  console.log(`   Loaded ${successCount} pipeline templates`)
  console.log('')
  console.log('🔗 Run `npm run prisma:studio` to explore the database')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })