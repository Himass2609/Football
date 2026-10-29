import { api } from '../../api.js';
import { $, confirmDialog, formatDateTime, toast } from '../../ui.js';
import { createCrudPage, mainCell, openFormDialog } from '../crud.js';
import { mountAdmin } from '../shell.js';

const me = await mountAdmin({ active: 'users', title: 'Tài khoản' });

if (me) {
  $('[data-page-heading]').textContent = 'Tài khoản';
  $('[data-page-desc]').textContent = 'Quản lý khách hàng và quản trị viên: thông tin, vai trò, trạng thái đăng nhập.';

  const { data: roles } = await api.get('/admin/roles');
  const roleOptions = roles.map((r) => ({ value: r.id, label: r.name }));
  const rolePill = (role) =>
    role.code === 'ADMIN' ? '<span class="pill pill-violet">Quản trị</span>' : `<span class="pill pill-blue">${role.name}</span>`;

  createCrudPage({
    endpoint: '/admin/users',
    label: 'tài khoản',
    emptyIcon: 'users',
    searchPlaceholder: 'Tìm theo tên, email, số điện thoại...',
    filters: [
      { name: 'roleId', label: 'Tất cả vai trò', options: roleOptions },
      {
        name: 'status',
        label: 'Tất cả trạng thái',
        options: [
          { value: 'ACTIVE', label: 'Hoạt động' },
          { value: 'LOCKED', label: 'Đã khóa' },
        ],
      },
    ],
    columns: [
      { label: 'Người dùng', render: (u) => mainCell(u.fullName || '—', u.email) },
      { label: 'Số điện thoại', render: (u) => u.phone ?? '<span class="cell-sub">—</span>' },
      { label: 'Vai trò', render: (u) => rolePill(u.role) },
      { label: 'Trạng thái', render: (u) => (u.status === 'ACTIVE' ? '<span class="pill pill-green">Hoạt động</span>' : '<span class="pill pill-red">Đã khóa</span>') },
      { label: 'Đăng nhập gần nhất', render: (u) => `<span class="cell-sub">${formatDateTime(u.lastLogin)}</span>` },
    ],
    fields: [
      { name: 'fullName', label: 'Họ và tên', required: true, maxlength: 100 },
      { name: 'email', label: 'Email', type: 'email', required: true, maxlength: 100 },
      { name: 'phone', label: 'Số điện thoại', type: 'tel', placeholder: '09xxxxxxxx' },
      { name: 'roleId', label: 'Vai trò', type: 'select', numeric: true, required: true, options: roleOptions, get: (u) => u.role?.id },
      { name: 'password', label: 'Mật khẩu', type: 'password', required: true, only: 'create', span: true, help: 'Tối thiểu 8 ký tự, gồm chữ và số.' },
    ],
    // Sửa thông tin và đổi vai trò là hai API riêng (đổi vai trò có kiểm tra nghiệp vụ)
    save: async ({ roleId, ...payload }, row) => {
      if (!row) return (await api.post('/admin/users', { ...payload, roleId })).data;
      let user = (await api.put(`/admin/users/${row.id}`, payload)).data;
      if (roleId !== row.role.id) user = (await api.patch(`/admin/users/${row.id}/role`, { roleId })).data;
      return user;
    },
    rowActions: (u) =>
      u.id === me.id
        ? []
        : [
            {
              key: 'toggle-lock',
              icon: u.status === 'ACTIVE' ? 'lock' : 'unlock',
              label: u.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa',
              run: async (row) => {
                const locking = row.status === 'ACTIVE';
                const ok = await confirmDialog({
                  title: locking ? 'Khóa tài khoản' : 'Mở khóa tài khoản',
                  message: locking ? `${row.email} sẽ không thể đăng nhập cho đến khi được mở khóa.` : `Cho phép ${row.email} đăng nhập trở lại?`,
                  confirmText: locking ? 'Khóa' : 'Mở khóa',
                  danger: locking,
                });
                if (!ok) return false;
                await api.patch(`/admin/users/${row.id}/status`, { status: locking ? 'LOCKED' : 'ACTIVE' });
                toast(locking ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản', 'success');
              },
            },
            {
              key: 'reset-password',
              icon: 'key',
              label: 'Đặt lại mật khẩu',
              run: async (row) => {
                const done = await openFormDialog({
                  title: `Đặt lại mật khẩu — ${row.email}`,
                  submitLabel: 'Đặt lại',
                  fields: [{ name: 'password', label: 'Mật khẩu mới', type: 'password', required: true, span: true, help: 'Tối thiểu 8 ký tự, gồm chữ và số.' }],
                  submit: async ({ password }) => {
                    await api.patch(`/admin/users/${row.id}/password`, { password });
                    return true;
                  },
                });
                if (done) toast('Đã đặt lại mật khẩu', 'success');
                return false;
              },
            },
          ],
  });
}
