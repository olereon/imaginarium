import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

/**
 * Instantiate Prisma Client
 * 
 * In development, we store the client in a global variable to prevent
 * creating multiple instances due to hot reloading.
 * 
 * In production, we create a single instance.
 */
export const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
})

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}

// Gracefully shutdown Prisma Client
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})