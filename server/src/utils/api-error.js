export class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, code = 'BAD_REQUEST', details) {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(message = 'Vui lòng đăng nhập để tiếp tục', code = 'UNAUTHORIZED') {
    return new ApiError(401, code, message);
  }

  static forbidden(message = 'Bạn không có quyền thực hiện thao tác này', code = 'FORBIDDEN') {
    return new ApiError(403, code, message);
  }

  static notFound(message = 'Không tìm thấy dữ liệu', code = 'NOT_FOUND') {
    return new ApiError(404, code, message);
  }

  static conflict(message, code = 'CONFLICT', details) {
    return new ApiError(409, code, message, details);
  }

  static unprocessable(message, code = 'BUSINESS_RULE', details) {
    return new ApiError(422, code, message, details);
  }
}
