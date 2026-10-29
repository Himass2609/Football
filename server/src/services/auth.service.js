import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { ACCOUNT_STATUS, OTP, ROLES } from '../config/constants.js';
import { prisma } from '../lib/prisma.js';
import { sendMail } from '../lib/mailer.js';
import { toAuthUser } from '../middlewares/auth.js';
import { accountRepository } from '../repositories/account.repository.js';
import { otpRepository } from '../repositories/otp.repository.js';
import { roleRepository } from '../repositories/role.repository.js';
import { ApiError } from '../utils/api-error.js';
import { signAccessToken } from '../utils/token.js';

const BCRYPT_ROUNDS = 10;
const RESET_PURPOSE = 'RESET_PASSWORD';
// So sánh với hash giả khi email không tồn tại để thời gian phản hồi như nhau
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_ROUNDS);

export const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS);

const authResult = (account) => ({ token: signAccessToken(account), user: toAuthUser(account) });

export async function assertEmailAndPhoneAvailable({ email, phone }, excludeAccountId) {
  if (email) {
    const existing = await accountRepository.findByEmail(email);
    if (existing && existing.id !== excludeAccountId) {
      throw ApiError.conflict('Email đã được sử dụng', 'EMAIL_EXISTS', [{ field: 'email', message: 'Email đã được sử dụng' }]);
    }
  }
  if (phone && (await accountRepository.findActiveByPhone(phone, excludeAccountId))) {
    throw ApiError.conflict('Số điện thoại đã được sử dụng', 'PHONE_EXISTS', [{ field: 'phone', message: 'Số điện thoại đã được sử dụng' }]);
  }
}

export const authService = {
  async register({ fullName, email, phone, password }) {
    await assertEmailAndPhoneAvailable({ email, phone });
    const role = await roleRepository.findByCode(ROLES.CUSTOMER);
    const account = await accountRepository.createWithProfile({
      email,
      phone,
      fullName,
      roleId: role.id,
      passwordHash: await hashPassword(password),
      withCart: true,
    });
    return authResult(account);
  },

  async login({ email, password }) {
    const account = await accountRepository.findAuthByEmail(email);
    const valid = await bcrypt.compare(password, account?.passwordHash ?? DUMMY_HASH);
    if (!account || account.deletedAt || !valid) {
      throw ApiError.unauthorized('Email hoặc mật khẩu không chính xác', 'INVALID_CREDENTIALS');
    }
    if (account.status === ACCOUNT_STATUS.LOCKED) {
      throw ApiError.forbidden('Tài khoản đã bị khóa, vui lòng liên hệ cửa hàng', 'ACCOUNT_LOCKED');
    }
    await prisma.account.update({ where: { id: account.id }, data: { lastLogin: new Date() } });
    return authResult(account);
  },

  async changePassword(accountId, { currentPassword, newPassword }) {
    const account = await accountRepository.findAuthById(accountId);
    if (!(await bcrypt.compare(currentPassword, account.passwordHash))) {
      throw ApiError.badRequest('Mật khẩu hiện tại không đúng', 'WRONG_PASSWORD', [
        { field: 'currentPassword', message: 'Mật khẩu hiện tại không đúng' },
      ]);
    }
    await prisma.account.update({ where: { id: accountId }, data: { passwordHash: await hashPassword(newPassword) } });
  },

  // Luôn trả về thành công để không lộ email nào đã đăng ký
  async forgotPassword({ email }) {
    const account = await accountRepository.findByEmail(email);
    if (!account || account.deletedAt || account.status === ACCOUNT_STATUS.LOCKED) return;

    const latest = await otpRepository.findLatest(email, RESET_PURPOSE);
    if (latest && Date.now() - latest.createdAt.getTime() < OTP.RESEND_SECONDS * 1000) return;

    const code = crypto.randomInt(0, 10 ** OTP.LENGTH).toString().padStart(OTP.LENGTH, '0');
    await otpRepository.invalidateAll(email, RESET_PURPOSE);
    await otpRepository.create({
      email,
      purpose: RESET_PURPOSE,
      codeHash: await bcrypt.hash(code, BCRYPT_ROUNDS),
      expiresAt: new Date(Date.now() + OTP.TTL_MINUTES * 60 * 1000),
    });

    await sendMail({
      to: email,
      subject: 'Mã xác thực đặt lại mật khẩu — JERSEY',
      text: `Mã OTP của bạn là ${code}. Mã có hiệu lực trong ${OTP.TTL_MINUTES} phút.`,
      html: `<p>Mã OTP đặt lại mật khẩu của bạn:</p><p style="font-size:28px;font-weight:800;letter-spacing:6px">${code}</p><p>Mã có hiệu lực trong ${OTP.TTL_MINUTES} phút. Nếu không phải bạn yêu cầu, hãy bỏ qua email này.</p>`,
    });
  },

  async verifyOtp({ email, otp }) {
    const record = await otpRepository.findLatestActive(email, RESET_PURPOSE);
    if (!record) throw ApiError.badRequest('Mã OTP không hợp lệ hoặc đã hết hạn', 'OTP_INVALID');
    if (record.attempts >= OTP.MAX_ATTEMPTS) {
      throw ApiError.badRequest('Bạn đã nhập sai quá nhiều lần, vui lòng yêu cầu mã mới', 'OTP_LOCKED');
    }
    if (!(await bcrypt.compare(otp, record.codeHash))) {
      await otpRepository.incrementAttempts(record.id);
      const remaining = OTP.MAX_ATTEMPTS - record.attempts - 1;
      throw ApiError.badRequest(
        remaining > 0 ? `Mã OTP không đúng, còn ${remaining} lần thử` : 'Bạn đã nhập sai quá nhiều lần, vui lòng yêu cầu mã mới',
        remaining > 0 ? 'OTP_INVALID' : 'OTP_LOCKED',
      );
    }
    return record;
  },

  async resetPassword({ email, otp, newPassword }) {
    await this.verifyOtp({ email, otp });
    const passwordHash = await hashPassword(newPassword);
    await prisma.$transaction(async (tx) => {
      await tx.account.update({ where: { email }, data: { passwordHash } });
      await otpRepository.invalidateAll(email, RESET_PURPOSE, tx);
    });
  },
};
