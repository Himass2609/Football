import { Prisma } from '@prisma/client';
import multer from 'multer';
import { env } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';

const send = (res, status, code, message, details = []) =>
  res.status(status).json({ success: false, error: { code, message, details } });

export function notFoundHandler(req, res) {
  send(res, 404, 'ROUTE_NOT_FOUND', `Không tìm thấy API ${req.method} ${req.originalUrl}`);
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) return send(res, err.status, err.code, err.message, err.details);

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // SQL Server chỉ trả tên bảng, không có tên cột → service tự kiểm tra trùng để báo đúng trường
    if (err.code === 'P2002') return send(res, 409, 'DUPLICATE', 'Giá trị đã tồn tại trong hệ thống');
    if (err.code === 'P2025') return send(res, 404, 'NOT_FOUND', 'Không tìm thấy dữ liệu');
    if (err.code === 'P2003') return send(res, 409, 'IN_USE', 'Dữ liệu đang được sử dụng ở nơi khác');
  }

  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Ảnh vượt quá dung lượng cho phép (5MB)' : 'Tải tệp thất bại';
    return send(res, 400, 'UPLOAD_ERROR', message);
  }

  if (err.type === 'entity.parse.failed') return send(res, 400, 'INVALID_JSON', 'Dữ liệu JSON không hợp lệ');

  console.error(err);
  return send(res, 500, 'INTERNAL_ERROR', env.isDev ? err.message : 'Đã có lỗi xảy ra, vui lòng thử lại sau');
}
