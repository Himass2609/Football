import { GENDERS } from '../config/constants.js';
import { email, optionalPhone, password, phone, requiredText, z } from './common.js';

export const registerSchema = z.object({
  fullName: requiredText(100, 2),
  email,
  phone,
  password,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'), newPassword: password })
  .refine((d) => d.currentPassword !== d.newPassword, {
    path: ['newPassword'],
    message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
  });

const otp = z.string().trim().regex(/^\d{6}$/, 'Mã OTP gồm 6 chữ số');

export const forgotPasswordSchema = z.object({ email });
export const verifyOtpSchema = z.object({ email, otp });
export const resetPasswordSchema = z.object({ email, otp, newPassword: password });

export const updateProfileSchema = z.object({
  fullName: requiredText(100, 2),
  phone: optionalPhone,
  gender: z.enum(GENDERS).nullish(),
  birthday: z
    .union([z.coerce.date(), z.literal('').transform(() => null), z.null()])
    .optional()
    .refine((d) => !d || d < new Date(), 'Ngày sinh không hợp lệ'),
});
