import { authService } from '../services/auth.service.js';
import { profileService } from '../services/profile.service.js';
import { created, noContent, ok } from '../utils/response.js';

export const authController = {
  register: async (req, res) => created(res, await authService.register(req.valid.body)),

  login: async (req, res) => ok(res, await authService.login(req.valid.body)),

  // JWT stateless: client tự xóa token, server chỉ xác nhận
  logout: (_req, res) => noContent(res),

  me: async (req, res) => ok(res, { ...req.user, profile: await profileService.get(req.user.id) }),

  changePassword: async (req, res) => {
    await authService.changePassword(req.user.id, req.valid.body);
    noContent(res);
  },

  forgotPassword: async (req, res) => {
    await authService.forgotPassword(req.valid.body);
    ok(res, { message: 'Nếu email tồn tại trong hệ thống, mã OTP đã được gửi đến hộp thư của bạn.' });
  },

  verifyOtp: async (req, res) => {
    await authService.verifyOtp(req.valid.body);
    ok(res, { valid: true });
  },

  resetPassword: async (req, res) => {
    await authService.resetPassword(req.valid.body);
    noContent(res);
  },
};

export const profileController = {
  get: async (req, res) => ok(res, await profileService.get(req.user.id)),
  update: async (req, res) => ok(res, await profileService.update(req.user.id, req.valid.body)),
};
