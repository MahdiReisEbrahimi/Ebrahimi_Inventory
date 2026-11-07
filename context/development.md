# راه‌اندازی و بررسی پروژه

آخرین تطبیق با تنظیمات مخزن: 2026-10-26.
فرمان‌ها برای PowerShell و مسیرهای نسبی از ریشه پروژه نوشته شده‌اند.
این فایل اطلاعات محرمانه یا اتصال واقعی دیتابیس را نگهداری نمی‌کند.

## پیش‌نیاز و نصب

- Node مطابق `Frontend/package.json`: `^22.18.0 || >=24.12.0`؛ npm.
- PostgreSQL در دسترس؛ نسخه سرور از تنظیمات واقعی محیط بررسی شود.
- ریشه، Backend و Frontend بسته‌های مستقل با lockfile هستند؛ npm workspace نداریم.
  `npm ci` را در هر سه مسیر اجرا کنید. قبل از نصب مجدد، وضعیت وابستگی موجود را بررسی کنید.
- `docker-compose.yml` فعلی سرویس قابل استفاده PostgreSQL تعریف نمی‌کند.

```powershell
# از ریشه، هر کدام در مسیر خودش
npm ci
Set-Location Backend
npm ci
Set-Location ../Frontend
npm ci
```

## پیکربندی

- الگو `.env.example` در ریشه است؛ فایل `.env` واقعی را محلی تنظیم کنید.
- `DATABASE_URL` برای API و CLI لازم است؛ `PORT` پیش‌فرض API برابر 3000 است.
- `Backend/src/app.module.ts` فایل `../.env` را نسبت به cwd بک‌اند می‌خواند؛
  `Backend/prisma.config.ts` نیز `.env` ریشه را بارگذاری می‌کند.
- `JWT_SECRET` و `JWT_EXPIRES_IN` در نمونه env هستند ولی auth فعلاً فعال نیست.
- آدرس پیش‌فرض فرانت `http://localhost:5173` و API برابر
  `http://localhost:3000/api/v1` است. `VITE_API_URL` آدرس API را تغییر می‌دهد.
- CORS فعلاً فقط origin برابر `http://localhost:5173` را اجازه می‌دهد.
  تغییر پورت/origin باید با تنظیمات API هماهنگ شود.

## دیتابیس و Prisma

مسیر معمول، از `Backend/`:

```powershell
npm run db:status
npm run db:migrate
npm run db:generate
```

- `db:migrate` همان `prisma migrate deploy --config prisma.config.ts` است و
  migrationهای موجود را روی دیتابیس تنظیم‌شده اعمال می‌کند؛ migration جدید نمی‌سازد.
- `db:generate` client را در `Backend/src/generated/prisma/` تولید می‌کند.
- منبع schema و migrationها در `prisma/` ریشه است، نه `Backend/prisma/`.
- اجرای CLI از ریشه نیز با `--config prisma7.config.ts` امکان‌پذیر است.
- برای تغییر مدل، SQL migration نسخه‌دار، DTO/service، client تولیدشده و
  type/service/viewهای فرانت را هماهنگ کنید. migration اعمال‌شده را بازنویسی نکنید.
- پیش از نوشتن روی دیتابیس، مقصد اتصال و migrationهای در انتظار را بررسی کنید.
  reset، پاک‌سازی داده یا پذیرفتن خودکار data loss بخشی از راه‌اندازی عادی نیست.
- migration حذف SKU ابتدا نام‌های خالی/تکراری را بررسی می‌کند؛ در صورت تعارض
  متوقف می‌شود. برای رفع تعارض، کالاهای واقعی را خودکار حذف یا ادغام نکنید.

## اجرای توسعه

```powershell
# ترمینال اول، در Backend/
npm run start:dev

# ترمینال دوم، در Frontend/
npm run dev
```

script دارای نام `deploy` در بک‌اند به‌تنهایی نشانه آماده بودن استقرار نیست.
نوع استقرار مغازه، دسترسی شبکه و برنامه پشتیبان‌گیری هنوز نیازمند تصمیم عملیاتی است.

## بررسی متناسب با تغییر

| مسیر اجرا | فرمان | کاربرد |
| --- | --- | --- |
| Frontend/ | `npm run build` | TypeScript و build با Vite |
| Frontend/ | `npm run type-check` | فقط بررسی TypeScript |
| Frontend/ | `npm run test:unit` | تست‌های Node برای مبلغ، فاکتور، چاپ، تقویم و تم |
| Frontend/ | `npm run format:check` | بررسی فرمت بدون تغییر فایل |
| Backend/ | `npm run build` | کامپایل Nest و TypeScript |
| Backend/ | `npm run lint` | Oxlint روی src و test |
| Backend/ | `npm test` | تست واحد Vitest کالا و دسته‌بندی |
| Backend/ | `npm run test:e2e` | مجموعه e2e؛ توضیح اتصال DB را پایین بخوانید |

`npm run lint` در فرانت شامل `--fix` است و فایل‌ها را تغییر می‌دهد؛
`npm run format` در هر بسته نیز بازنویسی می‌کند. برای ESLint خواندنی و محدود:

```powershell
# در Frontend/؛ مسیر فایل‌های مرتبط را جایگزین کنید
node node_modules/eslint/bin/eslint.js src/views/ProductsView.vue
```

تست‌های e2e حتی بدون opt-in شامل تست AppModule هستند و تنظیمات دیتابیس لازم دارند.
دو مجموعه دارای opt-in، روی دیتابیس واقعی رکوردهای دارای شناسه تصادفی می‌سازند
و فقط همان fixtureها را پاک می‌کنند؛ sequence شناسه‌ها ممکن است جلو برود.
از دیتابیس توسعه/تست مناسب استفاده کنید و مقصد را پیش از اجرا بررسی کنید.

```powershell
# در Backend/، برای فعال‌سازی هر دو مجموعه DB
$env:RUN_PRODUCT_DB_TESTS = '1'
$env:RUN_INVOICE_DB_TESTS = '1'
npm run test:e2e
Remove-Item Env:RUN_PRODUCT_DB_TESTS
Remove-Item Env:RUN_INVOICE_DB_TESTS
```

- `Backend/test/products.e2e-spec.ts`: یکتایی نام در دیتابیس و عدم تغییر قیمت در خطای نام.
- `Backend/test/invoice.e2e-spec.ts`: ذخیره/ویرایش فاکتور، موجودی و مرجوعی.
- `Backend/test/app.e2e-spec.ts`: تست اولیه endpoint ریشه.
- نتیجه build جای آزمون جریان کسب‌وکار یا بررسی بصری را نمی‌گیرد.
  برای تغییر صرفاً مستندات، تطبیق مسیرها/فرمان‌ها و بررسی diff کافی است؛
  از اجرای migration یا تست دارای نوشتن روی دیتابیس صرفاً برای ویرایش مستندات خودداری کنید.

## ناسازگاری قبلی دیتابیس محلی (2026-11-01)

پوشه `20261031120000_party_accounts_foundation` خالی است، اما دیتابیس محلی آن را
اعمال‌شده می‌داند و جدول‌های اضافه حسابداری دارد. فرمان عادی status/deploy با
P3015 متوقف می‌شود. migration جدید `20261101120000_invoice_sale_type` با پیکربندی
موقت شامل فقط کپی migrationهای دارای SQL اعمال شد؛ سابقه قبلی و جدول‌های اضافه
تغییر نکردند. فایل اصلی migration قبلی باید از نسخه معتبر بازیابی شود؛ SQL
حدسی، reset یا حذف سابقه دیتابیس جایگزین بازیابی نیست.

تست‌های SSR فرانت (`invoicePaper.test.ts` و `table.test.ts`) کش مستقل در
`Frontend/node_modules/.vite-tests/` دارند تا اجرای تست هنگام فعال بودن Vite،
کش توسعه را جایگزین نکند و خطای `504 Outdated Optimize Dep` ایجاد نشود.

- Backend/test/purchase-return.e2e-spec.ts خرید، موجودی منفی، قیمت تاریخی مرجوعی،
  ردیف‌های هم‌کالای مستقل و رقابت مرجوعی را با RUN_INVOICE_DB_TESTS پوشش می‌دهد.
  مجموعه‌های e2e به‌صورت سری اجرا می‌شوند تا قفل‌های predicate تراکنش Serializable
  روی fixtureهای مستقل، خطای رقابت کاذب ایجاد نکنند؛ آزمون رقابت درون تست حفظ شده.
- migrationهای 20261101180000_purchase_and_return_invoices و
  20261101181000_allow_negative_stock به دیتابیس محلی اعمال شدند؛ اولی نوع و روابط
  سند و دومی حذف قید موجودی غیرمنفی را انجام می‌دهد. داده‌های قدیمی حذف نشدند.

- migration حساب تجمیعی 20261101200000_party_ledger فقط PartyLedgerEntry و دو
  ستون تطبیق Invoice را اضافه می‌کند و جدول‌های foundation قبلی را دست نمی‌زند.
  ناسازگاری پوشه خالی migration قدیمی همچنان برقرار است؛ اعمال محلی با پیکربندی
  موقت و کپی migrationهای دارای SQL انجام شد. import سوابق در تراکنش اولین دسترسی است.
- Backend/test/party-accounts.e2e-spec.ts با RUN_INVOICE_DB_TESTS=1 سناریوی سه
  فاکتور/یک دریافت، مرجوعی تخفیف‌دار، قیمت‌گذاری نسیه مرجوعی، بستانکاری/برگشت،
  شناسه یکتای پرداخت، رقابت، ریال فرد، سوابق قدیمی و اتصال اسناد را تست می‌کند.
  تست‌های قدیمی مالی برای جلوگیری از اشتراک وجه میان سناریوها Buyer مجزا دارند.
