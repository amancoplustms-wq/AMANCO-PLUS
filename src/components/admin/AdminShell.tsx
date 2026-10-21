'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import BrandLogo from '@/components/public/BrandLogo';
import {
  resolveAdminUserName,
  getTimeBasedGreeting,
  STORAGE_KEY_SIDEBAR_COLLAPSED,
  STORAGE_KEY_USER_NAME,
  STORAGE_KEY_USER_EMAIL,
  STORAGE_KEY_USER_ROLE,
} from '@/lib/user-greeting';
import {
  LayoutDashboard,
  Package,
  Users,
  UserPlus,
  Truck,
  MapPin,
  Wallet,
  LogOut,
  ExternalLink,
  Menu,
  X,
  ChevronLeft,
  Bell,
  ShieldCheck,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';

interface AdminShellProps {
  userEmail: string;
  initialUserName?: string;
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badgeKey?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'لوحة الإحصائيات', icon: LayoutDashboard },
  { href: '/admin/shipments', label: 'الشحنات والبوالص', icon: Package },
  { href: '/admin/merchants', label: 'التجار وأسعار VIP', icon: Users },
  { href: '/admin/leads', label: 'طلبات انضمام التجار', icon: UserPlus, badgeKey: 'leads' },
  { href: '/admin/couriers', label: 'المناديب والعهد', icon: Truck },
  { href: '/admin/zones', label: 'المناطق والتسعير', icon: MapPin },
  { href: '/admin/finance', label: 'الخزنة والتسويات', icon: Wallet },
];

// ذاكرة مؤقتة في الـ Module Level لمنع وميض البيانات أو تكرار طلبات Supabase عند التنقل
let cachedEmail: string | null = null;
let cachedUserName: string | null = null;
let cachedUserRole: string | null = 'المدير العام';
let cachedLeadsCount: number | null = null;
let lastLeadsFetchTime = 0;
const LEADS_CACHE_TTL = 60 * 1000; // 60 ثانية

export default function AdminShell({ userEmail, initialUserName, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  // حالة طي وفتح السايدبار (مع قراءة وحفظ في localStorage)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // حالة بيانات المستخدم والتحية الزمنية الذكية
  const [userName, setUserName] = useState<string>(() => {
    if (cachedUserName) return cachedUserName;
    return resolveAdminUserName(userEmail, initialUserName);
  });
  const [userRole, setUserRole] = useState<string>(() => cachedUserRole || 'المدير العام');
  const [timeGreeting, setTimeGreeting] = useState<string>(() => getTimeBasedGreeting().greeting);

  // حالة التحديث اللحظي التفاؤلي للمسار النشط (0ms Lag)
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadLeadsCount, setUnreadLeadsCount] = useState<number>(() => cachedLeadsCount ?? 0);
  const [loggingOut, setLoggingOut] = useState(false);

  // تحديث كاش الإيميل والاسم في الذاكرة
  if (userEmail && (!cachedEmail || cachedEmail !== userEmail)) {
    cachedEmail = userEmail;
  }
  const displayEmail = userEmail || cachedEmail || '';

  // استرجاع حالة السايدبار والاسم من localStorage وتحديث التحية الزمنية عند التحميل
  useEffect(() => {
    try {
      const savedCollapsed = localStorage.getItem(STORAGE_KEY_SIDEBAR_COLLAPSED);
      if (savedCollapsed !== null) {
        setIsSidebarCollapsed(savedCollapsed === 'true');
      }

      const storedName = localStorage.getItem(STORAGE_KEY_USER_NAME);
      if (storedName && !cachedUserName) {
        cachedUserName = storedName;
        setUserName(storedName);
      }

      const storedRole = localStorage.getItem(STORAGE_KEY_USER_ROLE);
      if (storedRole) {
        cachedUserRole = storedRole;
        setUserRole(storedRole);
      }
    } catch {
      // تجاهل الأخطاء في بيئات منع الـ storage
    }

    const { greeting } = getTimeBasedGreeting();
    setTimeGreeting(greeting);

    // التحقق من بيانات المستخدم في Supabase لاستخراج الاسم بأعلى دقة
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const metaName = (user.user_metadata?.full_name || user.user_metadata?.name || initialUserName || '') as string;
        const resolvedName = resolveAdminUserName(user.email || displayEmail, metaName);
        cachedUserName = resolvedName;
        cachedEmail = user.email || displayEmail;
        setUserName(resolvedName);
        try {
          localStorage.setItem(STORAGE_KEY_USER_NAME, resolvedName);
          if (user.email) localStorage.setItem(STORAGE_KEY_USER_EMAIL, user.email);
          localStorage.setItem(STORAGE_KEY_USER_ROLE, 'المدير العام');
        } catch {
          // ignore
        }
      }
    });
  }, [displayEmail, initialUserName]);

  // تبديل حالة طي وفتح السايدبار وحفظها فوراً
  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_SIDEBAR_COLLAPSED, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // تصفير حالة التحميل اللحظية عند اكتمال انتقال الصفحة
  useEffect(() => {
    setPendingPath(null);
    setMobileMenuOpen(false);
  }, [pathname]);

  // جلب عدد طلبات التجار غير المتواصل معهم مع كاش 60 ثانية
  useEffect(() => {
    const now = Date.now();
    if (cachedLeadsCount !== null && now - lastLeadsFetchTime < LEADS_CACHE_TTL) {
      setUnreadLeadsCount(cachedLeadsCount);
      return;
    }

    const supabase = createClient();
    async function fetchLeadsBadge() {
      try {
        const { count } = await supabase
          .from('merchant_leads')
          .select('*', { count: 'exact', head: true })
          .eq('is_contacted', false);
        if (count !== null) {
          cachedLeadsCount = count;
          lastLeadsFetchTime = Date.now();
          setUnreadLeadsCount(count);
        }
      } catch (err) {
        console.error('Failed to fetch leads count:', err);
      }
    }
    fetchLeadsBadge();
  }, [pathname]);

  const handleSignOut = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      try {
        localStorage.removeItem(STORAGE_KEY_USER_NAME);
        localStorage.removeItem(STORAGE_KEY_USER_EMAIL);
      } catch {
        // ignore
      }
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Sign out error:', err);
      setLoggingOut(false);
    }
  };

  const isLinkActive = (href: string) => {
    const target = pendingPath ?? pathname;
    if (href === '/admin') {
      return target === '/admin';
    }
    return target.startsWith(href);
  };

  const isLinkPending = (href: string) => {
    if (!pendingPath) return false;
    if (href === '/admin') return pendingPath === '/admin' && pathname !== '/admin';
    return pendingPath.startsWith(href) && !pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row text-slate-800 antialiased" dir="rtl">
      {/* ==================================================================== */}
      {/* السايدبار الثابت على الديسكتوب (Desktop Sidebar) */}
      {/* ==================================================================== */}
      <aside
        className={`hidden lg:flex lg:flex-col ${
          isSidebarCollapsed ? 'lg:w-20' : 'lg:w-72'
        } bg-slate-900 border-l border-slate-800 text-white shrink-0 sticky top-0 h-screen z-30 print:hidden transition-all duration-300 ease-in-out`}
      >
        {/* ترويسة السايدبار والشعار */}
        {isSidebarCollapsed ? (
          <div className="h-16 px-2 border-b border-slate-800/80 flex items-center justify-center shrink-0">
            <Link
              href="/admin"
              prefetch={true}
              title="أمانكو بلس للشحن والتوريد"
              className="flex items-center justify-center"
            >
              <BrandLogo size="sm" variant="dark" showText={false} />
            </Link>
          </div>
        ) : (
          <div className="h-16 px-4 border-b border-slate-800/80 flex items-center justify-between gap-2 shrink-0">
            <Link href="/admin" prefetch={true} className="flex items-center group">
              <BrandLogo size="sm" variant="dark" />
            </Link>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] bg-brand-orange/20 text-brand-orange font-bold px-2 py-0.5 rounded-full border border-brand-orange/30">
                لوحة الإدارة
              </span>
              <button
                type="button"
                onClick={toggleSidebar}
                title="طي القائمة الجانبية لتوسيع الشاشة"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <PanelRightClose size={18} />
              </button>
            </div>
          </div>
        )}

        {/* زر فتح السايدبار عند الطي في أعلى القائمة */}
        {isSidebarCollapsed && (
          <div className="px-3 pt-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleSidebar}
              title="فتح القائمة الجانبية"
              className="w-full p-2 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <PanelRightOpen size={18} />
            </button>
          </div>
        )}

        {/* عناصر القائمة */}
        <nav className={`flex-1 overflow-y-auto custom-scrollbar ${isSidebarCollapsed ? 'p-2 space-y-2' : 'p-4 space-y-1.5'}`}>
          {!isSidebarCollapsed && (
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
              القائمة الرئيسية
            </div>
          )}

          {NAV_ITEMS.map((item) => {
            const active = isLinkActive(item.href);
            const pending = isLinkPending(item.href);
            const Icon = item.icon;
            const badge = item.badgeKey === 'leads' && unreadLeadsCount > 0 ? unreadLeadsCount : null;

            if (isSidebarCollapsed) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  title={item.label}
                  onClick={() => {
                    if (pathname !== item.href) {
                      setPendingPath(item.href);
                    }
                  }}
                  className={`relative flex items-center justify-center w-12 h-12 mx-auto rounded-xl transition-all duration-150 group cursor-pointer ${
                    active
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  <Icon
                    size={20}
                    className={`transition-transform duration-150 group-hover:scale-110 ${
                      active ? 'text-white' : 'text-slate-400 group-hover:text-brand-orange'
                    }`}
                  />
                  {/* شارة التحميل أو العداد فوق الأيقونة عند الطي */}
                  {pending ? (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[9px] text-white animate-spin">
                      <Loader2 size={10} />
                    </span>
                  ) : badge !== null ? (
                    <span
                      title={`${badge} طلبات انضمام جديدة`}
                      className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 px-1 items-center justify-center rounded-full bg-brand-orange text-[9.5px] font-black text-white shadow-md border-2 border-slate-900"
                    >
                      {badge}
                    </span>
                  ) : null}
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                onClick={() => {
                  if (pathname !== item.href) {
                    setPendingPath(item.href);
                  }
                }}
                className={`flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-150 group cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    size={19}
                    className={`transition-transform duration-150 group-hover:scale-110 ${
                      active ? 'text-white' : 'text-slate-400 group-hover:text-brand-orange'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {pending && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-blue-200 bg-blue-700/80 px-2 py-0.5 rounded-full animate-pulse">
                      <Loader2 size={12} className="animate-spin" />
                      <span>جاري...</span>
                    </span>
                  )}
                  {badge !== null && !pending && (
                    <span className="bg-brand-orange text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                      {badge} جديد
                    </span>
                  )}
                  {active && !pending && <ChevronLeft size={16} className="text-white/80" />}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* أسفل السايدبار: معلومات المستخدم والخروج */}
        {isSidebarCollapsed ? (
          <div className="p-2 border-t border-slate-800 bg-slate-950/40 flex flex-col items-center gap-2 shrink-0">
            {/* رابط الموقع العام */}
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              title="عرض الموقع العام"
              className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
            >
              <ExternalLink size={18} />
            </Link>

            {/* أيقونة المستخدم مع تلميح بالاسم والإيميل */}
            <div
              title={`👋 مرحباً بك، ${userName} (${timeGreeting})\n${displayEmail}`}
              className="w-11 h-11 rounded-xl bg-blue-700/30 text-blue-400 flex items-center justify-center font-bold shrink-0 border border-blue-600/30 cursor-pointer"
            >
              <ShieldCheck size={19} className="text-blue-400" />
            </div>

            {/* زر تسجيل الخروج كأيقونة في وضع الطي */}
            <button
              type="button"
              onClick={handleSignOut}
              disabled={loggingOut}
              title={loggingOut ? 'جاري الخروج...' : 'تسجيل الخروج'}
              className="w-11 h-11 flex items-center justify-center rounded-xl text-red-300 bg-red-950/30 hover:bg-red-900/40 hover:text-red-200 border border-red-800/40 transition-all cursor-pointer disabled:opacity-50"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-3 shrink-0">
            {/* رابط الموقع العام */}
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ExternalLink size={15} className="text-slate-400" />
                <span>عرض الموقع العام</span>
              </div>
              <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                خارجي
              </span>
            </Link>

            {/* بيانات الحساب والترحيب */}
            <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-800/60 rounded-xl border border-slate-700/60 shadow-xs">
              <div className="w-10 h-10 rounded-full bg-blue-700/30 text-blue-400 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-600/30">
                <ShieldCheck size={20} className="text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-brand-orange font-bold">
                    {timeGreeting}
                  </span>
                  <span className="text-[10px] text-slate-500">•</span>
                  <p className="text-xs font-bold text-white truncate">{userName}</p>
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5" dir="ltr">
                  {displayEmail || userRole}
                </p>
              </div>
            </div>

            {/* زر تسجيل الخروج */}
            <button
              type="button"
              onClick={handleSignOut}
              disabled={loggingOut}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-red-300 bg-red-950/30 hover:bg-red-900/40 hover:text-red-200 border border-red-800/40 transition-all cursor-pointer disabled:opacity-50"
            >
              <LogOut size={15} />
              <span>{loggingOut ? 'جاري الخروج...' : 'تسجيل الخروج'}</span>
            </button>
          </div>
        )}
      </aside>

      {/* ==================================================================== */}
      {/* الهيدر العلوي للموبايل والقائمة المنسدلة (Mobile Header & Drawer) */}
      {/* ==================================================================== */}
      <div className="lg:hidden bg-slate-900 border-b border-slate-800 text-white p-4 sticky top-0 z-40 flex items-center justify-between print:hidden">
        <Link href="/admin" prefetch={true} className="flex items-center gap-2">
          <BrandLogo size="sm" variant="dark" />
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            target="_blank"
            className="text-xs text-slate-300 bg-slate-800 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 hover:text-white"
          >
            <ExternalLink size={13} />
            <span>الموقع</span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 bg-slate-800 text-slate-200 rounded-lg hover:text-white hover:bg-slate-700 transition-colors"
            aria-label="فتح القائمة"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* خلفية القائمة المنسدلة في الموبايل */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* دروج القائمة للموبايل */}
      <div
        className={`lg:hidden fixed inset-y-0 right-0 w-80 max-w-[85%] bg-slate-900 text-white z-50 p-6 flex flex-col justify-between transform transition-transform duration-300 ease-in-out border-l border-slate-800 shadow-2xl print:hidden ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div>
          <div className="flex items-center justify-between pb-6 border-b border-slate-800">
            <BrandLogo size="sm" variant="dark" />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="mt-6 space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const active = isLinkActive(item.href);
              const pending = isLinkPending(item.href);
              const Icon = item.icon;
              const badge = item.badgeKey === 'leads' && unreadLeadsCount > 0 ? unreadLeadsCount : null;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  onClick={() => {
                    if (pathname !== item.href) {
                      setPendingPath(item.href);
                    }
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    active
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {pending && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-blue-200 bg-blue-700 px-2 py-0.5 rounded-full animate-pulse">
                        <Loader2 size={11} className="animate-spin" />
                      </span>
                    )}
                    {badge !== null && !pending && (
                      <span className="bg-brand-orange text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                        {badge}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="pt-6 border-t border-slate-800 space-y-3">
          <div className="text-xs text-slate-400">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="font-bold text-white text-xs">
                👋 مرحباً بك، {userName}
              </span>
              <span className="text-[10px] font-bold text-brand-orange bg-brand-orange/20 px-1.5 py-0.5 rounded border border-brand-orange/30">
                {timeGreeting}
              </span>
            </div>
            <p dir="ltr" className="truncate text-[11px]">
              {displayEmail}
            </p>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={loggingOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-red-300 bg-red-950/40 hover:bg-red-900/50 border border-red-800/50 transition-colors"
          >
            <LogOut size={15} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* المحتوى الرئيسي للوحة التحكم (Main Content Area) */}
      {/* ==================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        {/* شريط علوي رفيع للشاشات الكبيرة مع زر طي/فتح السايدبار وشارة الترحيب */}
        <header className="hidden lg:flex items-center justify-between px-6 py-3.5 bg-white border-b border-slate-200/80 sticky top-0 z-20 shadow-xs print:hidden">
          <div className="flex items-center gap-3">
            {/* زر طي / فتح السايدبار الواضح للشاشات الكبيرة */}
            <button
              type="button"
              onClick={toggleSidebar}
              title={isSidebarCollapsed ? 'فتح القائمة الجانبية' : 'طي القائمة الجانبية لتوسيع الشاشة'}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
            >
              {isSidebarCollapsed ? (
                <PanelRightOpen size={19} className="text-brand-navy" />
              ) : (
                <PanelRightClose size={19} className="text-slate-600" />
              )}
            </button>

            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 border border-slate-200 flex items-center gap-1.5">
                <span>
                  أمانكو <span className="text-[#f97316]">بلس</span> للشحن والتوريد
                </span>
                <span className="w-[1px] h-3 bg-slate-300 mx-0.5" />
                <span className="font-sans font-extrabold text-[10.5px] uppercase text-slate-700">AMANCO PLUS</span>
              </span>
              <span className="text-xs text-slate-400 hidden xl:inline">
                القاهرة • الجيزة • القليوبية
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            {unreadLeadsCount > 0 && (
              <Link
                href="/admin/leads"
                className="flex items-center gap-2 text-xs font-bold text-brand-orange bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-lg hover:bg-orange-100 transition-colors animate-pulse"
              >
                <Bell size={14} />
                <span>{unreadLeadsCount} طلبات انضمام جديدة</span>
              </Link>
            )}

            {/* شارة الترحيب الأنيقة بالاسم المسجل دخوله والتحية الزمنية الذكية */}
            <div className="flex items-center gap-2.5 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200/90 shadow-2xs">
              <div className="w-8 h-8 rounded-full bg-blue-600/10 text-blue-700 flex items-center justify-center font-bold border border-blue-600/20 shrink-0">
                <ShieldCheck size={18} className="text-blue-600" />
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-extrabold text-slate-800">
                    👋 مرحباً بك، {userName}
                  </span>
                  <span className="text-[10.5px] font-bold text-brand-orange bg-orange-50 border border-orange-200/80 px-1.5 py-0.5 rounded-md">
                    {timeGreeting}
                  </span>
                </div>
                <p className="text-[10.5px] text-slate-500 font-medium truncate max-w-[200px]" dir="ltr">
                  {displayEmail || userRole}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* محتوى الصفحة الفعلي */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
