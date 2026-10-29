// Dialog nhập / điều chỉnh tồn kho một biến thể — dùng ở trang Tồn kho và trang sửa sản phẩm
import { api } from '../api.js';
import { toast } from '../ui.js';
import { openFormDialog } from './crud.js';

/** @returns {Promise<object|null>} biến thể sau cập nhật, null nếu hủy */
export async function openAdjustStock(variant) {
  const saved = await openFormDialog({
    title: `Điều chỉnh kho — ${variant.sku}`,
    submitLabel: 'Cập nhật',
    initial: { mode: 'add' },
    fields: [
      {
        name: 'mode',
        label: 'Cách cập nhật',
        type: 'select',
        required: true,
        options: [
          { value: 'add', label: 'Nhập thêm / bớt (+/-)' },
          { value: 'set', label: 'Đặt lại số tồn (kiểm kê)' },
        ],
      },
      { name: 'quantity', label: `Số lượng (hiện có ${variant.stockQuantity})`, type: 'number', required: true, min: -100000, help: 'Chế độ +/-: số âm để giảm kho (hàng lỗi, thất lạc).' },
      { name: 'note', label: 'Ghi chú', span: true, maxlength: 255, placeholder: 'VD: Nhập lô tháng 11' },
    ],
    submit: async (values) => (await api.post(`/admin/inventory/${variant.id}/adjust`, values)).data,
  });
  if (saved) toast(`Tồn kho ${variant.sku}: ${variant.stockQuantity} → ${saved.stockQuantity}`, 'success');
  return saved;
}
