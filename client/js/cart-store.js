// Giỏ hàng phía client: chỉ giữ số lượng để hiện badge — dữ liệu thật luôn lấy từ server
import { api } from './api.js';
import { isLoggedIn } from './auth-store.js';

const loginUrl = (next = location.pathname + location.search) => `/login.html?next=${encodeURIComponent(next)}`;

// Phát sự kiện để header (và trang nào cần) cập nhật số lượng
export function emitCart(cart) {
  window.dispatchEvent(new CustomEvent('cart:change', { detail: { count: cart?.itemCount ?? 0 } }));
}

export async function refreshCartCount() {
  if (!isLoggedIn()) return emitCart(null);
  try {
    const { data } = await api.get('/cart');
    emitCart(data);
  } catch {
    /* badge không quan trọng — bỏ qua lỗi */
  }
}

/** Thêm vào giỏ. Khách chưa đăng nhập → chuyển sang trang đăng nhập rồi quay lại. */
export async function addToCart(variantId, quantity = 1) {
  if (!isLoggedIn()) {
    location.href = loginUrl();
    return null;
  }
  const { data } = await api.post('/cart/items', { variantId, quantity });
  emitCart(data);
  return data;
}
