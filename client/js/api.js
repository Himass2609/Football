// Mọi lời gọi API đi qua đây: gắn JWT, chuẩn hóa lỗi, tự đăng xuất khi token hết hạn
import { clearSession, getToken } from './auth-store.js';

const BASE_URL = '/api/v1';

export class ApiError extends Error {
  constructor(status, { code = 'UNKNOWN', message = 'Đã có lỗi xảy ra', details = [] } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function buildUrl(path, query) {
  const url = new URL(BASE_URL + path, location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  }
  return url;
}

export async function request(path, { method = 'GET', body, query, signal } = {}) {
  const headers = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, { code: 'NETWORK_ERROR', message: 'Không thể kết nối máy chủ, vui lòng kiểm tra mạng' });
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    if (response.status === 401 && token) {
      clearSession();
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    throw new ApiError(response.status, payload?.error);
  }
  return { data: payload.data, meta: payload.meta };
}

export const api = {
  get: (path, query, options) => request(path, { ...options, query }),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
