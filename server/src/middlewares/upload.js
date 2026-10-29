import crypto from 'node:crypto';
import path from 'node:path';
import multer from 'multer';
import { ApiError } from '../utils/api-error.js';

export const UPLOAD_DIR = path.resolve(import.meta.dirname, '../../uploads');

// Không nhận SVG để tránh XSS qua ảnh
const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif' };

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ALLOWED[file.mimetype]}`),
});

export const uploadImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) =>
    ALLOWED[file.mimetype] ? cb(null, true) : cb(ApiError.badRequest('Chỉ chấp nhận ảnh JPG, PNG, WEBP, AVIF', 'INVALID_FILE')),
});
