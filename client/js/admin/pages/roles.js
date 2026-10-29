import { api } from '../../api.js';
import { $, $$, emptyState, html, raw, setLoading, toast } from '../../ui.js';
import { mountAdmin } from '../shell.js';

const MODULE_LABEL = { admin: 'Quản trị', customer: 'Khách hàng' };

if (await mountAdmin({ active: 'roles', title: 'Vai trò & quyền' })) render();

async function render() {
  const root = $('[data-roles]');
  try {
    const [{ data: roles }, { data: permissions }] = await Promise.all([api.get('/admin/roles'), api.get('/admin/permissions')]);
    const modules = [...new Set(permissions.map((p) => p.module))];

    root.innerHTML = roles
      .map((role) => {
        const locked = role.code === 'ADMIN';
        const granted = new Set(role.permissions);
        return html`
          <form class="card mb-4" data-role="${role.id}">
            <div class="card-head">
              <div>
                <h2 class="card-title">${role.name} <code class="cell-sub ms-2">${role.code}</code></h2>
                <p class="cell-sub mt-1">${role.description ?? ''} · ${role.accountCount} tài khoản</p>
              </div>
              ${locked
                ? raw('<span class="pill pill-violet">Toàn quyền — không thể chỉnh</span>')
                : raw('<button class="btn btn-dark btn-sm" type="submit" data-loading-text="Đang lưu...">Lưu phân quyền</button>')}
            </div>
            <div class="card-body">
              ${modules.map((module) =>
                raw(html`<div class="perm-group">
                  <p class="eyebrow">${MODULE_LABEL[module] ?? module}</p>
                  <div class="perm-grid">
                    ${permissions
                      .filter((p) => p.module === module)
                      .map((p) =>
                        raw(html`<label class="perm-item">
                          <input type="checkbox" name="permission" value="${p.id}" ${granted.has(p.code) ? raw('checked') : ''} ${locked ? raw('disabled') : ''}>
                          <span>${p.name}<code>${p.code}</code></span>
                        </label>`),
                      )}
                  </div>
                </div>`),
              )}
            </div>
          </form>`;
      })
      .join('');

    $$('form[data-role]', root).forEach((form) =>
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = $('[type="submit"]', form);
        const permissionIds = $$('input[name="permission"]:checked', form).map((cb) => Number(cb.value));
        setLoading(button, true);
        try {
          await api.put(`/admin/roles/${form.dataset.role}/permissions`, { permissionIds });
          toast('Đã lưu phân quyền', 'success');
        } catch (err) {
          toast(err.message, 'error');
        } finally {
          setLoading(button, false);
        }
      }),
    );
  } catch (err) {
    root.innerHTML = `<div class="card">${emptyState('alert-circle', 'Không tải được vai trò', err.message)}</div>`;
  }
}
