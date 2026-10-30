// Dữ liệu mẫu cho môi trường dev — chạy lại nhiều lần an toàn (upsert theo khóa duy nhất)
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, ROLES } from '../src/config/constants.js';
import { slugify } from '../src/utils/slugify.js';

const prisma = new PrismaClient();

// Ảnh thật nằm ở thư mục image/ (gốc repo, không commit) — server phục vụ tại /images.
// Máy nào chưa có thư mục này thì bỏ qua ảnh, giao diện tự dùng áo SVG minh họa.
const IMAGE_DIR = path.resolve(import.meta.dirname, '../../image');
const imageUrl = (file) => (file && fs.existsSync(path.join(IMAGE_DIR, file)) ? `/images/${file}` : null);

const days = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

async function seedRoles() {
  for (const [code, name, module] of Object.values(PERMISSIONS)) {
    await prisma.permission.upsert({ where: { code }, update: { name, module }, create: { code, name, module } });
  }
  const permissions = await prisma.permission.findMany();

  const roles = {
    [ROLES.ADMIN]: { name: 'Quản trị viên', description: 'Toàn quyền quản trị hệ thống', modules: ['admin', 'customer'] },
    [ROLES.CUSTOMER]: { name: 'Khách hàng', description: 'Mua hàng và quản lý thông tin cá nhân', modules: ['customer'] },
  };
  for (const [code, { name, description, modules }] of Object.entries(roles)) {
    const role = await prisma.role.upsert({ where: { code }, update: { name, description }, create: { code, name, description } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions.filter((p) => modules.includes(p.module)).map((p) => ({ roleId: role.id, permissionId: p.id })),
    });
  }
}

async function seedAccounts() {
  const accounts = [
    { email: 'admin@jersey.vn', password: 'Admin@123', role: ROLES.ADMIN, fullName: 'Quản trị viên', phone: '0901000001' },
    { email: 'customer@jersey.vn', password: 'Customer@123', role: ROLES.CUSTOMER, fullName: 'Nguyễn Văn Khách', phone: '0912345678' },
  ];
  for (const a of accounts) {
    const role = await prisma.role.findUnique({ where: { code: a.role } });
    const exists = await prisma.account.findUnique({ where: { email: a.email } });
    if (exists) continue;
    await prisma.account.create({
      data: {
        email: a.email,
        passwordHash: await bcrypt.hash(a.password, 10),
        roleId: role.id,
        customer: {
          create: {
            fullName: a.fullName,
            phone: a.phone,
            ...(a.role === ROLES.CUSTOMER && { cart: { create: {} } }),
          },
        },
      },
    });
  }
}

async function upsertByName(model, items, extra = (i) => i) {
  for (const item of items) {
    const data = extra(item);
    await prisma[model].upsert({ where: { name: item.name }, update: data, create: data });
  }
}

const withSlug = (item) => ({ ...item, slug: slugify(item.name) });

async function seedMasterData() {
  await upsertByName(
    'category',
    [
      { name: 'Áo đấu câu lạc bộ', description: 'Áo đấu chính thức của các CLB hàng đầu', sortOrder: 1 },
      { name: 'Áo đội tuyển quốc gia', description: 'Áo đấu các đội tuyển quốc gia', sortOrder: 2 },
      { name: 'Áo retro', description: 'Những mẫu áo kinh điển tái bản', sortOrder: 3 },
      { name: 'Đồ tập luyện', description: 'Áo tập, áo khoác, quần tập', sortOrder: 4 },
      { name: 'Quần bóng đá', description: 'Quần thi đấu và quần tập', sortOrder: 5 },
      { name: 'Bộ quần áo bóng đá', description: 'Trọn bộ áo + quần', sortOrder: 6 },
      { name: 'Đồ trẻ em', description: 'Áo đấu và bộ đồ cho bé', sortOrder: 7 },
      { name: 'Phụ kiện bóng đá', description: 'Bóng, bọc ống đồng, tất, balo, mũ', sortOrder: 8 },
      { name: 'Giày bóng đá', description: 'Giày sân cỏ tự nhiên (FG) và sân cỏ nhân tạo (TF)', sortOrder: 9 },
      { name: 'Găng tay thủ môn', description: 'Găng tay thủ môn chuyên nghiệp', sortOrder: 10 },
    ],
    withSlug,
  );

  await upsertByName(
    'brand',
    ['Adidas', 'Nike', 'Puma', 'New Balance', 'Umbro', 'Kappa', 'Mizuno', 'Joma', 'Macron', 'Castore', 'Hummel', 'EA7', 'Uhlsport', 'Reusch'].map((name) => ({ name })),
    withSlug,
  );

  await upsertByName(
    'league',
    [
      { name: 'Premier League', country: 'Anh', type: 'CLUB', logo: 'league/EnglishPremierLeague.jpg' },
      { name: 'La Liga', country: 'Tây Ban Nha', type: 'CLUB', logo: 'league/LaLiga.jpg' },
      { name: 'Serie A', country: 'Ý', type: 'CLUB', logo: 'league/SeriaA.jpg' },
      { name: 'Bundesliga', country: 'Đức', type: 'CLUB', logo: 'league/bundesliga.jpg' },
      { name: 'Ligue 1', country: 'Pháp', type: 'CLUB', logo: 'league/Ligue1.jpg' },
      { name: 'V.League 1', country: 'Việt Nam', type: 'CLUB', logo: 'league/vleague.jpg' },
      { name: 'Đội tuyển quốc gia', country: null, type: 'NATIONAL', logo: 'national/WorldCup.jpg' },
    ],
    ({ logo, ...league }) => ({ ...withSlug(league), logoUrl: imageUrl(logo) }),
  );
  const leagues = Object.fromEntries((await prisma.league.findMany()).map((l) => [l.name, l.id]));

  // [tên, viết tắt, giải, màu chính, màu phụ, họa tiết, nổi bật, quốc gia]
  const teams = [
    ['Real Madrid', 'RMA', 'La Liga', '#FFFFFF', '#C9A227', 'PLAIN', true, 'Tây Ban Nha'],
    ['Barcelona', 'BAR', 'La Liga', '#A50044', '#004D98', 'STRIPES', true, 'Tây Ban Nha'],
    ['Atlético Madrid', 'ATM', 'La Liga', '#CB3524', '#FFFFFF', 'STRIPES', false, 'Tây Ban Nha'],
    ['Liverpool', 'LIV', 'Premier League', '#C8102E', '#F6EB61', 'PLAIN', true, 'Anh'],
    ['Manchester United', 'MUN', 'Premier League', '#DA291C', '#111111', 'PLAIN', true, 'Anh'],
    ['Manchester City', 'MCI', 'Premier League', '#6CABDD', '#1C2C5B', 'PLAIN', true, 'Anh'],
    ['Arsenal', 'ARS', 'Premier League', '#EF0107', '#FFFFFF', 'PLAIN', false, 'Anh'],
    ['Chelsea', 'CHE', 'Premier League', '#034694', '#FFFFFF', 'PLAIN', false, 'Anh'],
    ['Tottenham Hotspur', 'TOT', 'Premier League', '#FFFFFF', '#132257', 'PLAIN', false, 'Anh'],
    ['Sevilla', 'SEV', 'La Liga', '#FFFFFF', '#D81920', 'PLAIN', false, 'Tây Ban Nha'],
    ['Villarreal', 'VIL', 'La Liga', '#FFE667', '#005187', 'PLAIN', false, 'Tây Ban Nha'],
    ['Real Sociedad', 'RSO', 'La Liga', '#0067B1', '#FFFFFF', 'STRIPES', false, 'Tây Ban Nha'],
    ['Athletic Bilbao', 'ATH', 'La Liga', '#EE2523', '#FFFFFF', 'STRIPES', false, 'Tây Ban Nha'],
    ['Valencia', 'VAL', 'La Liga', '#FFFFFF', '#111111', 'PLAIN', false, 'Tây Ban Nha'],
    ['Real Betis', 'BET', 'La Liga', '#0BB363', '#FFFFFF', 'STRIPES', false, 'Tây Ban Nha'],
    ['Bayern Munich', 'BAY', 'Bundesliga', '#DC052D', '#FFFFFF', 'PLAIN', true, 'Đức'],
    ['Borussia Dortmund', 'BVB', 'Bundesliga', '#FDE100', '#111111', 'PLAIN', false, 'Đức'],
    ['Juventus', 'JUV', 'Serie A', '#111111', '#FFFFFF', 'STRIPES', true, 'Ý'],
    ['AC Milan', 'MIL', 'Serie A', '#FB090B', '#111111', 'STRIPES', false, 'Ý'],
    ['Inter Milan', 'INT', 'Serie A', '#0068A8', '#111111', 'STRIPES', false, 'Ý'],
    ['Napoli', 'NAP', 'Serie A', '#12A0D7', '#FFFFFF', 'PLAIN', false, 'Ý'],
    ['AS Roma', 'ROM', 'Serie A', '#8E1F2F', '#F0BC42', 'PLAIN', false, 'Ý'],
    ['Lazio', 'LAZ', 'Serie A', '#87D8F7', '#FFFFFF', 'PLAIN', false, 'Ý'],
    ['Fiorentina', 'FIO', 'Serie A', '#482E92', '#FFFFFF', 'PLAIN', false, 'Ý'],
    ['Atalanta', 'ATA', 'Serie A', '#1E71B8', '#111111', 'STRIPES', false, 'Ý'],
    ['Bayer Leverkusen', 'B04', 'Bundesliga', '#E32221', '#111111', 'PLAIN', false, 'Đức'],
    ['RB Leipzig', 'RBL', 'Bundesliga', '#FFFFFF', '#DD0741', 'PLAIN', false, 'Đức'],
    ['Paris Saint-Germain', 'PSG', 'Ligue 1', '#004170', '#DA291C', 'PLAIN', false, 'Pháp'],
    ['Marseille', 'OM', 'Ligue 1', '#FFFFFF', '#2FAEE0', 'PLAIN', false, 'Pháp'],
    ['Lyon', 'OL', 'Ligue 1', '#FFFFFF', '#DA0812', 'PLAIN', false, 'Pháp'],
    ['AS Monaco', 'ASM', 'Ligue 1', '#E7221A', '#FFFFFF', 'SASH', false, 'Pháp'],
    ['Hà Nội FC', 'HNFC', 'V.League 1', '#5B2C83', '#FFFFFF', 'PLAIN', false, 'Việt Nam'],
    ['Thể Công Viettel', 'TCV', 'V.League 1', '#FFFFFF', '#D71920', 'PLAIN', false, 'Việt Nam'],
    ['Thép Xanh Nam Định', 'NDI', 'V.League 1', '#FFFFFF', '#1E5AA8', 'PLAIN', false, 'Việt Nam'],
    ['Becamex Bình Dương', 'BBD', 'V.League 1', '#1E2A55', '#FFFFFF', 'PLAIN', false, 'Việt Nam'],
    ['Đông Á Thanh Hóa', 'THA', 'V.League 1', '#FCD116', '#D71920', 'PLAIN', false, 'Việt Nam'],
    ['Việt Nam', 'VIE', 'Đội tuyển quốc gia', '#DA251D', '#FFDD00', 'PLAIN', true, 'Việt Nam'],
    ['Argentina', 'ARG', 'Đội tuyển quốc gia', '#75AADB', '#FFFFFF', 'STRIPES', false, 'Argentina'],
    ['Brazil', 'BRA', 'Đội tuyển quốc gia', '#FFDC02', '#009B3A', 'PLAIN', false, 'Brazil'],
    ['Pháp', 'FRA', 'Đội tuyển quốc gia', '#21304D', '#FFFFFF', 'PLAIN', false, 'Pháp'],
    ['Đức', 'GER', 'Đội tuyển quốc gia', '#FFFFFF', '#111111', 'PLAIN', false, 'Đức'],
    ['Anh', 'ENG', 'Đội tuyển quốc gia', '#FFFFFF', '#CF081F', 'PLAIN', false, 'Anh'],
    ['Bồ Đào Nha', 'POR', 'Đội tuyển quốc gia', '#E42518', '#046A38', 'PLAIN', false, 'Bồ Đào Nha'],
    ['Tây Ban Nha', 'ESP', 'Đội tuyển quốc gia', '#C60B1E', '#FFC400', 'PLAIN', false, 'Tây Ban Nha'],
    ['Uruguay', 'URU', 'Đội tuyển quốc gia', '#7BB2E0', '#111111', 'PLAIN', false, 'Uruguay'],
    ['Colombia', 'COL', 'Đội tuyển quốc gia', '#FCD116', '#003893', 'PLAIN', false, 'Colombia'],
  ];
  await upsertByName(
    'team',
    teams.map(([name, shortName, league, primaryColor, secondaryColor, kitPattern, isFeatured, country]) => ({
      name,
      shortName,
      leagueId: leagues[league],
      type: league === 'Đội tuyển quốc gia' ? 'NATIONAL' : 'CLUB',
      primaryColor,
      secondaryColor,
      kitPattern,
      isFeatured,
      country,
    })),
    // Logo đội: image/teams/<slug>.png (tải từ infobox Wikipedia)
    (team) => {
      const data = withSlug(team);
      return { ...data, logoUrl: imageUrl(`teams/${data.slug}.png`) };
    },
  );

  await upsertByName(
    'productType',
    [
      { name: 'Sân nhà', description: 'Mẫu áo thi đấu sân nhà' },
      { name: 'Sân khách', description: 'Mẫu áo thi đấu sân khách' },
      { name: 'Mẫu thứ ba', description: 'Mẫu áo thứ ba trong mùa giải' },
      { name: 'Thủ môn', description: 'Áo thủ môn' },
      { name: 'Tập luyện', description: 'Trang phục tập luyện' },
      { name: 'Phiên bản kỷ niệm', description: 'Phiên bản giới hạn, kỷ niệm' },
    ],
    withSlug,
  );

  const sizes = [
    ...['S', 'M', 'L', 'XL', 'XXL'].map((name, i) => ({ name, sizeType: 'ADULT', sortOrder: i + 1 })),
    ...['6Y', '8Y', '10Y', '12Y', '14Y'].map((name, i) => ({ name, sizeType: 'KID', sortOrder: i + 1 })),
    { name: 'FREE', sizeType: 'ONE', sortOrder: 1 },
    ...['39', '40', '41', '42', '43', '44'].map((name, i) => ({ name, sizeType: 'SHOE', sortOrder: i + 1 })),
    ...['7', '8', '9', '10'].map((name, i) => ({ name, sizeType: 'GLOVE', sortOrder: i + 1 })),
  ];
  for (const size of sizes) {
    await prisma.size.upsert({ where: { name_sizeType: { name: size.name, sizeType: size.sizeType } }, update: size, create: size });
  }

  await upsertByName('color', [
    { name: 'Trắng', hex: '#FFFFFF' },
    { name: 'Đen', hex: '#111111' },
    { name: 'Đỏ', hex: '#C8102E' },
    { name: 'Xanh dương', hex: '#1D4ED8' },
    { name: 'Xanh da trời', hex: '#6CABDD' },
    { name: 'Xanh navy', hex: '#1E293B' },
    { name: 'Xanh lá', hex: '#15803D' },
    { name: 'Vàng', hex: '#FACC15' },
    { name: 'Cam', hex: '#F97316' },
    { name: 'Tím', hex: '#6D28D9' },
    { name: 'Hồng', hex: '#EC4899' },
    { name: 'Xám', hex: '#9CA3AF' },
    { name: 'Đỏ đô', hex: '#7A1F2B' },
    { name: 'Nâu', hex: '#6B4226' },
    { name: 'Kem', hex: '#F3EBDD' },
    { name: 'Xanh ngọc', hex: '#2DD4BF' },
  ]);
}

async function seedMarketing() {
  const clubCategory = await prisma.category.findUnique({ where: { slug: 'ao-dau-cau-lac-bo' } });
  const vietnam = await prisma.team.findUnique({ where: { slug: 'viet-nam' } });

  const vouchers = [
    { code: 'WELCOME10', description: 'Giảm 10% cho đơn đầu tiên, tối đa 100.000₫', discountType: 'PERCENT', discountValue: 10, maxDiscount: 100000, minOrderValue: 300000, usageLimit: 1000, perUserLimit: 1, scope: 'ALL' },
    { code: 'FREESHIP30', description: 'Giảm 30.000₫ phí giao hàng cho đơn từ 400.000₫', discountType: 'FIXED', discountValue: 30000, minOrderValue: 400000, usageLimit: 500, scope: 'ALL' },
    { code: 'CLUB50K', description: 'Giảm 50.000₫ khi mua áo CLB từ 800.000₫', discountType: 'FIXED', discountValue: 50000, minOrderValue: 800000, usageLimit: 300, scope: 'CATEGORY', categoryId: clubCategory.id },
  ];
  for (const v of vouchers) {
    const data = { ...v, startAt: days(-7), endAt: days(60) };
    await prisma.voucher.upsert({ where: { code: v.code }, update: data, create: data });
  }

  const promotions = [
    { name: 'Mùa giải mới 2026/27', description: 'Giảm 15% toàn bộ áo đấu câu lạc bộ mùa giải mới', discountType: 'PERCENT', discountValue: 15, scope: 'CATEGORY', categoryId: clubCategory.id, startAt: days(-3), endAt: days(4) },
    { name: 'Tiếp lửa Việt Nam', description: 'Giảm 20% áo đội tuyển Việt Nam', discountType: 'PERCENT', discountValue: 20, scope: 'TEAM', teamId: vietnam.id, startAt: days(-1), endAt: days(20) },
  ];
  for (const p of promotions) {
    const data = { ...p, slug: slugify(p.name) };
    await prisma.promotion.upsert({ where: { slug: data.slug }, update: data, create: data });
  }
}

async function seedNews() {
  await upsertByName(
    'newsCategory',
    ['Bộ sưu tập mới', 'Hướng dẫn chọn size', 'Câu chuyện áo đấu', 'Khuyến mãi'].map((name) => ({ name })),
    withSlug,
  );
  const categories = Object.fromEntries((await prisma.newsCategory.findMany()).map((c) => [c.name, c.id]));
  const admin = await prisma.account.findUnique({ where: { email: 'admin@jersey.vn' } });

  const posts = [
    {
      title: 'Cách chọn size áo đấu chuẩn cho người Việt',
      summary: 'Áo bản Player ôm hơn bản Fan — đây là bảng quy đổi và vài mẹo đo nhanh tại nhà.',
      category: 'Hướng dẫn chọn size',
      content:
        'Áo đấu thường có hai phiên bản: bản Fan (Replica) có form rộng, chất vải dày hơn và bản Player (Authentic) ôm sát, nhẹ, thoáng khí.\n\nĐể chọn đúng size, hãy đo vòng ngực tại điểm rộng nhất và chiều dài từ vai xuống hông. Với người cao 1m60–1m70, nặng 55–65kg, size M bản Fan thường vừa vặn.\n\nNếu bạn phân vân giữa hai size, hãy chọn size lớn hơn với bản Player và size nhỏ hơn với bản Fan. Bảng size chi tiết luôn có ở trang từng sản phẩm.',
    },
    {
      title: 'Bộ sưu tập áo đấu mùa giải 2026/27 đã cập bến',
      summary: 'Những mẫu áo sân nhà, sân khách mới nhất của các CLB hàng đầu châu Âu đã có mặt tại JERSEY.',
      category: 'Bộ sưu tập mới',
      content:
        'Mùa giải mới mang đến loạt thiết kế ấn tượng: họa tiết dệt chìm tinh tế, cổ áo cách điệu và chất liệu tái chế thân thiện môi trường.\n\nTất cả sản phẩm tại JERSEY đều là hàng chính hãng, có tem và mã kiểm tra. Đặt trước ngay hôm nay để nhận ưu đãi in tên, số miễn phí.',
    },
    {
      title: 'Hành trình 30 năm của chiếc áo đỏ',
      summary: 'Nhìn lại những thiết kế áo đấu đáng nhớ nhất của đội tuyển Việt Nam qua từng thời kỳ.',
      category: 'Câu chuyện áo đấu',
      content:
        'Từ những chiếc áo cotton đơn giản thập niên 90 đến thiết kế hiện đại với công nghệ thấm hút mồ hôi, chiếc áo đỏ luôn là niềm tự hào của người hâm mộ.\n\nMỗi phiên bản đều gắn với một kỷ niệm: chức vô địch AFF Cup, hành trình Thường Châu tuyết trắng hay những đêm cuồng nhiệt trên sân Mỹ Đình.',
    },
  ];

  for (const [index, post] of posts.entries()) {
    const slug = slugify(post.title);
    if (await prisma.news.findUnique({ where: { slug } })) continue;
    await prisma.news.create({
      data: {
        title: post.title,
        slug,
        summary: post.summary,
        content: post.content,
        status: 'PUBLISHED',
        publishedAt: days(-(index * 3 + 1)),
        authorId: admin.id,
        categories: { create: [{ categoryId: categories[post.category] }] },
      },
    });
  }
}

// ───────── Sản phẩm mẫu ─────────
const SEASON = '2026/27';
const JERSEY_MATERIAL = 'Polyester tái chế, công nghệ thoát nhiệt';
const KIT_LABEL = {
  'san-nha': 'sân nhà',
  'san-khach': 'sân khách',
  'mau-thu-ba': 'mẫu thứ ba',
  'thu-mon': 'thủ môn',
  'phien-ban-ky-niem': 'phiên bản đặc biệt',
};

// Áo đấu theo mùa: [ảnh, slug đội, loại, màu, giá gốc, giá sale, hãng, nổi bật]
const KITS = [
  // Premier League
  ['clothes/1.jpg', 'manchester-united', 'san-nha', 'Đỏ', 850000, null, 'Adidas', true],
  ['clothes/7.jpg', 'manchester-united', 'san-khach', 'Xanh navy', 850000, 690000, 'Adidas'],
  ['clothes/19.jpg', 'manchester-united', 'mau-thu-ba', 'Trắng', 850000, null, 'Adidas'],
  ['clothes/10.jpg', 'manchester-united', 'thu-mon', 'Tím', 890000, null, 'Adidas'],
  ['clothes/2.jpg', 'manchester-city', 'san-nha', 'Xanh da trời', 850000, null, 'Puma', true],
  ['clothes/20.jpg', 'manchester-city', 'san-khach', 'Xanh navy', 850000, null, 'Puma'],
  ['clothes/8.jpg', 'manchester-city', 'mau-thu-ba', 'Đỏ đô', 850000, null, 'Puma'],
  ['clothes/14.jpg', 'manchester-city', 'phien-ban-ky-niem', 'Nâu', 950000, null, 'Puma'],
  ['clothes/3.jpg', 'liverpool', 'san-nha', 'Đỏ', 850000, null, 'Nike', true],
  ['clothes/9.jpg', 'liverpool', 'san-khach', 'Kem', 850000, null, 'Adidas'],
  ['clothes/16.jpg', 'liverpool', 'thu-mon', 'Xanh lá', 890000, null, 'Adidas'],
  ['clothes/5.jpg', 'arsenal', 'san-nha', 'Đỏ', 850000, null, 'Adidas', true],
  ['clothes/11.jpg', 'arsenal', 'mau-thu-ba', 'Xanh da trời', 850000, 690000, 'Adidas'],
  ['clothes/17.jpg', 'arsenal', 'thu-mon', 'Vàng', 890000, null, 'Adidas'],
  ['clothes/4.jpg', 'chelsea', 'san-nha', 'Xanh dương', 850000, null, 'Nike'],
  ['clothes/12.jpg', 'chelsea', 'san-khach', 'Trắng', 850000, null, 'Nike'],
  ['clothes/18.jpg', 'chelsea', 'thu-mon', 'Cam', 890000, null, 'Nike'],
  ['clothes/6.jpg', 'tottenham-hotspur', 'san-nha', 'Trắng', 850000, null, 'Nike'],
  ['clothes/15.jpg', 'tottenham-hotspur', 'san-khach', 'Xanh da trời', 850000, null, 'Nike'],
  // La Liga
  ['clothes/21.jpg', 'real-madrid', 'san-nha', 'Trắng', 890000, null, 'Adidas', true],
  ['clothes/24.jpg', 'real-madrid', 'san-khach', 'Cam', 890000, null, 'Adidas'],
  ['clothes/30.jpg', 'real-madrid', 'mau-thu-ba', 'Xám', 890000, null, 'Adidas'],
  ['clothes/26.jpg', 'real-madrid', 'thu-mon', 'Xanh da trời', 890000, null, 'Adidas'],
  ['clothes/22.jpg', 'barcelona', 'san-nha', 'Đỏ', 890000, 790000, 'Nike', true],
  ['clothes/25.jpg', 'barcelona', 'san-khach', 'Đen', 890000, null, 'Nike'],
  ['clothes/27.jpg', 'barcelona', 'thu-mon', 'Xanh lá', 890000, null, 'Nike'],
  ['clothes/37.jpg', 'barcelona', 'phien-ban-ky-niem', 'Xanh navy', 990000, null, 'Nike'],
  ['clothes/23.jpg', 'atletico-madrid', 'san-nha', 'Đỏ', 790000, null, 'Nike'],
  ['clothes/28.jpg', 'atletico-madrid', 'san-khach', 'Xám', 790000, null, 'Nike'],
  ['clothes/40.jpg', 'atletico-madrid', 'mau-thu-ba', 'Cam', 790000, 650000, 'Nike'],
  ['clothes/29.jpg', 'sevilla', 'san-nha', 'Trắng', 750000, null, 'Castore'],
  ['clothes/31.jpg', 'villarreal', 'san-nha', 'Vàng', 750000, null, 'Joma'],
  ['clothes/32.jpg', 'real-sociedad', 'san-nha', 'Xanh dương', 750000, null, 'Macron'],
  ['clothes/33.jpg', 'athletic-bilbao', 'san-nha', 'Đỏ', 750000, null, 'Castore'],
  ['clothes/34.jpg', 'valencia', 'san-nha', 'Trắng', 750000, null, 'Puma'],
  ['clothes/35.jpg', 'real-betis', 'san-nha', 'Xanh lá', 750000, null, 'Hummel'],
  // Serie A
  ['clothes/43.jpg', 'juventus', 'san-nha', 'Đen', 850000, null, 'Adidas', true],
  ['clothes/48.jpg', 'juventus', 'san-khach', 'Vàng', 850000, null, 'Adidas'],
  ['clothes/58.jpg', 'juventus', 'mau-thu-ba', 'Xanh navy', 850000, null, 'Adidas'],
  ['clothes/51.jpg', 'juventus', 'thu-mon', 'Hồng', 890000, null, 'Adidas'],
  ['clothes/42.jpg', 'ac-milan', 'san-nha', 'Đỏ', 790000, null, 'Puma'],
  ['clothes/47.jpg', 'ac-milan', 'san-khach', 'Trắng', 790000, null, 'Puma'],
  ['clothes/50.jpg', 'ac-milan', 'mau-thu-ba', 'Đen', 790000, null, 'Puma'],
  ['clothes/41.jpg', 'inter-milan', 'san-nha', 'Xanh dương', 790000, null, 'Nike'],
  ['clothes/46.jpg', 'inter-milan', 'san-khach', 'Trắng', 790000, null, 'Nike'],
  ['clothes/56.jpg', 'inter-milan', 'mau-thu-ba', 'Vàng', 790000, null, 'Nike'],
  ['clothes/49.jpg', 'inter-milan', 'thu-mon', 'Xám', 850000, null, 'Nike'],
  ['clothes/44.jpg', 'napoli', 'san-nha', 'Xanh da trời', 750000, null, 'EA7'],
  ['clothes/52.jpg', 'napoli', 'san-khach', 'Trắng', 750000, null, 'EA7'],
  ['clothes/45.jpg', 'as-roma', 'san-nha', 'Đỏ đô', 750000, null, 'Adidas'],
  ['clothes/53.jpg', 'lazio', 'san-nha', 'Xanh da trời', 690000, null, 'Mizuno'],
  ['clothes/54.jpg', 'fiorentina', 'san-nha', 'Tím', 690000, null, 'Kappa'],
  ['clothes/55.jpg', 'atalanta', 'san-nha', 'Xanh dương', 690000, null, 'New Balance'],
  // Bundesliga
  ['clothes/61.jpg', 'bayern-munich', 'san-nha', 'Đỏ', 850000, null, 'Adidas', true],
  ['clothes/75.jpg', 'bayern-munich', 'san-khach', 'Kem', 850000, null, 'Adidas'],
  ['clothes/64.jpg', 'bayern-munich', 'mau-thu-ba', 'Đen', 850000, null, 'Adidas'],
  ['clothes/67.jpg', 'bayern-munich', 'thu-mon', 'Vàng', 890000, null, 'Adidas'],
  ['clothes/62.jpg', 'borussia-dortmund', 'san-nha', 'Vàng', 790000, null, 'Puma'],
  ['clothes/65.jpg', 'borussia-dortmund', 'san-khach', 'Đen', 790000, null, 'Puma'],
  ['clothes/76.jpg', 'borussia-dortmund', 'mau-thu-ba', 'Trắng', 790000, null, 'Puma'],
  ['clothes/68.jpg', 'borussia-dortmund', 'phien-ban-ky-niem', 'Hồng', 850000, null, 'Puma'],
  ['clothes/70.jpg', 'bayer-leverkusen', 'san-nha', 'Đỏ', 750000, null, 'Castore'],
  ['clothes/71.jpg', 'rb-leipzig', 'san-nha', 'Trắng', 750000, null, 'Puma'],
  // Ligue 1
  ['clothes/63.jpg', 'paris-saint-germain', 'san-nha', 'Xanh navy', 890000, null, 'Nike'],
  ['clothes/66.jpg', 'paris-saint-germain', 'san-khach', 'Trắng', 890000, null, 'Nike'],
  ['clothes/77.jpg', 'paris-saint-germain', 'mau-thu-ba', 'Hồng', 890000, 750000, 'Nike'],
  ['clothes/69.jpg', 'paris-saint-germain', 'thu-mon', 'Xanh lá', 890000, null, 'Nike'],
  ['clothes/72.jpg', 'marseille', 'san-nha', 'Trắng', 750000, null, 'Puma'],
  ['clothes/73.jpg', 'lyon', 'san-nha', 'Trắng', 750000, null, 'Adidas'],
  ['clothes/74.jpg', 'as-monaco', 'san-nha', 'Đỏ', 750000, null, 'Mizuno'],
  // V.League 1
  ['clothes/161.jpg', 'ha-noi-fc', 'san-nha', 'Tím', 450000, null, null],
  ['clothes/162.jpg', 'the-cong-viettel', 'san-nha', 'Trắng', 450000, null, null],
  ['clothes/165.jpg', 'thep-xanh-nam-dinh', 'san-nha', 'Trắng', 450000, null, null],
  ['clothes/166.jpg', 'becamex-binh-duong', 'san-nha', 'Xanh navy', 420000, null, null],
  ['clothes/164.jpg', 'dong-a-thanh-hoa', 'san-nha', 'Vàng', 420000, null, null],
  // Đội tuyển quốc gia (Việt Nam chưa có ảnh thật → dùng áo SVG)
  [null, 'viet-nam', 'san-nha', 'Đỏ', 550000, null, null],
  [null, 'viet-nam', 'san-khach', 'Trắng', 550000, null, null],
  ['clothes/185.jpg', 'argentina', 'san-nha', 'Xanh da trời', 950000, null, 'Adidas', true],
  ['clothes/186.jpg', 'brazil', 'san-nha', 'Vàng', 950000, null, 'Nike'],
  ['clothes/179.jpg', 'phap', 'san-nha', 'Xanh navy', 950000, 850000, 'Nike'],
  ['clothes/182.jpg', 'duc', 'san-nha', 'Trắng', 950000, null, 'Adidas'],
  ['clothes/181.jpg', 'anh', 'san-nha', 'Trắng', 950000, null, 'Nike'],
  ['clothes/184.jpg', 'bo-dao-nha', 'san-nha', 'Đỏ', 950000, null, 'Puma'],
  ['clothes/183.jpg', 'tay-ban-nha', 'san-nha', 'Đỏ', 950000, null, 'Adidas'],
  ['clothes/187.jpg', 'uruguay', 'san-nha', 'Xanh da trời', 890000, null, 'Nike'],
  ['clothes/188.jpg', 'colombia', 'san-nha', 'Vàng', 890000, null, 'Adidas'],
];

// Mặc định theo danh mục — mục nào khai báo riêng sẽ ghi đè
const CATEGORY_DEFAULTS = {
  'do-tre-em': { sizeType: 'KID', gender: 'KIDS' },
  'giay-bong-da': { sizeType: 'SHOE', season: null, material: 'Upper sợi dệt kết hợp da tổng hợp' },
  'gang-tay-thu-mon': { sizeType: 'GLOVE', season: null, material: 'Mút latex 4mm, cổ tay đàn hồi' },
  'phu-kien-bong-da': { sizeType: 'ONE', season: null, material: null },
};

const shoe = (image, name, brand, color, price, sale) => {
  const turf = name.endsWith('TF');
  return {
    images: [image],
    name: `Giày ${name}`,
    category: 'giay-bong-da',
    brand,
    colors: [color],
    price,
    sale,
    description: turf
      ? 'Đế TF đinh dăm bám tốt trên sân cỏ nhân tạo 5–7 người, lót êm, phù hợp đá phong trào.'
      : 'Đế FG đinh cao dành cho sân cỏ tự nhiên, form ôm chân, tăng tốc và đổi hướng nhanh.',
  };
};
const accessory = (image, name, brand, color, price, extra = {}) => ({
  images: [image],
  name,
  category: 'phu-kien-bong-da',
  brand,
  colors: [color],
  price,
  ...extra,
});

// Sản phẩm khác: { images, name, team, category, type, brand, colors, sizeType, sizes, price, sale, season, gender, material, description }
const OTHERS = [
  { images: ['clothes/21.jpg'], name: 'Áo Real Madrid sân nhà 2026/27 – bản Player', team: 'real-madrid', category: 'ao-dau-cau-lac-bo', type: 'san-nha', brand: 'Adidas', colors: ['Trắng'], sizes: ['S', 'M', 'L', 'XL'], price: 1690000, description: 'Phiên bản cầu thủ: form ôm, vải siêu nhẹ, logo ép nhiệt.' },
  { images: ['clothes/22.jpg'], name: 'Áo Barcelona sân nhà 2026/27 – bản Player', team: 'barcelona', category: 'ao-dau-cau-lac-bo', type: 'san-nha', brand: 'Nike', colors: ['Đỏ'], sizes: ['S', 'M', 'L', 'XL'], price: 1690000, description: 'Phiên bản cầu thủ: form ôm, vải siêu nhẹ, logo ép nhiệt.' },
  { images: ['clothes/13.jpg'], name: 'Áo Manchester United sân nhà 2023/24', team: 'manchester-united', category: 'ao-dau-cau-lac-bo', type: 'san-nha', brand: 'Adidas', colors: ['Đỏ'], price: 850000, sale: 490000, season: '2023/24', description: 'Mẫu áo mùa trước — xả kho số lượng có hạn.' },

  // Retro & kỷ niệm
  { images: ['clothes/36.jpg'], name: 'Áo Real Madrid retro 2011/12', team: 'real-madrid', category: 'ao-retro', type: 'phien-ban-ky-niem', brand: 'Adidas', colors: ['Trắng'], price: 790000, season: '2011/12', material: 'Polyester dệt kim', description: 'Tái bản mẫu áo sân nhà mùa giải 100 điểm 2011/12.' },
  { images: ['clothes/178.jpg'], name: 'Áo Argentina World Cup 2022', team: 'argentina', category: 'ao-retro', type: 'phien-ban-ky-niem', brand: 'Adidas', colors: ['Xanh da trời'], price: 950000, sale: 790000, season: '2022', description: 'Mẫu áo gắn với chức vô địch World Cup 2022 tại Qatar.' },
  { images: ['clothes/177.jpg'], name: 'Áo Brazil World Cup 2022', team: 'brazil', category: 'ao-retro', type: 'phien-ban-ky-niem', brand: 'Nike', colors: ['Vàng'], price: 950000, sale: 690000, season: '2022' },
  { images: ['clothes/180.jpg'], name: 'Áo Anh World Cup 2022', team: 'anh', category: 'ao-retro', type: 'phien-ban-ky-niem', brand: 'Nike', colors: ['Trắng'], price: 950000, sale: 690000, season: '2022' },

  // Đồ tập luyện
  { images: ['clothes/38.jpg'], name: 'Áo tập Real Madrid', team: 'real-madrid', category: 'do-tap-luyen', type: 'tap-luyen', brand: 'Adidas', colors: ['Xanh da trời'], price: 590000 },
  { images: ['clothes/39.jpg'], name: 'Áo tập Barcelona', team: 'barcelona', category: 'do-tap-luyen', type: 'tap-luyen', brand: 'Nike', colors: ['Xanh navy'], price: 590000 },
  { images: ['clothes/59.jpg'], name: 'Áo tập Inter Milan', team: 'inter-milan', category: 'do-tap-luyen', type: 'tap-luyen', brand: 'Nike', colors: ['Đen'], price: 550000 },
  { images: ['clothes/60.jpg'], name: 'Áo tập AC Milan', team: 'ac-milan', category: 'do-tap-luyen', type: 'tap-luyen', brand: 'Puma', colors: ['Đen'], price: 550000 },
  { images: ['clothes/78.jpg'], name: 'Áo tập Bayern Munich', team: 'bayern-munich', category: 'do-tap-luyen', type: 'tap-luyen', brand: 'Adidas', colors: ['Đỏ đô'], price: 590000 },
  { images: ['clothes/79.jpg'], name: 'Áo tập Borussia Dortmund', team: 'borussia-dortmund', category: 'do-tap-luyen', type: 'tap-luyen', brand: 'Puma', colors: ['Đen'], price: 550000 },
  { images: ['clothes/80.jpg'], name: 'Áo tập Paris Saint-Germain', team: 'paris-saint-germain', category: 'do-tap-luyen', type: 'tap-luyen', brand: 'Nike', colors: ['Xanh dương'], price: 590000 },
  { images: ['clothes/145.jpg'], name: 'Áo tập Nike Dri-FIT', category: 'do-tap-luyen', type: 'tap-luyen', brand: 'Nike', colors: ['Đen'], price: 450000, season: null },
  { images: ['clothes/146.jpg'], name: 'Áo tập Adidas Tiro', category: 'do-tap-luyen', type: 'tap-luyen', brand: 'Adidas', colors: ['Đen'], price: 450000, season: null },
  { images: ['clothes/123.jpg'], name: 'Áo hoodie Manchester United', team: 'manchester-united', category: 'do-tap-luyen', type: 'tap-luyen', brand: 'Adidas', colors: ['Đỏ'], price: 1290000, material: 'Nỉ bông pha polyester' },
  { images: ['clothes/124.jpg'], name: 'Áo khoác tập Manchester City', team: 'manchester-city', category: 'do-tap-luyen', type: 'tap-luyen', brand: 'Puma', colors: ['Xanh dương'], price: 1190000, material: 'Polyester chống gió' },
  { images: ['clothes/125.jpg'], name: 'Áo khoác tập Liverpool', team: 'liverpool', category: 'do-tap-luyen', type: 'tap-luyen', brand: 'Adidas', colors: ['Đỏ'], price: 1190000, material: 'Polyester chống gió' },
  { images: ['clothes/126.jpg'], name: 'Áo khoác Real Madrid', team: 'real-madrid', category: 'do-tap-luyen', type: 'tap-luyen', brand: 'Adidas', colors: ['Trắng'], price: 1290000, material: 'Polyester chống gió' },
  { images: ['clothes/127.jpg'], name: 'Áo khoác gió Barcelona', team: 'barcelona', category: 'do-tap-luyen', type: 'tap-luyen', brand: 'Nike', colors: ['Trắng'], price: 1190000, material: 'Polyester chống gió' },
  { images: ['clothes/128.jpg'], name: 'Áo khoác Bayern Munich', team: 'bayern-munich', category: 'do-tap-luyen', type: 'tap-luyen', brand: 'Adidas', colors: ['Đỏ đô'], price: 1290000, material: 'Polyester dệt kim' },
  { images: ['clothes/129.jpg'], name: 'Áo khoác Paris Saint-Germain', team: 'paris-saint-germain', category: 'do-tap-luyen', type: 'tap-luyen', brand: 'Nike', colors: ['Xanh navy'], price: 1290000, material: 'Polyester dệt kim' },
  { images: ['clothes/130.jpg'], name: 'Áo khoác tập Inter Milan', team: 'inter-milan', category: 'do-tap-luyen', type: 'tap-luyen', brand: 'Nike', colors: ['Xanh dương'], price: 1190000, material: 'Polyester chống gió' },
  { images: ['clothes/131.jpg'], name: 'Áo khoác tập AC Milan', team: 'ac-milan', category: 'do-tap-luyen', type: 'tap-luyen', brand: 'Puma', colors: ['Đen'], price: 1190000, material: 'Polyester dệt kim' },
  { images: ['clothes/122.jpg'], name: 'Áo khoác gió Adidas Tiro', category: 'do-tap-luyen', type: 'tap-luyen', brand: 'Adidas', colors: ['Xám'], price: 890000, season: null, material: 'Polyester chống nước nhẹ' },
  { images: ['clothes/121.jpg'], name: 'Áo khoác gió có mũ', category: 'do-tap-luyen', type: 'tap-luyen', brand: null, colors: ['Đen'], price: 590000, season: null, material: 'Polyester chống nước nhẹ' },
  { images: ['clothes/139.jpg'], name: 'Áo gile Adidas', category: 'do-tap-luyen', type: 'tap-luyen', brand: 'Adidas', colors: ['Đen'], price: 790000, season: null, material: 'Polyester chống gió' },
  { images: ['clothes/132.jpg'], name: 'Áo hoodie Nike Park', category: 'do-tap-luyen', type: 'tap-luyen', brand: 'Nike', colors: ['Đen'], price: 990000, season: null, material: 'Nỉ bông pha polyester' },
  { images: ['clothes/133.jpg'], name: 'Áo hoodie Adidas Trefoil', category: 'do-tap-luyen', type: 'tap-luyen', brand: 'Adidas', colors: ['Đen'], price: 1090000, season: null, material: 'Nỉ bông pha polyester' },

  // Quần
  { images: ['clothes/142.jpg'], name: 'Quần short Adidas Tiro', category: 'quan-bong-da', type: 'tap-luyen', brand: 'Adidas', colors: ['Đen'], price: 450000, season: null },
  { images: ['clothes/141.jpg'], name: 'Quần short chạy bộ Nike', category: 'quan-bong-da', type: 'tap-luyen', brand: 'Nike', colors: ['Đen'], price: 490000, season: null },
  { images: ['clothes/144.jpg'], name: 'Quần dài Adidas Tiro', category: 'quan-bong-da', type: 'tap-luyen', brand: 'Adidas', colors: ['Đen'], price: 790000, season: null },
  { images: ['clothes/143.jpg'], name: 'Quần jogger nỉ Nike', category: 'quan-bong-da', type: 'tap-luyen', brand: 'Nike', colors: ['Đen'], price: 1190000, season: null, material: 'Nỉ bông pha polyester' },

  // Trẻ em — dùng ảnh mẫu áo người lớn cùng thiết kế
  { images: ['clothes/21.jpg'], name: 'Áo đấu trẻ em Real Madrid sân nhà', team: 'real-madrid', category: 'do-tre-em', type: 'san-nha', brand: 'Adidas', colors: ['Trắng'], price: 590000 },
  { images: ['clothes/22.jpg'], name: 'Áo đấu trẻ em Barcelona sân nhà', team: 'barcelona', category: 'do-tre-em', type: 'san-nha', brand: 'Nike', colors: ['Đỏ'], price: 590000 },
  { images: ['clothes/1.jpg'], name: 'Áo đấu trẻ em Manchester United sân nhà', team: 'manchester-united', category: 'do-tre-em', type: 'san-nha', brand: 'Adidas', colors: ['Đỏ'], price: 590000 },
  { images: ['clothes/185.jpg'], name: 'Áo đấu trẻ em Argentina sân nhà', team: 'argentina', category: 'do-tre-em', type: 'san-nha', brand: 'Adidas', colors: ['Xanh da trời'], price: 650000 },

  // Giày
  shoe('shoes/81.jpg', 'Nike Mercurial Superfly Elite FG', 'Nike', 'Xanh ngọc', 5890000),
  shoe('shoes/83.jpg', 'Nike Phantom GX Elite FG', 'Nike', 'Xanh ngọc', 5490000, 4690000),
  shoe('shoes/98.jpg', 'Nike Phantom GT2 Elite FG', 'Nike', 'Trắng', 4690000, 3290000),
  shoe('shoes/91.jpg', 'Nike Mercurial Vapor Academy TF', 'Nike', 'Xanh ngọc', 2290000),
  shoe('shoes/93.jpg', 'Nike Phantom GX Academy TF', 'Nike', 'Trắng', 2290000),
  shoe('shoes/86.jpg', 'Nike Tiempo Legend Academy TF', 'Nike', 'Kem', 2190000),
  shoe('shoes/96.jpg', 'Nike Tiempo Legend Club TF', 'Nike', 'Trắng', 1690000),
  shoe('shoes/169.jpg', 'Nike Phantom GX Club TF', 'Nike', 'Xanh da trời', 1590000),
  shoe('shoes/190.jpg', 'Adidas F50 Elite FG', 'Adidas', 'Trắng', 5290000),
  shoe('shoes/189.jpg', 'Adidas X Speedportal.1 FG', 'Adidas', 'Đen', 4290000, 2990000),
  shoe('shoes/82.jpg', 'Adidas Predator League TF', 'Adidas', 'Đen', 2190000),
  shoe('shoes/84.jpg', 'Adidas X Crazyfast League TF', 'Adidas', 'Vàng', 2290000),
  shoe('shoes/87.jpg', 'Adidas Copa Pure League TF', 'Adidas', 'Trắng', 1990000),
  shoe('shoes/92.jpg', 'Adidas Predator Accuracy.3 TF', 'Adidas', 'Xanh dương', 2390000, 1790000),
  shoe('shoes/94.jpg', 'Adidas X Speedportal.3 TF', 'Adidas', 'Hồng', 2190000),
  shoe('shoes/97.jpg', 'Adidas Copa Sense.3 TF', 'Adidas', 'Xanh navy', 1990000, 1490000),
  shoe('shoes/99.jpg', 'Adidas Nemeziz.3 TF', 'Adidas', 'Trắng', 1890000, 1290000),
  shoe('shoes/170.jpg', 'Adidas Predator Club TF', 'Adidas', 'Đỏ', 1590000),
  shoe('shoes/85.jpg', 'Puma Future Ultimate FG', 'Puma', 'Trắng', 4990000),
  shoe('shoes/171.jpg', 'Puma Future Pro FG', 'Puma', 'Cam', 3290000),
  shoe('shoes/88.jpg', 'Puma King Pro FG', 'Puma', 'Trắng', 2990000),
  shoe('shoes/95.jpg', 'Puma Future Play TF', 'Puma', 'Trắng', 1790000),
  shoe('shoes/100.jpg', 'Puma Ultra Play TF', 'Puma', 'Cam', 1690000),
  shoe('shoes/89.jpg', 'Mizuno Morelia TF', 'Mizuno', 'Trắng', 2890000),
  shoe('shoes/172.jpg', 'Mizuno Monarcida Neo TF', 'Mizuno', 'Vàng', 1890000),
  shoe('shoes/90.jpg', 'New Balance Furon Pro FG', 'New Balance', 'Trắng', 3290000),

  // Găng tay thủ môn
  { images: ['gloves/111.jpg'], name: 'Găng tay Nike Vapor Grip3', category: 'gang-tay-thu-mon', brand: 'Nike', colors: ['Đen'], price: 1590000 },
  { images: ['gloves/112.jpg'], name: 'Găng tay Adidas Predator Pro', category: 'gang-tay-thu-mon', brand: 'Adidas', colors: ['Xanh dương'], price: 2190000 },
  { images: ['gloves/113.jpg'], name: 'Găng tay Uhlsport Supergrip+', category: 'gang-tay-thu-mon', brand: 'Uhlsport', colors: ['Trắng'], price: 1890000 },
  { images: ['gloves/114.jpg'], name: 'Găng tay Puma Future Ultimate', category: 'gang-tay-thu-mon', brand: 'Puma', colors: ['Trắng'], price: 2290000, sale: 1890000 },
  { images: ['gloves/115.jpg'], name: 'Găng tay Reusch Attrakt Gold', category: 'gang-tay-thu-mon', brand: 'Reusch', colors: ['Cam'], price: 2490000 },

  // Phụ kiện
  accessory('accessories/105.jpg', 'Bóng Nike Flight Premier League', 'Nike', 'Vàng', 3990000, { material: 'PU cao cấp, size 5', description: 'Bóng thi đấu chính thức Premier League, công nghệ Aerowsculpt bay ổn định.' }),
  accessory('accessories/106.jpg', 'Bóng Adidas UCL Pro', 'Adidas', 'Trắng', 3690000, { material: 'PU cao cấp, size 5' }),
  accessory('accessories/191.jpg', 'Bóng Adidas Al Rihla World Cup 2022', 'Adidas', 'Trắng', 1290000, { material: 'TPU, size 5' }),
  accessory('accessories/192.jpg', 'Bóng Adidas Fussballliebe Euro 2024', 'Adidas', 'Trắng', 1290000, { material: 'TPU, size 5' }),
  accessory('accessories/173.jpg', 'Bóng Động Lực FIFA Quality', null, 'Trắng', 590000, { material: 'PU, size 5', description: 'Bóng đạt chuẩn FIFA Quality, dùng cho sân cỏ tự nhiên và nhân tạo.' }),
  accessory('accessories/101.jpg', 'Bọc ống đồng Nike Mercurial Lite', 'Nike', 'Trắng', 390000),
  accessory('accessories/102.jpg', 'Bọc ống đồng Adidas Tiro', 'Adidas', 'Trắng', 350000),
  accessory('accessories/174.jpg', 'Bọc ống đồng Adidas X League', 'Adidas', 'Xanh lá', 350000),
  accessory('accessories/116.jpg', 'Bọc ống đồng sợi carbon', null, 'Đen', 290000),
  accessory('accessories/103.jpg', 'Tất Nike cổ cao', 'Nike', 'Trắng', 290000, { material: 'Cotton co giãn' }),
  accessory('accessories/104.jpg', 'Tất Adidas Trefoil cổ cao', 'Adidas', 'Trắng', 250000, { material: 'Cotton co giãn' }),
  accessory('accessories/108.jpg', 'Balo Adidas Classic', 'Adidas', 'Đen', 690000),
  accessory('accessories/107.jpg', 'Balo mini Nike Futura', 'Nike', 'Đen', 790000),
  accessory('accessories/175.jpg', 'Túi trống New Balance', 'New Balance', 'Đen', 890000),
  accessory('accessories/149.jpg', 'Túi đeo chéo Nike Heritage', 'Nike', 'Đen', 450000),
  accessory('accessories/150.jpg', 'Túi đeo chéo Adidas Essentials', 'Adidas', 'Đen', 450000),
  accessory('accessories/109.jpg', 'Bình nước Nike 700ml', 'Nike', 'Trắng', 390000),
  accessory('accessories/110.jpg', 'Bình nước Adidas 750ml', 'Adidas', 'Trắng', 190000),
  accessory('accessories/147.jpg', 'Mũ lưỡi trai Nike Fly', 'Nike', 'Trắng', 590000),
  accessory('accessories/148.jpg', 'Mũ lưỡi trai Adidas', 'Adidas', 'Trắng', 450000),
  accessory('accessories/117.jpg', 'Băng đô Nike Fury', 'Nike', 'Trắng', 190000),
  accessory('accessories/118.jpg', 'Băng cổ tay Adidas (2 chiếc)', 'Adidas', 'Trắng', 190000),
  accessory('accessories/119.jpg', 'Khăn tập Nike', 'Nike', 'Đen', 350000),
  accessory('accessories/152.jpg', 'Băng bảo vệ đầu gối', null, 'Đen', 250000),
  accessory('accessories/154.jpg', 'Băng bảo vệ cổ chân (đôi)', null, 'Đen', 190000),
];

// Sản phẩm mẫu đời đầu không có ảnh thật — ẩn đi (xóa mềm) khi seed lại trên DB cũ
const RETIRED_SLUGS = [
  'ao-manchester-united-retro-1999-1998-99',
  'ao-brazil-retro-2002',
  'ao-ac-milan-retro-2007-2006-07',
  'ao-viet-nam-retro-2008',
  'ao-tap-liverpool-2026-27',
  'bo-do-tre-em-real-madrid-san-nha-2026-27',
  'bo-do-tre-em-barcelona-san-nha-2026-27',
  'bo-do-tre-em-viet-nam-2026-27',
  'quan-dau-barcelona-san-nha-2026-27',
  'quan-dau-real-madrid-san-nha-2026-27',
  'bo-quan-ao-manchester-united-san-nha-2026-27',
  'tat-bong-da-jersey',
  'khan-co-vu-viet-nam',
  'bang-doi-truong-jersey',
];

// Số giả ngẫu nhiên ổn định để seed chạy lại vẫn cho cùng kết quả
const pseudo = (n) => {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

const kitItem = ([image, teamSlug, typeSlug, colorName, price, sale, brandName, featured], team) => {
  const label = KIT_LABEL[typeSlug];
  return {
    images: [image],
    name: `Áo ${team.name} ${label} ${SEASON}`,
    team: teamSlug,
    category: team.type === 'NATIONAL' ? 'ao-doi-tuyen-quoc-gia' : 'ao-dau-cau-lac-bo',
    type: typeSlug,
    brand: brandName,
    colors: [colorName],
    price,
    sale,
    featured,
    description:
      typeSlug === 'thu-mon'
        ? `Áo thủ môn chính hãng của ${team.name} mùa giải ${SEASON}. Vải co giãn 4 chiều, đệm khuỷu tay nhẹ.`
        : `Áo đấu ${label} chính hãng của ${team.name} mùa giải ${SEASON}. Bản Fan form suông, thấm hút mồ hôi tốt, phù hợp mặc hằng ngày.`,
  };
};

// Đồng bộ biến thể theo khai báo: tạo tổ hợp còn thiếu; tổ hợp thừa thì xóa (hoặc tắt nếu đã có trong giỏ/đơn)
async function syncVariants(product, wanted, index) {
  const existing = await prisma.productVariant.findMany({
    where: { productId: product.id },
    select: { id: true, sizeId: true, colorId: true, _count: { select: { cartItems: true, orderDetails: true } } },
  });
  const key = (sizeId, colorId) => `${sizeId}:${colorId}`;
  const wantedKeys = new Set(wanted.map(({ size, color }) => key(size.id, color.id)));

  for (const v of existing.filter((v) => !wantedKeys.has(key(v.sizeId, v.colorId)))) {
    if (v._count.cartItems || v._count.orderDetails) {
      await prisma.productVariant.update({ where: { id: v.id }, data: { isActive: false } });
    } else {
      await prisma.inventoryLog.deleteMany({ where: { variantId: v.id } });
      await prisma.productVariant.delete({ where: { id: v.id } });
    }
  }

  const have = new Set(existing.map((v) => key(v.sizeId, v.colorId)));
  for (const [i, { size, color }] of wanted.entries()) {
    if (have.has(key(size.id, color.id))) continue;
    // Khoảng 10% hết hàng, 15% sắp hết để demo bộ lọc và cảnh báo tồn kho
    const r = pseudo(index * 31 + i);
    const stock = r < 0.1 ? 0 : r < 0.25 ? 1 + Math.floor(r * 16) : 8 + Math.floor(r * 40);
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sizeId: size.id,
        colorId: color.id,
        sku: `JS${String(product.id).padStart(4, '0')}-${size.name}-${slugify(color.name).toUpperCase().slice(0, 6)}`,
        stockQuantity: stock,
      },
    });
    if (stock > 0) {
      await prisma.inventoryLog.create({ data: { variantId: variant.id, change: stock, stockAfter: stock, reason: 'IMPORT', note: 'Tồn kho ban đầu (seed)' } });
    }
  }
}

// Ảnh seed có url /images/...; ảnh admin tải lên (/uploads/...) giữ nguyên
async function syncImages(product, files, color) {
  await prisma.productImage.deleteMany({ where: { productId: product.id, url: { startsWith: '/images/' } } });
  const urls = files.map(imageUrl).filter(Boolean);
  if (!urls.length) return;
  const hasPrimary = await prisma.productImage.count({ where: { productId: product.id, isPrimary: true } });
  await prisma.productImage.createMany({
    data: urls.map((url, i) => ({ productId: product.id, url, alt: product.name, colorId: color.id, sortOrder: i, isPrimary: i === 0 && !hasPrimary })),
  });
}

async function seedProducts() {
  const [teams, categories, types, brands, sizes, colors] = await Promise.all([
    prisma.team.findMany(),
    prisma.category.findMany(),
    prisma.productType.findMany(),
    prisma.brand.findMany(),
    prisma.size.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.color.findMany(),
  ]);
  const by = (list, key) => Object.fromEntries(list.map((x) => [x[key], x]));
  const team = by(teams, 'slug');
  const category = by(categories, 'slug');
  const type = by(types, 'slug');
  const brand = by(brands, 'name');
  const color = by(colors, 'name');
  const sizesOf = (sizeType, names) => sizes.filter((s) => s.sizeType === sizeType && (!names || names.includes(s.name)));

  const items = [...KITS.map((kit) => kitItem(kit, team[kit[1]])), ...OTHERS].map((item) => ({ ...CATEGORY_DEFAULTS[item.category], ...item }));

  for (const [i, item] of items.entries()) {
    const index = i + 1;
    const season = item.season === undefined ? SEASON : item.season;
    const slug = slugify([item.name, season && !item.name.includes(season) ? season.replace('/', '-') : null].filter(Boolean).join(' '));
    const data = {
      name: item.name,
      slug,
      categoryId: category[item.category].id,
      teamId: item.team ? team[item.team].id : null,
      productTypeId: item.type ? type[item.type].id : null,
      brandId: item.brand ? brand[item.brand].id : null,
      season,
      gender: item.gender ?? 'UNISEX',
      material: item.material === undefined ? JERSEY_MATERIAL : item.material,
      description: item.description ?? null,
      basePrice: item.price,
      salePrice: item.sale ?? null,
      status: 'ACTIVE',
      isFeatured: Boolean(item.featured),
      soldCount: Math.floor(pseudo(index) * 240),
      deletedAt: null,
      createdAt: days(-Math.floor(pseudo(index + 100) * 90)),
    };
    const product = await prisma.product.upsert({ where: { slug }, update: { ...data, createdAt: undefined }, create: data });

    const variantSizes = sizesOf(item.sizeType ?? 'ADULT', item.sizes);
    const wanted = item.colors.flatMap((c) => variantSizes.map((size) => ({ size, color: color[c] })));
    await syncVariants(product, wanted, index);
    await syncImages(product, item.images ?? [], color[item.colors[0]]);
  }

  await prisma.product.updateMany({
    where: { slug: { in: RETIRED_SLUGS }, deletedAt: null },
    data: { deletedAt: new Date(), status: 'INACTIVE', isFeatured: false },
  });
}

async function seedSettings() {
  if (await prisma.systemSetting.count()) return;
  await prisma.systemSetting.create({
    data: {
      storeName: 'JERSEY',
      storeEmail: 'hello@jersey.vn',
      storePhone: '0243869999',
      storeAddress: '55 Giải Phóng, Hai Bà Trưng, Hà Nội',
      shippingFee: 30000,
      freeShipThreshold: 500000,
    },
  });
}

async function main() {
  await seedRoles();
  await seedAccounts();
  await seedMasterData();
  await seedMarketing();
  await seedNews();
  await seedSettings();
  await seedProducts();
  console.info('✔ Seed dữ liệu mẫu hoàn tất');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
