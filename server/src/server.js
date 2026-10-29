import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';

const server = app.listen(env.port, () => {
  console.info(`JERSEY API đang chạy tại ${env.appUrl} (${env.nodeEnv})`);
});

const shutdown = async (signal) => {
  console.info(`${signal} — đang tắt server...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
