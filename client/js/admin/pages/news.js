import { api } from '../../api.js';
import { $, escapeHtml, formatDateTime, toast } from '../../ui.js';
import { createCrudPage, mainCell, optionsFrom } from '../crud.js';
import { mountAdmin } from '../shell.js';

const STATUS = {
  DRAFT: { label: 'Bản nháp', pill: 'pill-gray' },
  PUBLISHED: { label: 'Đã xuất bản', pill: 'pill-green' },
  ARCHIVED: { label: 'Lưu trữ', pill: 'pill-amber' },
};

// Hành động chuyển trạng thái hợp lệ (khớp NEWS_TRANSITIONS phía server)
const TRANSITIONS = {
  DRAFT: [{ to: 'PUBLISHED', icon: 'check-circle', label: 'Xuất bản' }],
  PUBLISHED: [
    { to: 'ARCHIVED', icon: 'layers', label: 'Lưu trữ' },
    { to: 'DRAFT', icon: 'rotate-ccw', label: 'Chuyển về nháp' },
  ],
  ARCHIVED: [{ to: 'PUBLISHED', icon: 'check-circle', label: 'Xuất bản lại' }],
};

if (await mountAdmin({ active: 'news', title: 'Tin tức' })) {
  $('[data-page-heading]').textContent = 'Tin tức';
  $('[data-page-desc]').textContent = 'Viết bài, gán chuyên mục và quản lý vòng đời: nháp → xuất bản → lưu trữ.';

  const { data: categories } = await api.get('/admin/news-categories', { limit: 100 });

  createCrudPage({
    endpoint: '/admin/news',
    label: 'bài viết',
    emptyIcon: 'newspaper',
    dialogSize: 'dialog-lg',
    searchPlaceholder: 'Tìm theo tiêu đề...',
    filters: [
      { name: 'status', label: 'Tất cả trạng thái', options: Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label })) },
      { name: 'categoryId', label: 'Tất cả chuyên mục', options: categories.map((c) => ({ value: c.id, label: c.name })) },
    ],
    columns: [
      { label: 'Bài viết', render: (n) => mainCell(n.title, n.categories.map((c) => c.name).join(', ') || 'Chưa phân loại') },
      { label: 'Tác giả', render: (n) => `<span class="cell-sub">${escapeHtml(n.authorName ?? '—')}</span>` },
      { label: 'Xuất bản', render: (n) => `<span class="cell-sub">${formatDateTime(n.publishedAt)}</span>` },
      { label: 'Trạng thái', render: (n) => `<span class="pill ${STATUS[n.status].pill}">${STATUS[n.status].label}</span>` },
    ],
    fields: [
      { name: 'title', label: 'Tiêu đề', required: true, maxlength: 200, span: true },
      { name: 'summary', label: 'Tóm tắt', type: 'textarea', rows: 2, maxlength: 500, span: true },
      { name: 'content', label: 'Nội dung', type: 'textarea', rows: 10, required: true, span: true, help: 'Văn bản thuần — mỗi đoạn cách nhau một dòng trống.' },
      { name: 'categoryIds', label: 'Chuyên mục', type: 'checkboxes', span: true, options: optionsFrom('/admin/news-categories'), get: (n) => n.categories?.map((c) => c.id) },
      { name: 'thumbnailUrl', label: 'Ảnh đại diện', type: 'image', span: true },
      {
        name: 'status',
        label: 'Trạng thái khi lưu',
        type: 'select',
        required: true,
        only: 'create',
        options: [
          { value: 'DRAFT', label: 'Lưu nháp' },
          { value: 'PUBLISHED', label: 'Xuất bản ngay' },
        ],
      },
    ],
    rowActions: (n) =>
      [
        ...(n.status === 'PUBLISHED' ? [{ key: 'view', icon: 'external-link', label: 'Xem trên website', run: () => {
          window.open(`/news-detail.html?slug=${encodeURIComponent(n.slug)}`, '_blank', 'noopener');
          return false;
        } }] : []),
        ...TRANSITIONS[n.status].map((t) => ({
          key: `status-${t.to}`,
          icon: t.icon,
          label: t.label,
          run: async (row) => {
            await api.patch(`/admin/news/${row.id}/status`, { status: t.to });
            toast(`Đã chuyển sang "${STATUS[t.to].label}"`, 'success');
          },
        })),
      ],
  });
}
