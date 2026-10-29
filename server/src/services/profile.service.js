import { accountRepository } from '../repositories/account.repository.js';
import { assertEmailAndPhoneAvailable } from './auth.service.js';

const toProfile = (account) => ({
  id: account.id,
  email: account.email,
  role: account.role.code,
  fullName: account.customer?.fullName ?? '',
  phone: account.customer?.phone ?? null,
  gender: account.customer?.gender ?? null,
  birthday: account.customer?.birthday ?? null,
  createdAt: account.createdAt,
  lastLogin: account.lastLogin,
});

export const profileService = {
  async get(accountId) {
    return toProfile(await accountRepository.findAuthById(accountId));
  },

  async update(accountId, data) {
    if (data.phone) await assertEmailAndPhoneAvailable({ phone: data.phone }, accountId);
    await accountRepository.updateProfile(accountId, data);
    return this.get(accountId);
  },
};
