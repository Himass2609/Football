import { prisma } from '../lib/prisma.js';

export const settingRepository = {
  async get() {
    return (await prisma.systemSetting.findFirst({ orderBy: { id: 'asc' } })) ?? prisma.systemSetting.create({ data: {} });
  },

  async update(data) {
    const current = await this.get();
    return prisma.systemSetting.update({ where: { id: current.id }, data });
  },
};
