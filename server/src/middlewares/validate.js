import { ApiError } from '../utils/api-error.js';

// Express 5: req.query chỉ đọc → dữ liệu đã parse được đặt ở req.valid
export const validate = (schemas) => (req, _res, next) => {
  req.valid = req.valid ?? {};
  for (const key of ['params', 'query', 'body']) {
    if (!schemas[key]) continue;
    const result = schemas[key].safeParse(req[key] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      throw ApiError.badRequest(details[0]?.message ?? 'Dữ liệu không hợp lệ', 'VALIDATION_ERROR', details);
    }
    req.valid[key] = result.data;
  }
  next();
};
