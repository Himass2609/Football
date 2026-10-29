import { PrismaClient, Prisma } from '@prisma/client';
import { env } from '../config/env.js';

// Tiền lưu DECIMAL(12,0) → trả về number trong JSON thay vì chuỗi
Prisma.Decimal.prototype.toJSON = function toJSON() {
  return this.toNumber();
};

export const prisma = new PrismaClient({
  log: env.isDev ? ['warn', 'error'] : ['error'],
});
