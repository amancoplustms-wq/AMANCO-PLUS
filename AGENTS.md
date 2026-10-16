# دستور ومواصفات مشروع: أمانكو بلس للشحن (Amanco Plus TMS)

## 1. الهوية وبيانات الشركة الأساسية
- **اسم الشركة:** أمانكو بلس (Amanco Plus)
- **المسؤول ورقم التواصل الرسمي:** محمد عبد الباسط - `01274365996`
- **اللغة والاتجاه:** اللغة العربية فقط (`lang="ar"`, `dir="rtl"`) مع استخدام خط `Cairo` من Google Fonts.
- **نطاق التغطية الجغرافية:** القاهرة، الجيزة، القليوبية.
- **مستوى النظام:** المستوى الأول (الموقع التعريفي + تتبع الشحنات برقم البوليصة بدون تسجيل دخول + لوحة الإدارة الداخلية الشاملة).
- **الصلاحيات:** مدير عام واحد بصلاحيات كاملة (يتم الدخول عبر Supabase Auth). لا توجد بوابة دخول للتجار أو المناديب في هذه المرحلة.

## 2. التقنيات المعتمدة (Tech Stack)
- **Framework:** Next.js (App Router) + TypeScript (Strict Mode) inside `src/`.
- **Backend & Database:** 100% Supabase (`@supabase/supabase-js` & `@supabase/ssr`). ممنوع استخدام Prisma أو Drizzle.
- **Styling:** Tailwind CSS (بألوان هوية أمانكو بلس: كحلي داكن `slate-900`، أزرق ملكي `blue-700`، وبرتقالي لوجستي `orange-500`، وأخضر للنجاح `emerald-600`).
- **Excel & Printing:** مكتبة `xlsx` لرفع الشحنات المجمعة ومكتبة `react-barcode` مع CSS `@media print` لطباعة البوالص على ورق A4 (بوليصتين أو 4 بوالص في الورقة).

## 3. هيكل الفولدرات الإلزامي (Architecture)
```text
src/
├── app/
│   ├── (public)/             # الموقع التعريفي + صفحة تتبع الشحنات
│   ├── login/                # صفحة تسجيل دخول المدير العام
│   └── admin/                # لوحة الإدارة المحمية (Dashboard, Shipments, Merchants, Couriers, Zones, Finance, Print)
├── modules/
│   └── finance/              # دوال حساب الشحن، تسعير VIP، المرتجعات، وعمولات المناديب
├── components/
│   ├── ui/                   # العناصر المشتركة (Buttons, Modals, Badges, Tables)
│   ├── public/               # مكونات الموقع التعريفي وشعار أمانكو بلس SVG
│   └── admin/                # مكونات لوحة التحكم والطباعة A4
├── lib/
│   └── supabase/             # client.ts, server.ts, middleware.ts
└── types/
    └── database.ts           # تعريفات TypeScript المطابقة لجداول Supabase

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
