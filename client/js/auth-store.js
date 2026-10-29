// Lưu phiên đăng nhập (JWT + thông tin user tối thiểu) ở localStorage
const KEY = 'jersey.session';

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? null;
  } catch {
    return null;
  }
}

export const getSession = read;
export const getToken = () => read()?.token ?? null;
export const getUser = () => read()?.user ?? null;
export const isLoggedIn = () => Boolean(getToken());
export const isAdmin = () => getUser()?.role === 'ADMIN';

export function setSession({ token, user }) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ token, user }));
  } catch {
    /* trình duyệt chặn storage: phiên chỉ tồn tại trong tab hiện tại */
  }
  window.dispatchEvent(new CustomEvent('auth:change'));
}

export function updateUser(patch) {
  const session = read();
  if (session) setSession({ ...session, user: { ...session.user, ...patch } });
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* bỏ qua */
  }
  window.dispatchEvent(new CustomEvent('auth:change'));
}
