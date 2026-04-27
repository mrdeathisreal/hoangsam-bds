/**
 * seed.js — nạp 5 tin đăng mẫu vào Firestore.
 *
 * Tách riêng module để:
 *   - Không load vào bundle chính mỗi lần user mở site.
 *   - Chỉ admin được gọi (kiểm tra lại ở client, server đã chặn ở rules).
 *   - Data đã được craft để pass validator (priceLabel chuẩn, area whitelist,
 *     bedrooms/bathrooms hợp lý).
 */

import { addListing } from './store.js';
import { isAdmin } from './auth.js';

export const SAMPLE_LISTINGS = [
  {
    title: 'Nhà phố 3 tầng KDC Bình Hưng — 13 phòng cho thuê',
    location: 'KDC Bình Hưng, Xã Bình Hưng, Huyện Bình Chánh, TP.HCM',
    area: 'Bình Chánh',
    propertyType: 'nha-pho',
    legalStatus: 'so-hong',
    price: '9.8 tỷ',
    bedrooms: 13,
    bathrooms: 13,
    areaSqm: 180,
    image: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200&q=80',
    description: 'Nhà phố 3 tầng mặt tiền đường nội bộ, thiết kế 13 phòng khép kín '
                + 'đang cho thuê ổn định. Khu dân cư an ninh, gần chợ và trường học. '
                + 'Thích hợp đầu tư dòng tiền hoặc ở kết hợp kinh doanh.',
  },
  {
    title: 'Căn hộ Riviera Point Quận 7 — 2PN view sông',
    location: 'Đường Nguyễn Văn Linh, Phường Tân Phú, Quận 7, TP.HCM',
    area: 'Quận 7',
    propertyType: 'can-ho',
    legalStatus: 'hop-dong-mua-ban',
    price: '4.5 tỷ',
    bedrooms: 2,
    bathrooms: 2,
    areaSqm: 82,
    image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80',
    description: 'Căn hộ cao cấp view sông Sài Gòn, full nội thất nhập khẩu. '
                + 'Tiện ích 5 sao: hồ bơi, gym, BBQ sân vườn. Sổ đang chờ ra.',
  },
  {
    title: 'Biệt thự compound Thảo Điền — hồ bơi riêng',
    location: 'Đường Xuân Thủy, Phường Thảo Điền, Thủ Đức, TP.HCM',
    area: 'Thủ Đức',
    propertyType: 'biet-thu',
    legalStatus: 'so-hong',
    price: '38 tỷ',
    bedrooms: 5,
    bathrooms: 5,
    areaSqm: 420,
    image: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1200&q=80',
    description: 'Biệt thự compound khu ngoại giao đoàn, hồ bơi riêng, sân vườn '
                + '120m². An ninh 24/7, cộng đồng cư dân chất lượng cao.',
  },
  {
    title: 'Đất nền KDC Phong Phú — 100m² sổ đỏ riêng',
    location: 'Xã Phong Phú, Huyện Bình Chánh, TP.HCM',
    area: 'Bình Chánh',
    propertyType: 'dat-nen',
    legalStatus: 'so-do',
    price: '2.8 tỷ',
    bedrooms: 0,
    bathrooms: 0,
    areaSqm: 100,
    image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80',
    description: 'Đất nền sổ đỏ riêng, đường nhựa 12m xe hơi vào tận nơi. '
                + 'Hạ tầng hoàn chỉnh, điện nước âm. Thổ cư 100%.',
  },
  {
    title: 'Nhà phố mặt tiền Hậu Giang Quận 6 — tiện kinh doanh',
    location: '123 Đường Hậu Giang, Phường 5, Quận 6, TP.HCM',
    area: 'Quận 6',
    propertyType: 'nha-pho',
    legalStatus: 'so-hong',
    price: '14 tỷ',
    bedrooms: 4,
    bathrooms: 4,
    areaSqm: 120,
    image: 'https://images.unsplash.com/photo-1449844908441-8829872d2607?w=1200&q=80',
    description: 'Nhà 1 trệt 3 lầu mặt tiền đường Hậu Giang sầm uất. '
                + 'Đang cho thuê 45 triệu/tháng, khách ổn định 3 năm. '
                + 'Thích hợp vừa ở vừa kinh doanh.',
  },
];

/**
 * seedSampleData — nạp SAMPLE_LISTINGS vào Firestore.
 * @returns {Promise<{success: number, failed: number, errors: Array}>}
 */
export async function seedSampleData() {
  if (!isAdmin()) {
    throw {
      code: 'permission-denied',
      message: 'Chỉ admin mới được nạp dữ liệu mẫu.',
    };
  }

  const results = { success: 0, failed: 0, errors: [] };

  // Tuần tự (không parallel) để tránh burst quota + để thứ tự updatedAt
  // có khoảng cách rõ ràng khi sort.
  for (const listing of SAMPLE_LISTINGS) {
    try {
      await addListing(listing);
      results.success++;
    } catch (err) {
      results.failed++;
      results.errors.push({
        title: listing.title,
        message: err?.message || 'Lỗi không xác định',
      });
      console.error('[seed] failed for:', listing.title, err);
    }
  }

  return results;
}
