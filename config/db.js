require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

// Create PrismaClient without options - it will read from prisma.config.ts
const prisma = new PrismaClient();

module.exports = prisma;