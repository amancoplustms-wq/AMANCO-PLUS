'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import BrandLogo from '@/components/public/BrandLogo';
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
} from 'lucide-react';

interface AdminShellProps {
  userEmail: string;
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

export default function AdminShell({ userEmail, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadLeadsCount, setUnreadLeadsCount] = useState<number>(0);
  const [loggingOut, setLoggingOut] = useState(false);

  // جلب عدد طلبات التجار غير المتواصل معهم لعرض إشعار في السايدبار
  useEffect(() => {
    const supabase = createClient();
    async function fetchLeadsBadge() {
      try {
        const { count } = await supabase
          .from('merchant_leads')
          .select('*', { count: 'exact', head: true })
          .eq('is_contacted', false);
        if (count !== null) setUnreadLeadsCount(count);
      } catch (err) {
        console.error('Failed to fetch leads count:', err);
      }
    }
    fetchLeadsBadge();
  }, [pathname]);

  // إغلاق قائمة الموبايل عند تغيير الصفحة
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Sign out error:', err);
      setLoggingOut(false);
    }
  };

  const isLinkActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row text-slate-800 antialiased" dir="rtl">
      {/* ==================================================================== */}
      {/* السايدبار الثابت على الديسكتوب (Desktop Sidebar) */}
      {/* ==================================================================== */}
      <aside className="hidden lg:flex lg:flex-col lg:w-72 bg-slate-900 border-l border-slate-800 text-white shrink-0 sticky top-0 h-screen z-30 print:hidden">
        {/* ترويسة السايدبار والشعار */}
        <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between gap-2">
          <Link href="/admin" className="flex items-center group">
            <BrandLogo size="sm" variant="dark" />
          </Link>
          <span className="text-[10px] bg-brand-orange/20 text-brand-orange font-bold px-2 py-0.5 rounded-full border border-brand-orange/30 shrink-0">
            لوحة الإدارة
          </span>
        </div>

        {/* عناصر القائمة */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
            القائمة الرئيسية
          </div>

          {NAV_ITEMS.map((item) => {
            const active = isLinkActive(item.href);
            const Icon = item.icon;
            const badge = item.badgeKey === 'leads' && unreadLeadsCount > 0 ? unreadLeadsCount : null;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group ${
                  active
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    size={19}
                    className={`transition-transform duration-200 group-hover:scale-110 ${
                      active ? 'text-white' : 'text-slate-400 group-hover:text-brand-orange'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {badge !== null && (
                    <span className="bg-brand-orange text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                      {badge} جديد
                    </span>
                  )}
                  {active && <ChevronLeft size={16} className="text-white/80" />}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* أسفل السايدبار: معلومات المستخدم والخروج */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-3">
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

          {/* بيانات الحساب */}
          <div className="flex items-center gap-3 px-3 py-2 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <div className="w-9 h-9 rounded-full bg-blue-700/30 text-blue-400 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-600/30">
              <ShieldCheck size={18} className="text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">المدير العام</p>
              <p className="text-[11px] text-slate-400 truncate" dir="ltr">
                {userEmail}
              </p>
            </div>
          </div>

          {/* زر تسجيل الخروج */}
          <button
            onClick={handleSignOut}
            disabled={loggingOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-red-300 bg-red-950/30 hover:bg-red-900/40 hover:text-red-200 border border-red-800/40 transition-all cursor-pointer disabled:opacity-50"
          >
            <LogOut size={15} />
            <span>{loggingOut ? 'جاري الخروج...' : 'تسجيل الخروج'}</span>
          </button>
        </div>
      </aside>

      {/* ==================================================================== */}
      {/* الهيدر العلوي للموبايل والقائمة المنسدلة (Mobile Header & Drawer) */}
      {/* ==================================================================== */}
      <div className="lg:hidden bg-slate-900 border-b border-slate-800 text-white p-4 sticky top-0 z-40 flex items-center justify-between print:hidden">
        <Link href="/admin" className="flex items-center gap-2">
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
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="mt-6 space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const active = isLinkActive(item.href);
              const Icon = item.icon;
              const badge = item.badgeKey === 'leads' && unreadLeadsCount > 0 ? unreadLeadsCount : null;

              return (
                <Link
                  key={item.href}
                  href={item.href}
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
                  {badge !== null && (
                    <span className="bg-brand-orange text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="pt-6 border-t border-slate-800 space-y-3">
          <div className="text-xs text-slate-400">
            <p className="font-bold text-white mb-0.5">المدير العام</p>
            <p dir="ltr" className="truncate text-[11px]">
              {userEmail}
            </p>
          </div>

          <button
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
      <div className="flex-1 flex flex-col min-w-0">
        {/* شريط علوي رفيع للديسكتوب */}
        <header className="hidden lg:flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200/80 sticky top-0 z-20 shadow-xs print:hidden">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 border border-slate-200 flex items-center gap-1.5">
              <span>أمانكو <span className="text-[#f97316]">بلس</span> للشحن والتوريد</span>
              <span className="w-[1px] h-3 bg-slate-300 mx-0.5" />
              <span className="font-sans font-extrabold text-[10.5px] uppercase text-slate-700">AMANCO PLUS</span>
            </span>
            <span className="text-xs text-slate-400">
              القاهرة • الجيزة • القليوبية
            </span>
          </div>

          <div className="flex items-center gap-4">
            {unreadLeadsCount > 0 && (
              <Link
                href="/admin/leads"
                className="flex items-center gap-2 text-xs font-bold text-brand-orange bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-lg hover:bg-orange-100 transition-colors animate-pulse"
              >
                <Bell size={14} />
                <span>{unreadLeadsCount} طلبات انضمام جديدة</span>
              </Link>
            )}

            <div className="text-left" dir="ltr">
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                {userEmail}
              </span>
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
