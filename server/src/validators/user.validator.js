import { ACCOUNT_STATUS } from '../config/constants.js';
import { email, id, listQuery, optionalPhone, password, requiredText, z } from './common.js';

export const userListQuery = listQuery.extend({
  roleId: id.optional(),
  status: z.enum(Object.values(ACCOUNT_STATUS)).optional(),
});

export const createUserSchema = z.object({
  email,
  password,
  fullName: requiredText(100, 2),
  phone: optionalPhone,
  roleId: id,
});

export const updateUserSchema = z.object({
  email: email.optional(),
  fullName: requiredText(100, 2).optional(),
  phone: optionalPhone,
});

export const userStatusSchema = z.object({ status: z.enum(Object.values(ACCOUNT_STATUS)) });
export const userRoleSchema = z.object({ roleId: id });
export const resetUserPasswordSchema = z.object({ password });
