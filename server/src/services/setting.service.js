import { settingRepository } from '../repositories/setting.repository.js';

const toPublic = ({ id, updatedAt, ...setting }) => setting;

export const settingService = {
  get: async () => toPublic(await settingRepository.get()),
  update: async (data) => toPublic(await settingRepository.update(data)),
};
