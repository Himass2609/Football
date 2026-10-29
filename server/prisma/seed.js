// Dữ liệu mẫu cho môi trường dev — chạy lại nhiều lần an toàn (upsert theo khóa duy nhất)
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, ROLES } from '../src/config/constants.js';
import { slugify } from '../src/utils/slugify.js';

const prisma = new PrismaClient();

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
      { name: 'Phụ kiện bóng đá', description: 'Tất, băng đội trưởng, khăn, mũ', sortOrder: 8 },
    ],
    withSlug,
  );

  await upsertByName(
    'brand',
    ['Adidas', 'Nike', 'Puma', 'New Balance', 'Umbro', 'Kappa'].map((name) => ({ name })),
    withSlug,
  );

  await upsertByName(
    'league',
    [
      { name: 'Premier League', country: 'Anh', type: 'CLUB' },
      { name: 'La Liga', country: 'Tây Ban Nha', type: 'CLUB' },
      { name: 'Serie A', country: 'Ý', type: 'CLUB' },
      { name: 'Bundesliga', country: 'Đức', type: 'CLUB' },
      { name: 'Ligue 1', country: 'Pháp', type: 'CLUB' },
      { name: 'V.League 1', country: 'Việt Nam', type: 'CLUB' },
      { name: 'Đội tuyển quốc gia', country: null, type: 'NATIONAL' },
    ],
    withSlug,
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
    ['Bayern Munich', 'BAY', 'Bundesliga', '#DC052D', '#FFFFFF', 'PLAIN', true, 'Đức'],
    ['Borussia Dortmund', 'BVB', 'Bundesliga', '#FDE100', '#111111', 'PLAIN', false, 'Đức'],
    ['Juventus', 'JUV', 'Serie A', '#111111', '#FFFFFF', 'STRIPES', true, 'Ý'],
    ['AC Milan', 'MIL', 'Serie A', '#FB090B', '#111111', 'STRIPES', false, 'Ý'],
    ['Inter Milan', 'INT', 'Serie A', '#0068A8', '#111111', 'STRIPES', false, 'Ý'],
    ['Paris Saint-Germain', 'PSG', 'Ligue 1', '#004170', '#DA291C', 'PLAIN', false, 'Pháp'],
    ['Hà Nội FC', 'HNFC', 'V.League 1', '#5B2C83', '#FFFFFF', 'PLAIN', false, 'Việt Nam'],
    ['Việt Nam', 'VIE', 'Đội tuyển quốc gia', '#DA251D', '#FFDD00', 'PLAIN', true, 'Việt Nam'],
    ['Argentina', 'ARG', 'Đội tuyển quốc gia', '#75AADB', '#FFFFFF', 'STRIPES', false, 'Argentina'],
    ['Brazil', 'BRA', 'Đội tuyển quốc gia', '#FFDC02', '#009B3A', 'PLAIN', false, 'Brazil'],
    ['Pháp', 'FRA', 'Đội tuyển quốc gia', '#21304D', '#FFFFFF', 'PLAIN', false, 'Pháp'],
    ['Đức', 'GER', 'Đội tuyển quốc gia', '#FFFFFF', '#111111', 'PLAIN', false, 'Đức'],
    ['Anh', 'ENG', 'Đội tuyển quốc gia', '#FFFFFF', '#CF081F', 'PLAIN', false, 'Anh'],
    ['Bồ Đào Nha', 'POR', 'Đội tuyển quốc gia', '#E42518', '#046A38', 'PLAIN', false, 'Bồ Đào Nha'],
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
    withSlug,
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

// ───────── Sản phẩm mẫu (Phase 2) ─────────
const SEASON = '2026/27';
const JERSEY_MATERIAL = 'Polyester tái chế, công nghệ thoát nhiệt';

// [slug đội, loại (san-nha|san-khach), màu, giá gốc, giá sale, hãng, nổi bật]
const KITS = [
  ['real-madrid', 'san-nha', 'Trắng', 890000, null, 'Adidas', true],
  ['real-madrid', 'san-khach', 'Đen', 890000, null, 'Adidas'],
  ['barcelona', 'san-nha', 'Đỏ', 890000, 790000, 'Nike', true],
  ['barcelona', 'san-khach', 'Vàng', 890000, null, 'Nike'],
  ['liverpool', 'san-nha', 'Đỏ', 850000, null, 'Adidas', true],
  ['manchester-united', 'san-nha', 'Đỏ', 850000, null, 'Adidas', true],
  ['manchester-united', 'san-khach', 'Trắng', 850000, 690000, 'Adidas'],
  ['manchester-city', 'san-nha', 'Xanh da trời', 850000, null, 'Puma'],
  ['arsenal', 'san-nha', 'Đỏ', 850000, null, 'Adidas'],
  ['chelsea', 'san-nha', 'Xanh dương', 850000, null, 'Nike'],
  ['bayern-munich', 'san-nha', 'Đỏ', 850000, null, 'Adidas'],
  ['borussia-dortmund', 'san-nha', 'Vàng', 790000, null, 'Puma'],
  ['juventus', 'san-nha', 'Đen', 850000, null, 'Adidas'],
  ['ac-milan', 'san-nha', 'Đỏ', 790000, null, 'Puma'],
  ['inter-milan', 'san-nha', 'Xanh dương', 790000, null, 'Nike'],
  ['paris-saint-germain', 'san-nha', 'Xanh navy', 890000, null, 'Nike'],
  ['atletico-madrid', 'san-nha', 'Đỏ', 790000, null, 'Nike'],
  ['ha-noi-fc', 'san-nha', 'Tím', 450000, null, null],
  ['viet-nam', 'san-nha', 'Đỏ', 550000, null, null, true],
  ['viet-nam', 'san-khach', 'Trắng', 550000, null, null],
  ['argentina', 'san-nha', 'Xanh da trời', 950000, null, 'Adidas', true],
  ['brazil', 'san-nha', 'Vàng', 950000, null, 'Nike'],
  ['phap', 'san-nha', 'Xanh navy', 950000, 850000, 'Nike'],
  ['duc', 'san-nha', 'Trắng', 950000, null, 'Adidas'],
  ['anh', 'san-nha', 'Trắng', 950000, null, 'Nike'],
  ['bo-dao-nha', 'san-nha', 'Đỏ', 950000, null, 'Nike'],
];

// Sản phẩm khác: { name, team, category, type, brand, colors, sizeType, price, sale, season, gender, material, description }
const OTHERS = [
  { name: 'Áo Real Madrid sân nhà 2026/27 – bản Player', team: 'real-madrid', category: 'ao-dau-cau-lac-bo', type: 'san-nha', brand: 'Adidas', colors: ['Trắng'], sizes: ['S', 'M', 'L', 'XL'], price: 1690000, description: 'Phiên bản cầu thủ: form ôm, vải siêu nhẹ, logo ép nhiệt.' },
  { name: 'Áo Barcelona sân nhà 2026/27 – bản Player', team: 'barcelona', category: 'ao-dau-cau-lac-bo', type: 'san-nha', brand: 'Nike', colors: ['Đỏ'], sizes: ['S', 'M', 'L', 'XL'], price: 1690000, description: 'Phiên bản cầu thủ: form ôm, vải siêu nhẹ, logo ép nhiệt.' },
  { name: 'Áo Manchester United retro 1999', team: 'manchester-united', category: 'ao-retro', type: 'phien-ban-ky-niem', brand: 'Umbro', colors: ['Đỏ'], price: 750000, season: '1998/99', material: 'Cotton pha polyester', description: 'Tái bản mẫu áo mùa giải lịch sử 1998/99.' },
  { name: 'Áo Brazil retro 2002', team: 'brazil', category: 'ao-retro', type: 'phien-ban-ky-niem', brand: 'Nike', colors: ['Vàng'], price: 750000, season: '2002', material: 'Cotton pha polyester', description: 'Mẫu áo gắn với chức vô địch World Cup 2002.' },
  { name: 'Áo AC Milan retro 2007', team: 'ac-milan', category: 'ao-retro', type: 'phien-ban-ky-niem', brand: 'Adidas', colors: ['Đỏ'], price: 750000, season: '2006/07', material: 'Cotton pha polyester' },
  { name: 'Áo Việt Nam retro 2008', team: 'viet-nam', category: 'ao-retro', type: 'phien-ban-ky-niem', brand: null, colors: ['Đỏ'], price: 450000, sale: 390000, season: '2008', description: 'Kỷ niệm chức vô địch AFF Cup 2008.' },
  { name: 'Áo tập Real Madrid', team: 'real-madrid', category: 'do-tap-luyen', type: 'tap-luyen', brand: 'Adidas', colors: ['Trắng', 'Xanh navy'], price: 490000 },
  { name: 'Áo tập Liverpool', team: 'liverpool', category: 'do-tap-luyen', type: 'tap-luyen', brand: 'Adidas', colors: ['Đỏ', 'Đen'], price: 490000 },
  { name: 'Áo khoác tập Manchester City', team: 'manchester-city', category: 'do-tap-luyen', type: 'tap-luyen', brand: 'Puma', colors: ['Xanh navy'], price: 990000, material: 'Polyester chống gió' },
  { name: 'Bộ đồ trẻ em Real Madrid sân nhà', team: 'real-madrid', category: 'do-tre-em', type: 'san-nha', brand: 'Adidas', colors: ['Trắng'], sizeType: 'KID', price: 590000, gender: 'KIDS' },
  { name: 'Bộ đồ trẻ em Barcelona sân nhà', team: 'barcelona', category: 'do-tre-em', type: 'san-nha', brand: 'Nike', colors: ['Đỏ'], sizeType: 'KID', price: 590000, gender: 'KIDS' },
  { name: 'Bộ đồ trẻ em Việt Nam', team: 'viet-nam', category: 'do-tre-em', type: 'san-nha', brand: null, colors: ['Đỏ'], sizeType: 'KID', price: 390000, gender: 'KIDS' },
  { name: 'Quần đấu Barcelona sân nhà', team: 'barcelona', category: 'quan-bong-da', type: 'san-nha', brand: 'Nike', colors: ['Xanh navy'], price: 390000 },
  { name: 'Quần đấu Real Madrid sân nhà', team: 'real-madrid', category: 'quan-bong-da', type: 'san-nha', brand: 'Adidas', colors: ['Trắng'], price: 390000 },
  { name: 'Bộ quần áo Manchester United sân nhà', team: 'manchester-united', category: 'bo-quan-ao-bong-da', type: 'san-nha', brand: 'Adidas', colors: ['Đỏ'], price: 1090000, sale: 950000 },
  { name: 'Tất bóng đá JERSEY', team: null, category: 'phu-kien-bong-da', type: null, brand: null, colors: ['Trắng', 'Đen'], sizeType: 'ONE', price: 120000, season: null, material: 'Cotton co giãn', description: 'Tất cao cổ, đệm lòng bàn chân, chống trơn.' },
  { name: 'Khăn cổ vũ Việt Nam', team: 'viet-nam', category: 'phu-kien-bong-da', type: null, brand: null, colors: ['Đỏ'], sizeType: 'ONE', price: 180000, season: null, material: 'Acrylic dệt kim' },
  { name: 'Băng đội trưởng JERSEY', team: null, category: 'phu-kien-bong-da', type: null, brand: null, colors: ['Vàng', 'Đen'], sizeType: 'ONE', price: 90000, season: null, material: 'Thun co giãn' },
];

// Số giả ngẫu nhiên ổn định để seed chạy lại vẫn cho cùng kết quả
const pseudo = (n) => {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

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

  const items = [
    ...KITS.map(([teamSlug, typeSlug, colorName, price, sale, brandName, featured]) => {
      const t = team[teamSlug];
      return {
        name: `Áo ${t.name} ${typeSlug === 'san-nha' ? 'sân nhà' : 'sân khách'} ${SEASON}`,
        team: teamSlug,
        category: t.type === 'NATIONAL' ? 'ao-doi-tuyen-quoc-gia' : 'ao-dau-cau-lac-bo',
        type: typeSlug,
        brand: brandName,
        colors: [colorName],
        price,
        sale,
        featured,
        description: `Áo đấu ${typeSlug === 'san-nha' ? 'sân nhà' : 'sân khách'} chính hãng của ${t.name} mùa giải ${SEASON}. Bản Fan form suông, thấm hút mồ hôi tốt, phù hợp mặc hằng ngày.`,
      };
    }),
    ...OTHERS,
  ];

  let index = 0;
  for (const item of items) {
    index += 1;
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
      material: item.material ?? JERSEY_MATERIAL,
      description: item.description ?? null,
      basePrice: item.price,
      salePrice: item.sale ?? null,
      status: 'ACTIVE',
      isFeatured: Boolean(item.featured),
      soldCount: Math.floor(pseudo(index) * 240),
      createdAt: days(-Math.floor(pseudo(index + 100) * 90)),
    };
    const product = await prisma.product.upsert({ where: { slug }, update: { ...data, createdAt: undefined }, create: data });

    const variantSizes = sizesOf(item.sizeType ?? 'ADULT', item.sizes);
    for (const [ci, colorName] of item.colors.entries()) {
      for (const [si, size] of variantSizes.entries()) {
        const exists = await prisma.productVariant.findUnique({
          where: { productId_sizeId_colorId: { productId: product.id, sizeId: size.id, colorId: color[colorName].id } },
        });
        if (exists) continue;
        // Khoảng 10% hết hàng, 15% sắp hết để demo bộ lọc và cảnh báo tồn kho
        const r = pseudo(index * 31 + ci * 7 + si);
        const stock = r < 0.1 ? 0 : r < 0.25 ? 1 + Math.floor(r * 16) : 8 + Math.floor(r * 40);
        const variant = await prisma.productVariant.create({
          data: {
            productId: product.id,
            sizeId: size.id,
            colorId: color[colorName].id,
            sku: `JS${String(product.id).padStart(4, '0')}-${size.name}-${slugify(colorName).toUpperCase().slice(0, 6)}`,
            stockQuantity: stock,
          },
        });
        if (stock > 0) {
          await prisma.inventoryLog.create({ data: { variantId: variant.id, change: stock, stockAfter: stock, reason: 'IMPORT', note: 'Tồn kho ban đầu (seed)' } });
        }
      }
    }
  }
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
