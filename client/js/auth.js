import { api } from './api.js';
import { clearSession, getUser, isLoggedIn, setSession, updateUser } from './auth-store.js';

export * from './auth-store.js';

const loginUrl = () => `/login.html?next=${encodeURIComponent(location.pathname + location.search)}`;

// Chỉ cho phép chuyển hướng nội bộ để tránh open redirect
export function safeNext(fallback = '/') {
  const next = new URLSearchParams(location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}

export async function login(credentials) {
  const { data } = await api.post('/auth/login', credentials);
  setSession(data);
  return data.user;
}

export async function register(payload) {
  const { data } = await api.post('/auth/register', payload);
  setSession(data);
  return data.user;
}

export async function logout(redirect = '/') {
  try {
    await api.post('/auth/logout');
  } finally {
    clearSession();
    location.href = redirect;
  }
}

// Đồng bộ lại quyền/trạng thái từ server (bị khóa, đổi vai trò...)
export async function refreshUser() {
  if (!isLoggedIn()) return null;
  try {
    const { data } = await api.get('/auth/me');
    const { profile, ...user } = data;
    updateUser(user);
    return { ...user, profile };
  } catch {
    return null;
  }
}

/** Bảo vệ trang: chưa đăng nhập → login; sai vai trò → về trang chủ */
export async function requireAuth({ role } = {}) {
  if (!isLoggedIn()) {
    location.replace(loginUrl());
    return null;
  }
  const user = await refreshUser();
  if (!user) {
    location.replace(loginUrl());
    return null;
  }
  if (role && user.role !== role) {
    location.replace('/');
    return null;
  }
  return user;
}

export const redirectIfLoggedIn = () => {
  const user = getUser();
  if (user) location.replace(safeNext(user.role === 'ADMIN' ? '/admin/' : '/'));
};

window.addEventListener('auth:expired', () => {
  if (document.body.dataset.protected !== undefined) location.replace(loginUrl());
});
