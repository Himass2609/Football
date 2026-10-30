# CLAUDE.md — Website Bán Đồ Bóng Đá (JERSEY)

Đồ án Chuyên đề Tổng hợp — Nhóm 26, lớp 68PM2, ĐH Xây dựng Hà Nội (GVHD: ThS. Phan Hữu Tùng).
Tài liệu nguồn: `buoi1_cdth.docx` (khảo sát + proposal + thiết kế DB + use case). Ảnh tham chiếu UI: `ff.png`.

Khi có mâu thuẫn: **nghiệp vụ theo docx**, **giao diện theo ff.png + phần Design System bên dưới**, **kỹ thuật theo file này**.

---

## 1. Tổng quan

Website thương mại điện tử bán quần áo bóng đá (áo CLB, áo đội tuyển, quần, bộ, đồ trẻ em, phụ kiện).
Chuỗi nghiệp vụ cốt lõi:

```
Search → Product Detail → Chọn Variant (Size + Color) → Cart → Checkout → Order → Payment → Tracking → Review
```

### Actor & RBAC
| Role | Quyền |
|---|---|
| `GUEST` | Xem/tìm/lọc sản phẩm, xem Category/Brand/Team/khuyến mãi, đăng ký, đăng nhập |
| `CUSTOMER` | + Profile, địa chỉ, Cart, đặt hàng, thanh toán, lịch sử & theo dõi đơn, hủy đơn (theo điều kiện), review sau khi nhận hàng |
| `ADMIN` | Quản trị User, Role, Category, Brand, Team, League, Size, Color, Product, Variant, Image, Inventory, Promotion/Voucher, Order, Customer, Review, News, Dashboard |

Phân quyền kiểm tra **ở backend** (middleware), frontend chỉ ẩn/hiện UI.

---

## 2. Tech stack

| Lớp | Công nghệ |
|---|---|
| Frontend | HTML5, CSS3, JavaScript thuần (ES Modules), Bootstrap 5 **chỉ dùng grid + utilities** — mọi style còn lại dùng design tokens tự viết |
| Backend | Node.js (LTS) + Express.js, REST API |
| ORM | Prisma (provider `sqlserver`) — *docx ghi JPA/Hibernate nhưng đó là stack Java, không dùng được với Node* |
| Database | Microsoft SQL Server |
| Auth | JWT (access token) + bcrypt hash mật khẩu, OTP qua email cho quên mật khẩu |
| Validation | zod (hoặc express-validator) |
| Upload ảnh | multer, lưu `server/uploads/` (dev) |
| Quản lý | Git/GitHub, Jira (Sprint), Draw.io (UML) |

Không tự ý thêm framework frontend (React/Vue/Tailwind) — đề tài yêu cầu HTML/CSS/JS.

---

## 3. Cấu trúc thư mục

```
/client                       # Frontend tĩnh, Express phục vụ tại "/"
  /assets/img                 # favicon.svg...
  /css
    tokens.css                # biến màu, font, spacing, radius, shadow — NGUỒN DUY NHẤT
    base.css                  # reset, typography, .display, .eyebrow, .section
    components.css            # button, badge, pill, input, card, toast, dialog, table, pagination, chip, tabs, alert
    layout.css                # topbar, header, mega menu, drawer, page-banner, footer
    pages/{home,auth,account,news,admin}.css
  /js
    api.js  auth-store.js  auth.js   # gọi API (gắn JWT, chuẩn hóa lỗi) · phiên đăng nhập · bảo vệ trang
    ui.js                     # icon(), html`` (tự escape), toast, form errors, confirmDialog, pagination
    layout.js                 # header/footer/drawer — initPage() cho mọi trang storefront
    icons-auto.js             # data-icon / data-icon-after trong HTML
    jersey.js                 # vẽ áo SVG theo màu đội (ảnh minh họa khi chưa có ảnh thật)
    news-card.js  auth-page.js
    product-card.js           # thẻ sản phẩm, priceHtml(), productArt() (áo minh họa theo màu đội/biến thể)
    /pages/*.js               # 1 file / trang storefront
    /admin/shell.js           # khung admin + guard ADMIN
    /admin/crud.js            # createCrudPage(), openFormDialog() — CRUD khai báo bằng config
    /admin/marketing.js       # phần chung khuyến mãi/voucher
    /admin/product-fields.js  # trường form sản phẩm dùng chung (dialog tạo + tab Thông tin)
    /admin/stock.js           # dialog nhập / điều chỉnh kho
    /admin/pages/*.js         # 1 file / trang admin
  index.html  products.html  cart.html  login.html  register.html  forgot-password.html
  account.html  news.html  news-detail.html  product.html  404.html
  /admin/{index,users,roles,products,product-edit,inventory,master-data,promotions,vouchers,news,settings}.html
        # master-data.html?entity=categories|brands|leagues|teams|product-types|sizes|colors|news-categories
/server
  /src
    /config                   # env.js (đọc .env), constants.js (trạng thái, PERMISSIONS, OTP...)
    /lib                      # prisma.js (Decimal → number khi trả JSON), mailer.js
    /routes                   # auth, public, admin (mountCrud cho bộ route chuẩn)
    /controllers              # nhận req, gọi service, trả res — KHÔNG chứa business logic
    /services                 # business logic, transaction
    /repositories             # truy cập DB qua Prisma (crud.repository dùng chung)
    /middlewares              # auth (authenticate/requireRole/requirePermission), validate, upload, error-handler
    /validators               # schema zod (thông báo lỗi tiếng Việt cấu hình ở common.js)
    /utils                    # ApiError, response, pagination, slugify, token
    app.js  server.js
  /prisma/schema.prisma  /prisma/migrations  /prisma/seed.js
  /uploads                    # ảnh admin tải lên (không commit)
  .env.example
/docs                         # UML, ERD, ảnh chụp màn hình
```

Luồng bắt buộc: `Route → Controller → Service → Repository → DB`. Controller không gọi Prisma trực tiếp.

### Ghi chú kỹ thuật đã chốt
- **Express 5**: lỗi async tự chuyển tới error handler (không cần asyncHandler). `req.query` chỉ đọc → dữ liệu đã validate nằm ở `req.valid.{body,query,params}`.
- **Prisma 6 + SQL Server**: không có enum → trạng thái là `VarChar` + hằng số trong `constants.js`; quan hệ để `onDelete/onUpdate: NoAction` (SQL Server cấm nhiều đường cascade). Lỗi trùng `P2002` không trả tên cột → service tự kiểm tra trùng để báo đúng trường.
- **Cột nullable không đặt `@unique`** (SQL Server chỉ cho 1 NULL) — ví dụ SĐT kiểm tra trùng ở service.
- **RBAC**: route admin = `authenticate + requireRole('ADMIN') + requirePermission(P.XXX)`. Thêm quyền mới → khai báo trong `PERMISSIONS` rồi chạy lại seed.
- **XSS**: frontend dựng HTML bằng tagged template `html\`\`` (tự escape); chỉ dùng `raw()` cho HTML tin cậy. Nội dung tin tức lưu văn bản thuần, không render HTML từ DB. Upload không nhận SVG.
- **Màu/ảnh minh họa**: ảnh sản phẩm hiển thị `object-fit: contain` + `mix-blend-mode: multiply` để nền ảnh hòa vào nền thẻ; chưa có ảnh sản phẩm thì dùng `jerseySvg()` với `primaryColor/secondaryColor/kitPattern` của Team.

---

## 4. Mô hình dữ liệu

Bảng trong docx là bản nháp; triển khai theo mô hình đã chuẩn hóa dưới đây (giữ tên tiếng Anh, PascalCase cho bảng, camelCase cho field trong Prisma).

- **Account**(id, email unique, phone, passwordHash, roleId, status, lastLogin, createdAt, deletedAt)
- **Role**, **Permission**, **RolePermission** — RBAC
- **Customer**(id, accountId, fullName, phone) · **Address**(id, customerId, receiverName, phone, line, ward, district, province, isDefault)
- **Category**, **Brand**, **Team**(+ leagueId), **League**(name, country, logoUrl, type), **ProductType**
- **Size**(name, sizeType: ADULT/KID) · **Color**(name, hex)
- **Product**(id, name, slug, categoryId, brandId, teamId, season, playerName, material, description, basePrice, salePrice, status: DRAFT/ACTIVE/INACTIVE, createdAt, updatedAt, deletedAt)
- **ProductImage**(productId, url, sortOrder, isPrimary, colorId?)
- **ProductVariant**(id, productId, sizeId, colorId, sku unique, price?, stockQuantity, isActive) — unique(productId, sizeId, colorId)
- **Cart**(customerId) · **CartItem**(cartId, variantId, quantity)
- **Order**(id, orderCode unique, customerId, status, paymentStatus, paymentMethod, subtotal, discountAmount, shippingFee, total, voucherId?, shipping snapshot: receiverName/phone/address, note, createdAt)
- **OrderDetail**(orderId, variantId, productName, sizeName, colorName, unitPrice, quantity, lineTotal) — **snapshot**, không join lại Product để hiển thị lịch sử
- **OrderStatusHistory**(orderId, fromStatus, toStatus, changedBy, changedAt)
- **InventoryLog**(variantId, change, stockAfter, reason: IMPORT/ADJUST/ORDER/CANCEL, note, orderId?, createdById, createdAt) — mọi thay đổi tồn kho đều ghi log
- **Payment**(orderId, method: COD/ONLINE, amount, status: PENDING/SUCCESS/FAILED, transactionRef, paidAt)
- **Promotion**, **Voucher**(code unique, type: PERCENT/FIXED, value, maxDiscount, minOrderValue, usageLimit, usedCount, startAt, endAt, scope: ALL/CATEGORY/PRODUCT, isActive)
- **Review**(customerId, productId, orderId, rating 1–5, content, images, createdAt) — unique(customerId, productId, orderId)
- **News**, **NewsCategory**, **OTP**(email, codeHash, expiresAt, usedAt), **SystemSettings**(storeName, storeEmail, currency, shippingFee)

> Tồn kho nằm ở **ProductVariant**, KHÔNG ở Product. `Product.StockQuantity` và `ProductSizeMapping` trong docx được thay bằng `ProductVariant`.

---

## 5. Quy tắc nghiệp vụ (bắt buộc)

1. **Variant**: khách phải chọn đủ Size + Color trước khi thêm giỏ. Variant hết hàng → disable nút, hiển thị "Hết hàng".
2. **Kiểm tra tồn kho** ở 3 thời điểm: thêm vào giỏ, cập nhật số lượng, và **trong transaction khi tạo Order**.
3. **Chống tranh chấp tồn kho**: trừ kho bằng câu lệnh có điều kiện trong transaction
   `UPDATE ProductVariant SET stockQuantity = stockQuantity - :q WHERE id = :id AND stockQuantity >= :q` — nếu affected = 0 thì rollback toàn bộ đơn.
4. **Price snapshot**: giá, tên sản phẩm, size, màu lưu vào `OrderDetail` lúc đặt. Admin sửa giá không ảnh hưởng đơn cũ.
5. **Giá tính ở server** (`pricing.service.js`). Không bao giờ tin `price/total` gửi từ client.
   Giá niêm yết = giá biến thể ?? giá gốc; giá hiện tại = giá biến thể ?? giá sale ?? giá gốc; sau đó áp **một** khuyến mãi đang chạy có lợi nhất (ALL / CATEGORY gồm danh mục cha / TEAM / PRODUCT), giảm % làm tròn đến 1.000₫.
   Danh sách công khai lọc ở DB rồi tính giá → lọc giá / sắp xếp / phân trang trong ứng dụng (đủ cho vài nghìn SP).
5b. **Sản phẩm**: tạo mới luôn là DRAFT; chỉ mở bán (ACTIVE) khi có ≥ 1 biến thể đang bán; tắt hết biến thể → tự về DRAFT. Biến thể đã có trong đơn/giỏ thì chỉ được tắt, không xóa. Giảm kho dùng UPDATE có điều kiện `stock >= số giảm`.
6. **Vòng đời đơn hàng** (chỉ cho phép các chuyển tiếp này, ghi `OrderStatusHistory`):
   ```
   PENDING → CONFIRMED → PROCESSING → SHIPPING → DELIVERED
   PENDING | CONFIRMED → CANCELLED   (CUSTOMER chỉ hủy được khi PENDING; ADMIN hủy được đến CONFIRMED)
   ```
   Hủy đơn → hoàn lại tồn kho + hoàn lượt dùng voucher.
7. **Thanh toán**: COD → Payment `PENDING` đến khi DELIVERED. ONLINE (mô phỏng/sandbox) → thất bại thì giữ Order + Payment `FAILED`, cho phép thanh toán lại.
8. **Voucher** hợp lệ khi: đang active, trong thời gian hiệu lực, `usedCount < usageLimit`, `subtotal ≥ minOrderValue`, đúng scope; giảm % bị chặn bởi `maxDiscount`; `discount ≤ subtotal`.
9. **Review**: chỉ khi đơn chứa sản phẩm đó ở trạng thái DELIVERED; mỗi sản phẩm/đơn đánh giá 1 lần.
10. **Xóa mềm** (`deletedAt`/`status`) cho Product, Category, User đang được tham chiếu. Category còn sản phẩm → không xóa cứng.
11. **Order code**: `JS` + `yyMMdd` + 4 ký tự ngẫu nhiên (vd `JS261029A7K2`).
12. Tiền tệ VNĐ, lưu `DECIMAL(12,0)`; hiển thị `450.000₫` qua `Intl.NumberFormat('vi-VN')`.

---

## 6. Quy ước API

- Prefix `/api/v1`. Danh từ số nhiều, kebab-case: `/api/v1/products`, `/api/v1/admin/orders/:id/status`.
- Response thành công: `{ "success": true, "data": ..., "meta": { "page", "limit", "total" } }`
- Response lỗi: `{ "success": false, "error": { "code": "OUT_OF_STOCK", "message": "...", "details": [] } }`
- HTTP code đúng nghĩa: 400 validate, 401 chưa đăng nhập, 403 sai quyền, 404, 409 xung đột (trùng email, hết hàng), 422 vi phạm nghiệp vụ.
- Danh sách sản phẩm: `GET /products?q=&category=&brand=&team=&size=&color=&minPrice=&maxPrice=&sort=price_asc|price_desc|newest|best_selling&page=1&limit=12`
- Endpoint admin nằm dưới `/api/v1/admin/*` và luôn có `auth + requireRole('ADMIN')`.

---

## 7. Design System

Phong cách: **tối giản, hiện đại, chuyên nghiệp** — lấy cảm hứng từ `ff.png` (landing "WEAR THE GAME."): nền sáng nhiều khoảng trắng, chữ đen đậm dạng editorial, **một màu nhấn vàng duy nhất**, các khối tối (navy-đen) cho banner Limited/Matchday và footer, ảnh sản phẩm trên nền trắng/xám rất nhạt.

### 7.1 Tokens (`client/css/tokens.css`)
```css
:root {
  /* Màu */
  --c-ink:        #0B1220;  /* chữ chính, nền khối tối, footer */
  --c-ink-2:      #1A2233;  /* khối tối phụ */
  --c-text:       #1F2937;
  --c-muted:      #6B7280;
  --c-line:       #E5E7EB;
  --c-surface:    #FFFFFF;
  --c-surface-2:  #F4F6F9;  /* nền section, nền ảnh sản phẩm */
  --c-accent:     #FFB709;  /* vàng — CTA, badge NEW, giá nổi bật */
  --c-accent-ink: #0B1220;  /* chữ trên nền vàng */
  --c-accent-hover:#F2A900;
  --c-success:    #16A34A;
  --c-danger:     #DC2626;
  --c-warning:    #D97706;

  /* Typography */
  --font-display: "Archivo", "Inter", system-ui, sans-serif;  /* 800–900, uppercase, letter-spacing -0.02em */
  --font-body:    "Inter", system-ui, sans-serif;
  --fs-hero: clamp(3rem, 7vw, 6rem);
  --fs-h2:   clamp(1.75rem, 3vw, 2.5rem);
  --fs-h3:   1.25rem;
  --fs-body: 1rem;
  --fs-small:.875rem;
  --fs-eyebrow:.75rem;     /* nhãn nhỏ UPPERCASE, letter-spacing .12em */

  /* Spacing (bội số 4) */
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-6:24px; --sp-8:32px; --sp-12:48px; --sp-16:64px; --sp-24:96px;

  --radius-sm: 4px;   /* button, input, badge — góc gần vuông như ảnh mẫu */
  --radius-md: 8px;   /* card */
  --radius-lg: 12px;  /* banner */
  --shadow-sm: 0 1px 2px rgba(11,18,32,.06);
  --shadow-md: 0 8px 24px rgba(11,18,32,.08);
  --container: 1280px;
  --ease: cubic-bezier(.2,.7,.2,1);
}
```
Font tải từ Google Fonts: `Archivo:wght@700;800;900` và `Inter:wght@400;500;600;700`.

### 7.2 Nguyên tắc
- **Không hard-code màu/size** trong CSS trang — luôn dùng `var(--...)`.
- Màu vàng chỉ cho: CTA chính, badge `NEW`/`NEW DROP`, nhấn giá/đường kẻ nhỏ. Không dùng cho nền lớn hay chữ đoạn văn.
- Tiêu đề section: font display, UPPERCASE, đậm (vd "NEW SEASON COLLECTION", "SHOP BY CATEGORY"); bên phải có link nhỏ "Xem tất cả →".
- Eyebrow nhỏ phía trên tiêu đề lớn (vd "BỘ SƯU TẬP 2026").
- Khoảng cách giữa các section: `--sp-24` desktop, `--sp-16` mobile. Ưu tiên khoảng trắng hơn đường viền.
- Icon: line icon 1.5px (Lucide/Tabler SVG), không dùng emoji.
- Animation tinh tế: hover card nâng `translateY(-4px)` + `--shadow-md`, 200ms `--ease`. Tôn trọng `prefers-reduced-motion`.

### 7.3 Components
- **Button primary**: nền `--c-accent`, chữ `--c-accent-ink`, UPPERCASE 600, letter-spacing .06em, padding 14px 24px, kèm mũi tên `→`.
- **Button outline**: viền 1.5px `--c-ink`, nền trong suốt; trên khối tối đảo sang trắng.
- **Product card**: ảnh tỉ lệ 4:5 trên nền `--c-surface-2`, nút ♡ góc trên phải, badge NEW góc dưới ảnh; dưới: tên (500), giá (700), sao đánh giá nhỏ; nút giỏ hàng vàng vuông nhỏ khi hover.
- **Size chip**: ô vuông 44×40, viền `--c-line`; selected = nền `--c-ink` chữ trắng; hết hàng = gạch chéo + mờ.
- **Color swatch**: tròn 24px, ring 2px khi chọn.
- **Badge trạng thái đơn**: pill nhỏ, nền nhạt + chữ đậm cùng tông (PENDING xám, CONFIRMED xanh dương, PROCESSING tím, SHIPPING vàng, DELIVERED xanh lá, CANCELLED đỏ).
- **Input**: cao 44px, viền `--c-line`, focus ring 2px `--c-ink`, label nhỏ phía trên.

### 7.4 Bố cục trang chủ (theo ff.png)
1. Top bar mảnh nền `--c-ink`: "MÙA GIẢI MỚI • FREE SHIP TỪ 500K • HÀNG CHÍNH HÃNG".
2. Header trắng sticky: logo trái, menu giữa (Cửa hàng, Đội bóng ▾, Bộ sưu tập, Hàng mới), phải: tìm kiếm, tài khoản, yêu thích, giỏ hàng (badge số lượng).
3. **Hero**: trái tiêu đề cực lớn "WEAR THE GAME." + 2 CTA + 3 meta nhỏ (Official Kit · 2026 · New Drop); phải ảnh áo lớn trên nền sân vận động sáng, tag giá dạng pill trắng nối bằng đường kẻ vàng.
4. Featured Teams — hàng card logo + áo, cuộn ngang, nút ← →.
5. New Season Collection — lưới 3–4 sản phẩm.
6. Shop by Category — 5 ô ảnh dọc tối, nhãn trắng góc dưới (Áo sân nhà, Sân khách, Retro, Training, Đội tuyển).
7. Spotlight sản phẩm — ảnh trái, khối chọn size/màu/số lượng + "THÊM VÀO GIỎ" phải.
8. Banner tối "MATCHDAY READY." / "LIMITED EDITION" có đồng hồ đếm ngược.
9. Make It Yours — in tên + số áo (preview trực tiếp).
10. Best Sellers, Customer Love (review 5 sao), Newsletter "NEVER MISS A DROP."
11. Footer `--c-ink`: logo + mô tả, cột Shop / Hỗ trợ / Công ty, social, logo thanh toán.

### 7.5 Admin
Cùng tokens nhưng tiết chế hơn: sidebar trái nền `--c-ink`, nội dung nền `--c-surface-2`, card trắng, bảng có header dính, filter + search trên đầu bảng, phân trang dưới. Dashboard: 4 KPI card (Doanh thu, Đơn hàng, Khách hàng, Sắp hết hàng) + biểu đồ doanh thu theo thời gian + top sản phẩm bán chạy.

### 7.6 Responsive & Accessibility
- Breakpoints: 576 / 768 / 992 / 1200 (theo Bootstrap). Mobile-first.
- Mobile: menu dạng drawer, lưới sản phẩm 2 cột, filter mở dạng bottom sheet.
- Tương phản tối thiểu WCAG AA; `alt` cho mọi ảnh sản phẩm; focus state rõ ràng; nút có `aria-label` khi chỉ có icon.
- Ngôn ngữ giao diện: **tiếng Việt**; tiêu đề display có thể giữ tiếng Anh ngắn kiểu thương hiệu.

---

## 8. Lộ trình (3 Phase theo proposal)

- **Phase 1 – Foundation & Master Data**: Auth (register/login/logout/đổi & quên mật khẩu OTP), Profile, User, Role/Permission, Category, Brand, Team, League, Size, Color, ProductType, Promotion/Voucher, News.
- **Phase 2 – Product & Inventory**: CRUD Product + Image + Variant, giá theo Variant, Inventory, Search/Filter/Sort/Pagination, trang danh sách & chi tiết sản phẩm.
- **Phase 3 – Shopping & Order Core**: Address, Cart, Checkout, Order + OrderDetail (snapshot), Payment, Order lifecycle, Cancel, Review, Dashboard/Statistics.

Hoàn thành phase trước (API + UI + seed data) rồi mới sang phase sau.

---

## 9. Lệnh thường dùng

```bash
cd server
npm install
cp .env.example .env              # DATABASE_URL, SHADOW_DATABASE_URL, JWT_SECRET, SMTP_*
npm run db:migrate                # prisma migrate dev — tạo/cập nhật schema
npm run db:seed                   # dữ liệu mẫu (chạy lại nhiều lần an toàn)
npm run dev                       # nodemon → http://localhost:3000 (phục vụ cả /client và /api/v1)
```

- DB dev: SQL Server Express `localhost:1433`, database `JerseyShop` (+ `JerseyShop_shadow` cho migrate), login riêng `jersey_app`.
- SMTP để trống → mã OTP quên mật khẩu được **in ra console** server.
- Tài khoản seed: `admin@jersey.vn / Admin@123`, `customer@jersey.vn / Customer@123` (chỉ dùng dev; trang đăng nhập có nút điền nhanh).
- Seed hiện có: 2 vai trò, 15 quyền, 10 danh mục, 14 thương hiệu, 7 giải (có logo), 46 đội (có màu áo), 6 loại SP, 21 size (ADULT/KID/SHOE/GLOVE/ONE), 16 màu, 3 voucher, 2 khuyến mãi, 3 bài viết, 180 sản phẩm / 819 biến thể (có hàng hết & sắp hết để demo).
- **Ảnh thật**: thư mục `image/` ở gốc repo (clothes, shoes, gloves, accessories, league, national, teams = logo đội `<slug>.png` lấy từ infobox Wikipedia) — **không commit** (logo thương hiệu/CLB), mỗi máy tự chép vào. Server phục vụ tại `/images/...`; seed chỉ gắn ảnh nếu file tồn tại, thiếu thì giao diện dùng áo SVG. Ảnh admin tải lên vẫn ở `/uploads`.

## Trạng thái
- ✅ **Phase 1** xong: Auth (đăng ký/đăng nhập/đăng xuất/đổi mật khẩu/quên mật khẩu OTP), Profile, RBAC, quản lý tài khoản, toàn bộ master data, Promotion, Voucher, News + chuyên mục, cấu hình cửa hàng, upload ảnh, trang chủ, tin tức, admin.
- ✅ **Phase 2** xong (nhánh `feature/phase2-product`): Product + Variant + Image + Inventory (+ InventoryLog), tính giá khuyến mãi, `products.html` (tìm kiếm/lọc/sắp xếp/phân trang, URL giữ bộ lọc), `product.html` (chọn size/màu, tồn kho theo biến thể), admin sản phẩm / sửa sản phẩm / tồn kho, mục New Season & Best Sellers trên trang chủ.
- ⏭️ **Phase 3**: Address, Cart, Checkout, Order (transaction trừ kho + InventoryLog reason ORDER), Payment, vòng đời đơn, hủy đơn (hoàn kho reason CANCEL), Review, Dashboard.
- Trang giữ chỗ cho Phase sau: `cart.html`, nút "Thêm vào giỏ hàng" ở `product.html` (đang chỉ báo toast), tab Đơn hàng/Sổ địa chỉ trong `account.html`.

---

## 10. Quy ước code

- JS: ES2022, `const`/`let`, async/await, không dùng `var`. Tên file kebab-case, biến camelCase, hằng UPPER_SNAKE.
- Mỗi service function làm một việc; thao tác nhiều bảng (tạo đơn, hủy đơn) **phải** dùng `prisma.$transaction`.
- Lỗi nghiệp vụ ném `new ApiError(status, code, message)`; `errorHandler` middleware chuẩn hóa response.
- Không log mật khẩu, token, OTP. Không commit `.env`, `uploads/`.
- Frontend: không lưu dữ liệu nhạy cảm ngoài JWT; mọi gọi API qua `js/api.js`; escape dữ liệu trước khi chèn `innerHTML` (ưu tiên `textContent`).
- Commit theo Conventional Commits: `feat(cart): ...`, `fix(order): ...`; branch `feature/<phase>-<module>`.

## 11. Definition of Done cho mỗi chức năng
- [ ] API có validate, phân quyền, xử lý lỗi theo chuẩn mục 6
- [ ] Tuân thủ quy tắc nghiệp vụ mục 5
- [ ] UI dùng tokens/components mục 7, hiển thị đúng trên mobile & desktop
- [ ] Có trạng thái loading / empty / error
- [ ] Seed data đủ để demo
- [ ] Đối chiếu đúng Use Case tương ứng (UC01–UC17 trong docx)
