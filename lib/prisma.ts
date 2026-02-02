/**
 * Prisma Client Instance
 * Replaces Supabase client - provides database access via Prisma ORM
 */

import { PrismaClient } from '@prisma/client'

// Global variable to store Prisma client in development
// Prevents multiple instances during hot reload
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
