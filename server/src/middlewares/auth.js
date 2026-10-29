import { ACCOUNT_STATUS } from '../config/constants.js';
import { accountRepository } from '../repositories/account.repository.js';
import { ApiError } from '../utils/api-error.js';
import { verifyToken } from '../utils/token.js';

const extractToken = (req) => {
  const header = req.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
};

export const toAuthUser = (account) => ({
  id: account.id,
  email: account.email,
  role: account.role.code,
  permissions: account.role.permissions.map((rp) => rp.permission.code),
  customerId: account.customer?.id ?? null,
  fullName: account.customer?.fullName ?? account.email,
});

async function resolveUser(token) {
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw ApiError.unauthorized('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại', 'INVALID_TOKEN');
  }
  if (payload.purpose) throw ApiError.unauthorized('Token không hợp lệ', 'INVALID_TOKEN');

  const account = await accountRepository.findAuthById(payload.sub);
  if (!account || account.deletedAt) throw ApiError.unauthorized('Tài khoản không tồn tại', 'INVALID_TOKEN');
  if (account.status === ACCOUNT_STATUS.LOCKED) throw ApiError.forbidden('Tài khoản đã bị khóa', 'ACCOUNT_LOCKED');
  return toAuthUser(account);
}

export async function authenticate(req, _res, next) {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized();
  req.user = await resolveUser(token);
  next();
}

// Dùng cho API công khai nhưng trả thêm dữ liệu khi đã đăng nhập
export async function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  if (token) {
    try {
      req.user = await resolveUser(token);
    } catch {
      req.user = null;
    }
  }
  next();
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) throw ApiError.unauthorized();
  if (!roles.includes(req.user.role)) throw ApiError.forbidden();
  next();
};

export const requirePermission = (...codes) => (req, _res, next) => {
  if (!req.user) throw ApiError.unauthorized();
  if (!codes.every((code) => req.user.permissions.includes(code))) throw ApiError.forbidden();
  next();
};
