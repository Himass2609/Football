import { prisma } from '../lib/prisma.js';

export const otpRepository = {
  create: (data) => prisma.otp.create({ data }),

  findLatest: (email, purpose) =>
    prisma.otp.findFirst({ where: { email, purpose }, orderBy: { createdAt: 'desc' } }),

  findLatestActive: (email, purpose) =>
    prisma.otp.findFirst({
      where: { email, purpose, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    }),

  incrementAttempts: (id) => prisma.otp.update({ where: { id }, data: { attempts: { increment: 1 } } }),

  invalidateAll: (email, purpose, tx = prisma) =>
    tx.otp.updateMany({ where: { email, purpose, usedAt: null }, data: { usedAt: new Date() } }),
};
