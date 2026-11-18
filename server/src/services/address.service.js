import { MAX_ADDRESSES } from '../config/constants.js';
import { prisma } from '../lib/prisma.js';
import { addressRepository } from '../repositories/address.repository.js';
import { ApiError } from '../utils/api-error.js';

export const formatAddress = (a) => [a.line, a.ward, a.district, a.province].filter(Boolean).join(', ');

async function findOwnedOrThrow(customerId, id) {
  const address = await addressRepository.findOwned(customerId, id);
  if (!address) throw ApiError.notFound('Không tìm thấy địa chỉ');
  return address;
}

export const addressService = {
  list: (customerId) => addressRepository.list(customerId),

  async create(customerId, data) {
    const count = await addressRepository.count(customerId);
    if (count >= MAX_ADDRESSES) throw ApiError.unprocessable(`Sổ địa chỉ tối đa ${MAX_ADDRESSES} địa chỉ`, 'ADDRESS_LIMIT');
    // Địa chỉ đầu tiên luôn là mặc định
    const isDefault = count === 0 || Boolean(data.isDefault);
    return prisma.$transaction(async (tx) => {
      if (isDefault) await addressRepository.clearDefault(customerId, tx);
      return addressRepository.create({ ...data, customerId, isDefault }, tx);
    });
  },

  async update(customerId, id, data) {
    const current = await findOwnedOrThrow(customerId, id);
    // Không cho bỏ mặc định trực tiếp — muốn đổi thì đặt địa chỉ khác làm mặc định
    const patch = { ...data, isDefault: current.isDefault || Boolean(data.isDefault) };
    return prisma.$transaction(async (tx) => {
      if (patch.isDefault && !current.isDefault) await addressRepository.clearDefault(customerId, tx);
      return addressRepository.update(id, patch, tx);
    });
  },

  async remove(customerId, id) {
    const current = await findOwnedOrThrow(customerId, id);
    await addressRepository.remove(id);
    // Xóa địa chỉ mặc định → chọn địa chỉ mới nhất còn lại làm mặc định
    if (current.isDefault) {
      const next = await addressRepository.findLatest(customerId);
      if (next) await addressRepository.update(next.id, { isDefault: true });
    }
  },

  findOwnedOrThrow,
};
