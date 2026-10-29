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
  console.info('✔ Seed dữ liệu mẫu hoàn tất');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
