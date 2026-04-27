/**
 * i18n.js
 * ----------------------------------------------------------------------------
 * Tiny i18n runtime — hỗ trợ VI (default) / EN / ZH-Hant.
 *
 * Cách dùng:
 *   1. Gắn `data-i18n="key"` lên mọi element cần dịch (textContent).
 *   2. Gắn `data-i18n-ph="key"` cho placeholder.
 *   3. Gắn `data-i18n-aria="key"` cho aria-label.
 *   4. Trong JS: `t('toast.saved')` để lấy chuỗi.
 *   5. `setLang('en')` → đổi ngôn ngữ, `applyI18n()` sẽ được gọi tự động.
 *
 * Ngôn ngữ được persist trong localStorage (`hs_lang`).
 * Không dùng bundler — file tự contained, export ES modules.
 * ----------------------------------------------------------------------------
 */

const STORAGE_KEY = 'hs_lang';
const DEFAULT_LANG = 'vi';
const SUPPORTED = ['vi', 'en', 'zh'];

/* ───────────────────────── Dictionaries ───────────────────────── */

const DICTS = {
  vi: {
    'brand.name':         'Hoàng Sâm',
    'brand.tagline':      'Bất động sản Sài Gòn',

    'nav.add':            'Thêm tin',
    'nav.logout':         'Đăng xuất',
    'nav.login':          'Đăng nhập',
    'nav.call':           'Gọi ngay',
    'nav.admin':          'Marshall Ng',

    'hero.title':         'Bất động sản chính chủ tại TP.HCM',
    'hero.subtitle':      'Nhà phố · Căn hộ · Đất nền — minh bạch pháp lý, hình ảnh thật.',

    'filter.search_ph':   'Tìm theo tên, địa chỉ, khu vực...',
    'filter.area_all':    'Tất cả khu vực',
    'filter.sort_default':'Giá cao → thấp',
    'filter.reset':       'Xoá lọc',

    'listings.title':     'Tin đăng',
    'listings.loading':   'Đang tải...',
    'listings.count':     '{n} tin đăng',
    'listings.count_filtered': '{n}/{total} tin đăng',

    'empty.title':        'Chưa có tin đăng nào',
    'empty.msg':          'Thử đổi bộ lọc hoặc thêm tin đăng mới.',
    'empty.admin_title':  'Bắt đầu danh mục của bạn',
    'empty.admin_msg':    'Thêm tin đăng đầu tiên, hoặc nạp 5 tin mẫu để xem giao diện hoạt động.',
    'empty.seed':         'Nạp 5 tin mẫu',
    'empty.nomatch_title':'Không tìm thấy tin phù hợp',
    'empty.nomatch_msg':  'Thử đổi từ khoá hoặc xoá bộ lọc.',
    'empty.clear_filter': 'Xoá lọc',
    'empty.err_title':    'Không thể tải dữ liệu',
    'empty.retry':        'Thử lại',

    'form.add_title':     'Thêm tin đăng mới',
    'form.edit_title':    'Chỉnh sửa tin đăng',
    'form.title':         'Tiêu đề',
    'form.title_ph':      'VD: Nhà phố 2 tầng, KDC Bình Hưng',
    'form.location':      'Địa chỉ',
    'form.location_ph':   'Số nhà, đường, phường, quận',
    'form.area':          'Khu vực',
    'form.property':      'Loại BĐS',
    'form.legal':         'Pháp lý',
    'form.price':         'Giá',
    'form.price_ph':      'VD: 9.8 tỷ hoặc 9800000000',
    'form.area_sqm':      'Diện tích (m²)',
    'form.area_sqm_ph':   'VD: 80',
    'form.bedrooms':      'Phòng ngủ',
    'form.bathrooms':     'Phòng tắm',
    'form.images':        'Ảnh (dòng đầu là ảnh bìa — dán URL hoặc bấm chọn ảnh từ máy)',
    'form.images_ph':     'https://...\nhttps://...\nhoặc bấm nút bên trên để chọn ảnh',
    'form.images_hint':   'Ảnh được nén tự động (tối ưu xuống ~85KB mỗi ảnh, kể cả ảnh 8K). Tối đa 10 ảnh / tin.',
    'form.pick_images':   'Pick images',
    'form.clear_images':  'Clear all',
    'form.picker_compressing': 'Compressing {i}/{n}...',
    'form.picker_done':   'Added {n} images (~{size}).',
    'form.picker_error':  'Error: {msg}',
    'preview.title':      'Review images before applying',
    'preview.apply':      'Apply these images',
    'preview.cancel':     'Cancel (keep old)',
    'form.description':   'Mô tả',
    'form.description_ph':'Mô tả chi tiết về bất động sản...',
    'form.title_en':      'Tiêu đề (English) — tuỳ chọn',
    'form.title_en_ph':   'e.g., 2-story townhouse, Binh Hung',
    'form.title_zh':      '標題 (中文) — tuỳ chọn',
    'form.title_zh_ph':   '例如:Binh Hung 兩層樓連排屋',
    'form.description_en':'Mô tả (English) — tuỳ chọn',
    'form.description_en_ph':'Detailed description in English so Western clients can understand...',
    'form.description_zh':'描述 (中文) — tuỳ chọn',
    'form.description_zh_ph':'中文詳細描述,方便台灣/華語客戶閱讀...',
    'form.i18n_hint':     'Nhập bản dịch EN/中文 để khách nước ngoài đọc được tin đăng. Để trống sẽ tự hiện bản tiếng Việt.',
    'form.i18n_group_title':'🌐 Bản dịch cho khách nước ngoài (EN / 中文)',
    'form.auto_translate':'Tự động dịch VI → EN + 中',
    'a11y.skip':          'Bỏ qua đến nội dung chính',
    'form.cancel':        'Huỷ',
    'form.status':        'Hiện trạng',
    'form.status_none':   '-- Không hiển thị (mặc định) --',
    'form.status_hint':   'Nếu chọn → card sẽ hiện huy hiệu tương ứng và ẩn nút sao.',
    'status.new':         'Hàng mới',
    'status.deposit':     'Đã có cọc',
    'status.sold':        'Đã bán',
    'status.repair':      'Đang sửa chữa',
    'status.renting':     'Đang cho thuê',
    'form.submit_add':    'Đăng tin',
    'form.submit_update': 'Cập nhật',
    'form.select_placeholder': '-- Chọn --',

    'login.title':        'Đăng nhập admin',
    'login.email':        'Email',
    'login.password':     'Mật khẩu',
    'login.submit':       'Đăng nhập',

    'lightbox.close':     'Đóng',
    'lightbox.prev':      'Ảnh trước',
    'lightbox.next':      'Ảnh kế',
    'lightbox.counter':   '{i} / {n}',
    'lightbox.open_image':'Xem ảnh tin đăng',

    'toast.saved':        'Đã lưu',
    'toast.added':        'Đã đăng tin mới thành công.',
    'toast.updated':      'Đã cập nhật tin đăng.',
    'toast.deleted':      'Đã xoá tin đăng.',
    'toast.delete_confirm': 'Xoá "{title}"? Hành động này không thể hoàn tác.',
    'toast.login_ok':     'Đăng nhập admin thành công.',
    'toast.logout':       'Đã đăng xuất admin.',
    'toast.logout_confirm': 'Bạn có chắc muốn đăng xuất?',
    'toast.need_admin':   'Bạn cần đăng nhập admin.',
    'toast.seeding':      'Đang nạp tin mẫu...',
    'toast.seed_ok':      'Đã nạp {n} tin mẫu thành công.',
    'toast.generic_err':  'Có lỗi xảy ra',

    'property.nha-pho':   'Nhà phố',
    'property.can-ho':    'Căn hộ',
    'property.biet-thu':  'Biệt thự',
    'property.dat-nen':   'Đất nền',
    'property.shophouse': 'Shophouse',
    'property.kho-xuong': 'Kho/Xưởng',
    'property.khac':      'Khác',

    'legal.so-hong':           'Sổ hồng',
    'legal.so-do':             'Sổ đỏ',
    'legal.hop-dong-mua-ban':  'HĐ mua bán',
    'legal.giay-tay':          'Giấy tay',
    'legal.dang-cho':          'Đang chờ',
    'legal.khac':              'Khác',

    'spec.sqm':           'm²',
    'spec.bed':           'PN',
    'spec.bath':          'WC',
    'spec.photos':        '{n} ảnh',
    'spec.contact':       'Liên hệ',






    'team.title':         'Đội ngũ tư vấn Hoàng Sâm',
    'team.subtitle':      'Bất động sản chính chủ tại TP.HCM — đội ngũ tư vấn được đào tạo bài bản, am hiểu pháp lý Việt Nam, phản hồi nhanh, phục vụ khách trong nước và nước ngoài.',
    'team.change_role':   'Đổi vai trò truy cập',
    'team.pro_badge':     'Đang hoạt động',
    'team.open_tool':     'Mở chat',
    'team.settings_btn':  'Cài đặt API key',
    'team.chat_name':     'Tư vấn viên',
    'team.chat_role':     'Tư vấn BĐS · Đặt lịch xem nhà',
    'team.chat_bio':      'Nắm rõ toàn bộ tin đăng, tư vấn pháp lý, vay ngân hàng, phong thuỷ. Khi khách muốn xem nhà, chuyển tiếp ngay cho Marshall qua Zalo.',
    'team.formatter_name':'Biên tập viên nội dung',
    'team.formatter_role':'Thông tin thô → Bài đăng chuẩn SEO',
    'team.formatter_bio': 'Dán vài dòng thông số nhà — nhận lại bài đăng Facebook/web chuẩn SEO, có cấu trúc, đa ngôn ngữ theo yêu cầu.',

    'client.years':       'năm kinh nghiệm bất động sản Sài Gòn',
    'client.support':     'đội ngũ tư vấn sẵn sàng phản hồi',
    'client.legal':       'chính chủ, pháp lý minh bạch',
    'client.pitch':       'Đội ngũ của Hoàng Sâm am hiểu toàn bộ tin đăng hiện có, pháp luật bất động sản Việt Nam, quy trình công chứng — sang tên, vay ngân hàng và chính sách mua nhà dành cho người nước ngoài. Chúng tôi phục vụ khách hàng bằng tiếng Việt, English và 繁體中文.',
    'client.chat':        'Trò chuyện với tư vấn viên',
    'client.book':        'Đặt lịch xem nhà',

    'role.toggle_hint':   'Bật: Cộng tác viên · Tắt: Khách hàng',
    'role.client_label':  'Khách',
    'role.ctv_label':     'Cộng tác viên',
    'role.toggle_title':  'Bật = Cộng tác viên · Tắt = Khách hàng',

    'apt.title':          'Đặt lịch xem nhà',
    'apt.subtitle':       'Marshall Ng sẽ xác nhận qua Zalo trong 15 phút',
    'apt.name':           'Họ và tên *',
    'apt.phone':          'Số điện thoại *',
    'apt.date':           'Ngày xem *',
    'apt.time':           'Giờ xem *',
    'apt.listing':        'Tin đăng muốn xem (tuỳ chọn)',
    'apt.note':           'Ghi chú (nếu có)',
    'apt.cancel':         'Huỷ',
    'apt.submit':         '📅 Xác nhận & gửi Zalo',
    'apt.hint':           '💡 Thông tin sẽ được copy sẵn — mở Zalo Marshall Ng và Ctrl+V là gửi được ngay.',

    'ai.no_key_msg':      'Chưa có Gemini API key. Lấy free tại aistudio.google.com rồi bấm Cài đặt.',
    'ai.show_system':     'Xem system prompt (chỉ CTV mới thấy)',
    'ai.templates_title': 'Mẫu prompt sẵn (bấm để điền)',
    'ai.input_title':     'Yêu cầu của bạn',
    'ai.output_title':    'Phản hồi',
    'ai.run':             '▶ Gửi',
    'ai.stop':            '■ Dừng',
    'ai.copy':            'Copy',
    'ai.book_from_chat':  '📅 Đặt lịch xem nhà',
    'ai.key_dialog_title':'Cài đặt Gemini API key',
    'ai.key_open_studio': 'Mở Google AI Studio (free 15 req/phút)',
    'ai.key_step_1':      'Đăng nhập bằng tài khoản Google của bạn',
    'ai.key_step_2':      'Bấm nút "Create API key" → Copy key vừa tạo',
    'ai.key_step_3':      'Dán key vào ô bên dưới rồi bấm Lưu',
    'ai.key_privacy':     '🔒 Key chỉ lưu trên máy bạn (localStorage) — không gửi đi đâu ngoài Google.',
    'ai.key_input_label': 'API key',
    'ai.key_cancel':      'Huỷ',
    'ai.key_save':        'Lưu key',

    'footer.copyright':   '© hoangsam.bds · Bất động sản Sài Gòn',
    'footer.contact':     'Liên hệ',
    'footer.facebook':    'Facebook',
    'footer.zalo':        'Zalo',
    'footer.line':        'LINE',
    'footer.gmail':       'Email',
    'comments.delete':         'Xoá bình luận',
    'comments.delete_confirm': 'Xoá bình luận này? Không thể hoàn tác.',
    'comments.deleted':        'Đã xoá bình luận.',

    'card.favorite':      'Lưu tin',
    'card.unfavorite':    'Bỏ lưu',
    'card.feature':       'Đặt nổi bật',
    'card.unfeature':     'Bỏ nổi bật',
    'card.featured_badge':'Nổi bật',

    'comments.title':     'Bình luận',
    'comments.empty':     'Chưa có bình luận. Hãy là người đầu tiên!',
    'comments.name_ph':   'Tên của bạn',
    'comments.message_ph':'Viết bình luận...',
    'comments.send':      'Gửi',
    'comments.hint':      'Bình luận sẽ hiển thị công khai với tất cả người xem.',
    'comments.anonymous': 'Ẩn danh',
    'comments.sent':      'Đã gửi bình luận.',
    'comments.err':       'Gửi bình luận thất bại. Vui lòng thử lại.',
    'comments.rate_limit':'Vui lòng đợi 1 phút giữa 2 lần gửi bình luận.',
    'spam.too_many':      'Bạn đã thao tác quá nhiều. Vui lòng thử lại sau {wait}.',
    'form.auto_translating':'Đang tự động dịch sang EN + 中…',

    'toast.fav_added':    'Đã lưu vào tin yêu thích.',
    'toast.fav_removed':  'Đã bỏ khỏi tin yêu thích.',
    'toast.feat_on':      'Đã đặt tin nổi bật.',
    'toast.feat_off':     'Đã bỏ nổi bật.',
  },

  en: {
    'brand.name':         'Hoàng Sâm',
    'brand.tagline':      'Saigon Real Estate',

    'nav.add':            'Add listing',
    'nav.logout':         'Sign out',
    'nav.login':          'Sign in',
    'nav.call':           'Call now',
    'nav.admin':          'Marshall Ng',

    'hero.title':         'Direct-owner real estate in Ho Chi Minh City',
    'hero.subtitle':      'Townhouses · Apartments · Land — clear legal, real photos.',

    'filter.search_ph':   'Search by name, address, district...',
    'filter.area_all':    'All districts',
    'filter.sort_default':'Price high → low',
    'filter.reset':       'Clear filters',

    'listings.title':     'Listings',
    'listings.loading':   'Loading...',
    'listings.count':     '{n} listings',
    'listings.count_filtered': '{n}/{total} listings',

    'empty.title':        'No listings yet',
    'empty.msg':          'Try a different filter or add a new listing.',
    'empty.admin_title':  'Start your catalog',
    'empty.admin_msg':    'Add your first listing, or load 5 samples to see how it looks.',
    'empty.seed':         'Load 5 samples',
    'empty.nomatch_title':'No matching listings',
    'empty.nomatch_msg':  'Try different keywords or clear the filters.',
    'empty.clear_filter': 'Clear filters',
    'empty.err_title':    'Unable to load data',
    'empty.retry':        'Retry',

    'form.add_title':     'New listing',
    'form.edit_title':    'Edit listing',
    'form.title':         'Title',
    'form.title_ph':      'e.g., 2-story townhouse, Binh Hung residential area',
    'form.location':      'Address',
    'form.location_ph':   'Street number, street, ward, district',
    'form.area':          'District',
    'form.property':      'Property type',
    'form.legal':         'Legal status',
    'form.price':         'Price',
    'form.price_ph':      'e.g., 9.8 billion or 9800000000',
    'form.area_sqm':      'Area (m²)',
    'form.area_sqm_ph':   'e.g., 80',
    'form.bedrooms':      'Bedrooms',
    'form.bathrooms':     'Bathrooms',
    'form.images':        'Images (first line is cover — paste URLs or click to pick from device)',
    'form.images_ph':     'https://...\nhttps://...\nor click button above to pick',
    'form.images_hint':   'Images auto-compressed (~85KB each, handles up to 8K source). Max 10 images per listing.',
    'form.pick_images':   'Pick images',
    'form.clear_images':  'Clear all',
    'form.picker_compressing': 'Compressing {i}/{n}...',
    'form.picker_done':   'Added {n} images (~{size}).',
    'form.picker_error':  'Error: {msg}',
    'preview.title':      'Review images before applying',
    'preview.apply':      'Apply these images',
    'preview.cancel':     'Cancel (keep old)',
    'form.description':   'Description',
    'form.description_ph':'Detailed description of the property...',
    'form.title_en':      'Title (English) — optional',
    'form.title_en_ph':   'e.g., 2-story townhouse, Binh Hung',
    'form.title_zh':      'Title (中文) — optional',
    'form.title_zh_ph':   'e.g., Binh Hung 兩層樓連排屋',
    'form.description_en':'Description (English) — optional',
    'form.description_en_ph':'Detailed description in English for Western clients...',
    'form.description_zh':'Description (中文) — optional',
    'form.description_zh_ph':'Chinese description for Taiwanese / Chinese-speaking clients...',
    'form.i18n_hint':     'Provide EN/中文 translations so foreign clients can read the listing. Leave blank to show the Vietnamese original.',
    'form.i18n_group_title':'🌐 Translations for foreign clients (EN / 中文)',
    'form.auto_translate':'Auto-translate VI → EN + 中',
    'a11y.skip':          'Skip to main content',
    'form.cancel':        'Cancel',
    'form.status':        'Listing status',
    'form.status_none':   '-- No badge (default) --',
    'form.status_hint':   'If set, a status pill replaces the star on the card.',
    'status.new':         'New listing',
    'status.deposit':     'Deposited',
    'status.sold':        'Sold',
    'status.repair':      'Under renovation',
    'status.renting':     'Currently renting',
    'form.submit_add':    'Publish',
    'form.submit_update': 'Update',
    'form.select_placeholder': '-- Select --',

    'login.title':        'Admin sign in',
    'login.email':        'Email',
    'login.password':     'Password',
    'login.submit':       'Sign in',

    'lightbox.close':     'Close',
    'lightbox.prev':      'Previous',
    'lightbox.next':      'Next',
    'lightbox.counter':   '{i} / {n}',
    'lightbox.open_image':'View listing photo',

    'toast.saved':        'Saved',
    'toast.added':        'Listing published.',
    'toast.updated':      'Listing updated.',
    'toast.deleted':      'Listing deleted.',
    'toast.delete_confirm': 'Delete "{title}"? This cannot be undone.',
    'toast.login_ok':     'Signed in as admin.',
    'toast.logout':       'Signed out.',
    'toast.logout_confirm': 'Are you sure you want to sign out?',
    'toast.need_admin':   'Admin sign-in required.',
    'toast.seeding':      'Loading samples...',
    'toast.seed_ok':      'Loaded {n} samples.',
    'toast.generic_err':  'Something went wrong',

    'property.nha-pho':   'Townhouse',
    'property.can-ho':    'Apartment',
    'property.biet-thu':  'Villa',
    'property.dat-nen':   'Land',
    'property.shophouse': 'Shophouse',
    'property.kho-xuong': 'Warehouse',
    'property.khac':      'Other',

    'legal.so-hong':           'Pink book',
    'legal.so-do':             'Red book',
    'legal.hop-dong-mua-ban':  'Sale contract',
    'legal.giay-tay':          'Handwritten',
    'legal.dang-cho':          'Pending',
    'legal.khac':              'Other',

    'spec.sqm':           'm²',
    'spec.bed':           'bd',
    'spec.bath':          'ba',
    'spec.photos':        '{n} photos',
    'spec.contact':       'Contact',






    'team.title':         'Hoàng Sâm Advisory',
    'team.subtitle':      'Direct-from-owner properties in Ho Chi Minh City — professional advisors, Vietnamese legal expertise, serving domestic and international clients.',
    'team.change_role':   'Switch access role',
    'team.pro_badge':     'Active',
    'team.open_tool':     'Open chat',
    'team.settings_btn':  'API key settings',
    'team.chat_name':     'Advisor',
    'team.chat_role':     'Property advisory · Viewing requests',
    'team.chat_bio':      'Deep knowledge of every listing, Vietnamese real-estate law, mortgages and feng shui. Connects you with Marshall on Zalo for viewings.',
    'team.formatter_name':'Copy Editor',
    'team.formatter_role':'Raw notes → SEO-ready post',
    'team.formatter_bio': 'Paste a few lines of property specs — receive an SEO-ready Facebook/web post with clean structure, in your chosen language.',

    'client.years':       'years of Saigon real estate expertise',
    'client.support':     'advisors ready to respond',
    'client.legal':       'owner-direct, clear legal',
    'client.pitch':       'Our advisors are fully briefed on every active listing, Vietnamese real-estate law, transfer procedures, mortgage options, and foreign-ownership rules. We serve clients in Vietnamese, English and 繁體中文. Tap below for live advice or to book a viewing.',
    'client.chat':        'Talk to an advisor',
    'client.book':        'Book a viewing',

    'role.toggle_hint':   'On: Partner · Off: Client',
    'role.client_label':  'Guest',
    'role.ctv_label':     'Partner',
    'role.toggle_title':  'On = Partner · Off = Guest',

    'apt.title':          'Book a house viewing',
    'apt.subtitle':       'Marshall Ng will confirm via Zalo within 15 minutes',
    'apt.name':           'Full name *',
    'apt.phone':          'Phone number *',
    'apt.date':           'Date *',
    'apt.time':           'Time *',
    'apt.listing':        'Listing to view (optional)',
    'apt.note':           'Notes (optional)',
    'apt.cancel':         'Cancel',
    'apt.submit':         '📅 Confirm & send Zalo',
    'apt.hint':           '💡 Details will be copied automatically — open Marshall Ng on Zalo and Ctrl+V to send.',

    'ai.no_key_msg':      'No Gemini API key. Get a free one at aistudio.google.com then click Settings.',
    'ai.show_system':     'Show system prompt (partners only)',
    'ai.templates_title': 'Prompt templates (click to fill)',
    'ai.input_title':     'Your request',
    'ai.output_title':    'Response',
    'ai.run':             '▶ Send',
    'ai.stop':            '■ Stop',
    'ai.copy':            'Copy',
    'ai.book_from_chat':  '📅 Book a viewing',
    'ai.key_dialog_title':'Set Gemini API key',
    'ai.key_open_studio': 'Open Google AI Studio (free 15 req/min)',
    'ai.key_step_1':      'Sign in with your Google account',
    'ai.key_step_2':      'Click "Create API key" → copy the new key',
    'ai.key_step_3':      'Paste it below then click Save',
    'ai.key_privacy':     '🔒 Key stays on your device only (localStorage) — only Google sees it.',
    'ai.key_input_label': 'API key',
    'ai.key_cancel':      'Cancel',
    'ai.key_save':        'Save key',

    'footer.copyright':   '© hoangsam.bds · Saigon Real Estate',
    'footer.contact':     'Contact',
    'footer.facebook':    'Facebook',
    'footer.zalo':        'Zalo',
    'footer.line':        'LINE',
    'footer.gmail':       'Email',
    'comments.delete':         'Delete comment',
    'comments.delete_confirm': 'Delete this comment? This cannot be undone.',
    'comments.deleted':        'Comment deleted.',

    'card.favorite':      'Save',
    'card.unfavorite':    'Unsave',
    'card.feature':       'Feature',
    'card.unfeature':     'Unfeature',
    'card.featured_badge':'Featured',

    'comments.title':     'Comments',
    'comments.empty':     'No comments yet. Be the first!',
    'comments.name_ph':   'Your name',
    'comments.message_ph':'Write a comment...',
    'comments.send':      'Send',
    'comments.hint':      'Comments are public and visible to everyone.',
    'comments.anonymous': 'Anonymous',
    'comments.sent':      'Comment posted.',
    'comments.err':       'Failed to post comment. Please try again.',
    'comments.rate_limit':'Please wait 1 minute between comments.',
    'spam.too_many':      'Too many actions. Try again in {wait}.',
    'form.auto_translating':'Auto-translating to EN + 中…',

    'toast.fav_added':    'Saved to favorites.',
    'toast.fav_removed':  'Removed from favorites.',
    'toast.feat_on':      'Listing featured.',
    'toast.feat_off':     'Listing unfeatured.',
  },

  zh: {
    'brand.name':         'Hoàng Sâm',
    'brand.tagline':      '西貢房地產',

    'nav.add':            '新增房源',
    'nav.logout':         '登出',
    'nav.login':          '登入',
    'nav.call':           '立即撥打',
    'nav.admin':          'Marshall Ng',

    'hero.title':         '胡志明市屋主直售房地產',
    'hero.subtitle':      '連排屋 · 公寓 · 土地 — 產權清晰、實景照片。',

    'filter.search_ph':   '依名稱、地址、地區搜尋...',
    'filter.area_all':    '所有地區',
    'filter.sort_default':'價格由高至低',
    'filter.reset':       '清除篩選',

    'listings.title':     '房源列表',
    'listings.loading':   '載入中...',
    'listings.count':     '{n} 筆房源',
    'listings.count_filtered': '{n}/{total} 筆房源',

    'empty.title':        '尚無房源',
    'empty.msg':          '請嘗試更改篩選或新增房源。',
    'empty.admin_title':  '開始建立您的房源',
    'empty.admin_msg':    '新增第一筆房源,或載入 5 筆範例來查看介面。',
    'empty.seed':         '載入 5 筆範例',
    'empty.nomatch_title':'找不到符合的房源',
    'empty.nomatch_msg':  '請嘗試其他關鍵字或清除篩選。',
    'empty.clear_filter': '清除篩選',
    'empty.err_title':    '無法載入資料',
    'empty.retry':        '重試',

    'form.add_title':     '新增房源',
    'form.edit_title':    '編輯房源',
    'form.title':         '標題',
    'form.title_ph':      '例如:Binh Hung 住宅區兩層樓連排屋',
    'form.location':      '地址',
    'form.location_ph':   '門牌、街道、坊、區',
    'form.area':          '地區',
    'form.property':      '房產類型',
    'form.legal':         '產權狀態',
    'form.price':         '價格',
    'form.price_ph':      '例如:9.8 tỷ 或 9800000000',
    'form.area_sqm':      '面積 (m²)',
    'form.area_sqm_ph':   '例如:80',
    'form.bedrooms':      '臥室',
    'form.bathrooms':     '衛浴',
    'form.images':        '圖片 (第一行為封面 — 貼上網址或從裝置選擇)',
    'form.images_ph':     'https://...\nhttps://...\n或按上方按鈕選擇',
    'form.images_hint':   '圖片自動壓縮至約 85KB (支援 8K 原圖)。每則最多 10 張。',
    'form.pick_images':   '從裝置選擇',
    'form.clear_images':  '全部清除',
    'form.picker_compressing': '壓縮中 {i}/{n}...',
    'form.picker_done':   '已新增 {n} 張圖片 (約 {size})。',
    'form.picker_error':  '錯誤:{msg}',
    'preview.title':      '套用前預覽圖片',
    'preview.apply':      '套用這些圖片',
    'preview.cancel':     '取消 (保留舊圖)',
    'form.description':   '描述',
    'form.description_ph':'房產詳細描述...',
    'form.title_en':      '標題 (English) — 選填',
    'form.title_en_ph':   'e.g., 2-story townhouse, Binh Hung',
    'form.title_zh':      '標題 (中文) — 選填',
    'form.title_zh_ph':   '例如:Binh Hung 兩層樓連排屋',
    'form.description_en':'描述 (English) — 選填',
    'form.description_en_ph':'Detailed description in English for Western clients...',
    'form.description_zh':'描述 (中文) — 選填',
    'form.description_zh_ph':'中文詳細描述,方便台灣/華語客戶閱讀...',
    'form.i18n_hint':     '提供 EN/中文 翻譯,讓外國客戶也能閱讀房源。留空將顯示越南文原文。',
    'form.i18n_group_title':'🌐 外國客戶翻譯 (EN / 中文)',
    'form.auto_translate':'自動翻譯 VI → EN + 中',
    'a11y.skip':          '跳至主要內容',
    'form.cancel':        '取消',
    'form.status':        '物件狀態',
    'form.status_none':   '-- 不顯示狀態 (預設) --',
    'form.status_hint':   '若選擇,卡片將顯示對應標籤並隱藏星號。',
    'status.new':         '新上架',
    'status.deposit':     '已收訂',
    'status.sold':        '已售出',
    'status.repair':      '整修中',
    'status.renting':     '出租中',
    'form.submit_add':    '發布',
    'form.submit_update': '更新',
    'form.select_placeholder': '-- 請選擇 --',

    'login.title':        '管理員登入',
    'login.email':        '電子郵件',
    'login.password':     '密碼',
    'login.submit':       '登入',

    'lightbox.close':     '關閉',
    'lightbox.prev':      '上一張',
    'lightbox.next':      '下一張',
    'lightbox.counter':   '{i} / {n}',
    'lightbox.open_image':'查看圖片',

    'toast.saved':        '已儲存',
    'toast.added':        '已成功發布房源。',
    'toast.updated':      '已更新房源。',
    'toast.deleted':      '已刪除房源。',
    'toast.delete_confirm': '刪除「{title}」?此操作無法復原。',
    'toast.login_ok':     '管理員登入成功。',
    'toast.logout':       '已登出。',
    'toast.logout_confirm': '確定要登出嗎?',
    'toast.need_admin':   '需要管理員登入。',
    'toast.seeding':      '載入範例中...',
    'toast.seed_ok':      '已載入 {n} 筆範例。',
    'toast.generic_err':  '發生錯誤',

    'property.nha-pho':   '連排屋',
    'property.can-ho':    '公寓',
    'property.biet-thu':  '別墅',
    'property.dat-nen':   '土地',
    'property.shophouse': '店面屋',
    'property.kho-xuong': '倉庫/廠房',
    'property.khac':      '其他',

    'legal.so-hong':           '粉紅色產權證',
    'legal.so-do':             '紅色產權證',
    'legal.hop-dong-mua-ban':  '買賣合約',
    'legal.giay-tay':          '手寫契約',
    'legal.dang-cho':          '處理中',
    'legal.khac':              '其他',

    'spec.sqm':           '平方公尺',
    'spec.bed':           '房',
    'spec.bath':          '衛',
    'spec.photos':        '{n} 張圖片',
    'spec.contact':       '聯絡',






    'team.title':         'Hoàng Sâm 顧問團隊',
    'team.subtitle':      '胡志明市屋主直售房產 — 專業顧問熟悉越南法律,服務本地與海外客戶,提供越/英/繁中三語諮詢。',
    'team.change_role':   '切換身份',
    'team.pro_badge':     '服務中',
    'team.open_tool':     '開啟諮詢',
    'team.settings_btn':  'API 金鑰設定',
    'team.chat_name':     '顧問',
    'team.chat_role':     '房產諮詢 · 預約看房',
    'team.chat_bio':      '熟悉所有在架物件、越南房地產法律、銀行貸款與風水概念。客戶預約看房時透過 Zalo 聯絡 Marshall。',
    'team.formatter_name':'文案編輯',
    'team.formatter_role':'粗稿 → SEO 貼文',
    'team.formatter_bio': '貼入物件簡述 — 自動產出結構完整、符合 SEO 的 Facebook/網站貼文,支援多語言輸出。',

    'client.years':       '年西貢房產經驗',
    'client.support':     '顧問隨時回覆',
    'client.legal':       '屋主直售,法律清楚',
    'client.pitch':       'Hoàng Sâm 顧問熟悉所有在架物件、越南房地產法律、過戶流程、銀行貸款與外國人購屋規範。我們以越南語、English 與繁體中文為您服務。點擊下方按鈕取得即時諮詢或預約看房。',
    'client.chat':        '與顧問對話',
    'client.book':        '預約看房',

    'role.toggle_hint':   '開啟:合作夥伴 · 關閉:客戶',
    'role.client_label':  '訪客',
    'role.ctv_label':     '合作夥伴',
    'role.toggle_title':  '開啟 = 合作夥伴 · 關閉 = 訪客',

    'apt.title':          '預約看房',
    'apt.subtitle':       'Marshall Ng 將於 15 分鐘內透過 Zalo 確認',
    'apt.name':           '姓名 *',
    'apt.phone':          '電話 *',
    'apt.date':           '日期 *',
    'apt.time':           '時間 *',
    'apt.listing':        '欲看的物件 (可選)',
    'apt.note':           '備註 (可選)',
    'apt.cancel':         '取消',
    'apt.submit':         '📅 確認並發送 Zalo',
    'apt.hint':           '💡 資訊已自動複製 — 開啟 Marshall Ng 的 Zalo 直接 Ctrl+V 即可送出。',

    'ai.no_key_msg':      '尚未設定 Gemini API 金鑰。至 aistudio.google.com 免費取得後點擊「設定」。',
    'ai.show_system':     '檢視 system prompt (僅合作夥伴可見)',
    'ai.templates_title': '預設 prompt (點擊填入)',
    'ai.input_title':     '您的需求',
    'ai.output_title':    '回覆',
    'ai.run':             '▶ 送出',
    'ai.stop':            '■ 停止',
    'ai.copy':            '複製',
    'ai.book_from_chat':  '📅 預約看房',
    'ai.key_dialog_title':'設定 Gemini API 金鑰',
    'ai.key_open_studio': '開啟 Google AI Studio (免費 15 次/分鐘)',
    'ai.key_step_1':      '使用您的 Google 帳號登入',
    'ai.key_step_2':      '點擊 "Create API key" → 複製剛建立的金鑰',
    'ai.key_step_3':      '將金鑰貼到下方欄位後點擊儲存',
    'ai.key_privacy':     '🔒 金鑰僅保存於您的裝置 (localStorage) — 除 Google 外不會傳送到任何地方。',
    'ai.key_input_label': 'API 金鑰',
    'ai.key_cancel':      '取消',
    'ai.key_save':        '儲存',

    'footer.copyright':   '© hoangsam.bds · 西貢房地產',
    'footer.contact':     '聯絡',
    'footer.facebook':    'Facebook',
    'footer.zalo':        'Zalo',
    'footer.line':        'LINE',
    'footer.gmail':       'Email',
    'comments.delete':         '刪除留言',
    'comments.delete_confirm': '刪除此留言?無法復原。',
    'comments.deleted':        '已刪除留言。',

    'card.favorite':      '收藏',
    'card.unfavorite':    '取消收藏',
    'card.feature':       '設為精選',
    'card.unfeature':     '取消精選',
    'card.featured_badge':'精選',

    'comments.title':     '留言',
    'comments.empty':     '尚未有留言,成為第一個留言的人吧!',
    'comments.name_ph':   '您的名字',
    'comments.message_ph':'寫下留言...',
    'comments.send':      '送出',
    'comments.hint':      '留言將公開顯示給所有人。',
    'comments.anonymous': '匿名',
    'comments.sent':      '已發布留言。',
    'comments.err':       '留言發布失敗,請重試。',
    'comments.rate_limit':'請等待 1 分鐘後再留言。',
    'spam.too_many':      '操作過於頻繁,請於 {wait} 後再試。',
    'form.auto_translating':'正在自動翻譯為 EN + 中…',

    'toast.fav_added':    '已加入收藏。',
    'toast.fav_removed':  '已從收藏移除。',
    'toast.feat_on':      '已設為精選。',
    'toast.feat_off':     '已取消精選。',
  },
};

/* ───────────────────────── Area (district) translations ───────────────────────── */

/**
 * Map VI district name → { en, zh }. Key là chuỗi VI chuẩn.
 * translateArea() sẽ tra cứu case-insensitive + bỏ dấu.
 */
const AREA_MAP = {
  'quan-1':      { en: 'District 1',        zh: '第1郡' },
  'quan-3':      { en: 'District 3',        zh: '第3郡' },
  'quan-4':      { en: 'District 4',        zh: '第4郡' },
  'quan-5':      { en: 'District 5',        zh: '第5郡' },
  'quan-6':      { en: 'District 6',        zh: '第6郡' },
  'quan-7':      { en: 'District 7',        zh: '第7郡' },
  'quan-8':      { en: 'District 8',        zh: '第8郡' },
  'quan-10':     { en: 'District 10',       zh: '第10郡' },
  'quan-11':     { en: 'District 11',       zh: '第11郡' },
  'quan-12':     { en: 'District 12',       zh: '第12郡' },
  'binh-tan':    { en: 'Binh Tan Dist.',    zh: '平新郡' },
  'binh-thanh':  { en: 'Binh Thanh Dist.',  zh: '平盛郡' },
  'go-vap':      { en: 'Go Vap Dist.',      zh: '鵝坞郡' },
  'phu-nhuan':   { en: 'Phu Nhuan Dist.',   zh: '富潤郡' },
  'tan-binh':    { en: 'Tan Binh Dist.',    zh: '新平郡' },
  'tan-phu':     { en: 'Tan Phu Dist.',     zh: '新富郡' },
  'thu-duc':     { en: 'Thu Duc City',      zh: '守德市' },
  'binh-chanh':  { en: 'Binh Chanh Dist.',  zh: '平政縣' },
  'hoc-mon':     { en: 'Hoc Mon Dist.',     zh: '霍門縣' },
  'nha-be':      { en: 'Nha Be Dist.',      zh: '芽皮縣' },
  'cu-chi':      { en: 'Cu Chi Dist.',      zh: '古芝縣' },
  'can-gio':     { en: 'Can Gio Dist.',     zh: '芹蒢縣' },
  'khac':        { en: 'Other',             zh: '其他' },
};

function _areaKey(name) {
  if (typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * translateArea — tên quận/huyện theo ngôn ngữ hiện tại.
 * Không tìm thấy → trả về chuỗi gốc (để không mất thông tin do user nhập).
 */
export function translateArea(name) {
  if (!name) return '';
  if (_lang === 'vi') return name;
  const entry = AREA_MAP[_areaKey(name)];
  if (!entry) return name;
  return entry[_lang] || name;
}

/**
 * pickLocalized — chọn nội dung theo ngôn ngữ hiện tại, fallback VI.
 *
 * Admin nhập `title`, `title_en`, `title_zh` (hoặc description tương tự).
 * Khi khách xem:
 *   - lang=vi → trả về `vi` (bản gốc).
 *   - lang=en → ưu tiên `en`; nếu trống → fallback `vi`.
 *   - lang=zh → ưu tiên `zh`; nếu trống → fallback `en`, rồi `vi`.
 *
 * @param {object} fields - { vi: string, en?: string, zh?: string }
 * @returns {string}
 */
export function pickLocalized(fields = {}) {
  const vi = typeof fields.vi === 'string' ? fields.vi.trim() : '';
  const en = typeof fields.en === 'string' ? fields.en.trim() : '';
  const zh = typeof fields.zh === 'string' ? fields.zh.trim() : '';

  if (_lang === 'vi') return vi || en || zh || '';
  if (_lang === 'en') return en || vi || zh || '';
  if (_lang === 'zh') return zh || en || vi || '';
  return vi || en || zh || '';
}

/* ───────────────────────── State ───────────────────────── */

let _lang = _loadLang();
const _subs = new Set();

function _loadLang() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && SUPPORTED.includes(v)) return v;
  } catch {}
  return DEFAULT_LANG;
}

function _saveLang(lang) {
  try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
}

/* ───────────────────────── Public API ───────────────────────── */

export function getLang() {
  return _lang;
}

export function getSupported() {
  return SUPPORTED.slice();
}

/**
 * t(key, params) — lookup string cho lang hiện tại, với thay thế {name} placeholders.
 * Fallback: vi → key.
 */
export function t(key, params) {
  const dict = DICTS[_lang] || DICTS[DEFAULT_LANG];
  let str = dict[key] ?? DICTS[DEFAULT_LANG][key] ?? key;
  if (params && typeof str === 'string') {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return str;
}

/** setLang — đổi ngôn ngữ, lưu localStorage, thông báo subscribers, re-apply DOM. */
export function setLang(lang) {
  if (!SUPPORTED.includes(lang) || lang === _lang) return;
  _lang = lang;
  _saveLang(lang);
  document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : lang;
  applyI18n();
  for (const sub of _subs) {
    try { sub(lang); } catch (e) { console.error('[i18n] sub threw:', e); }
  }
}

/** subscribe(fn) — callback khi lang đổi. */
export function onLangChange(fn) {
  _subs.add(fn);
  return () => _subs.delete(fn);
}

/**
 * applyI18n — quét DOM, dịch mọi element có data-i18n / data-i18n-ph / data-i18n-aria.
 * Gọi sau khi DOM ready và sau khi setLang.
 */
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPh);
  });
  root.querySelectorAll('[data-i18n-aria]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });
  root.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.setAttribute('title', t(el.dataset.i18nTitle));
  });
  // Tên khu vực (quận/huyện): giữ value VI, chỉ đổi textContent theo lang
  root.querySelectorAll('[data-i18n-area]').forEach(el => {
    const viName = el.dataset.i18nArea;
    el.textContent = translateArea(viName);
  });
}

/** Init — gọi 1 lần lúc app khởi động. */
export function initI18n() {
  document.documentElement.lang = _lang === 'zh' ? 'zh-Hant' : _lang;
  applyI18n();
}
