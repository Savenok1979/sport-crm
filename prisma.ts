import { PrismaClient } from "@prisma/client";

// Single shared Prisma instance. In dev with ts-node-dev's hot reload,
// attach to globalThis to avoid exhausting DB connections on each reload.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma = global.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") global.__prisma = prisma;
