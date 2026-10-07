import { PrismaClient } from '@prisma/client';

// Una sola conexión para toda la API.
export const prisma = new PrismaClient();
