'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type {
  Zone,
  TrackingResult,
  Governorate,
  MerchantLeadInsert,
} from '@/types/database';
import { SHIPMENT_STATUS_LABELS } from '@/types/database';
import {
  resolveShippingFee,
  buildWhatsAppLink,
  buildTelLink,
  formatCurrency,
} from '@/modules/finance/calculator';
import BrandLogo from '@/components/public/BrandLogo';
import {
  Search,
  Package,
  Truck,
  Shield,
  MapPin,
  Phone,
  MessageCircle,
  CheckCircle,
  Clock,
  ArrowLeft,
  ChevronDown,
  Calculator,
  Users,
  Zap,
  RefreshCw,
  CreditCard,
  Send,
  Loader2,
  Box,
  DollarSign,
  Eye,
  EyeOff,
  Handshake,
  Star,
  X,
} from 'lucide-react';

// ---- ثوابت ----
const COMPANY_PHONE = '01274365996';

// ---- خرائط ألوان الحالات ----
const STATUS_COLORS: Record<string, string> = {
  PICKUP_REQUESTED: 'bg-yellow-500',
  AT_HUB: 'bg-blue-500',
  OUT_FOR_DELIVERY: 'bg-indigo-500',
  DELIVERED: 'bg-emerald-500',
  PARTIAL_DELIVERED: 'bg-teal-500',
  EXCHANGED: 'bg-cyan-500',
  POSTPONED: 'bg-amber-500',
  RETURNED: 'bg-red-500',
};

// ============================================================================
// الصفحة الرئيسية
// ============================================================================
export default function PublicHomePage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [zonesLoading, setZonesLoading] = useState(true);

  useEffect(() => {
    const fetchZones = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('zones')
        .select('*')
        .eq('is_active', true)
        .order('governorate')
        .order('name');
      if (data) setZones(data as Zone[]);
      setZonesLoading(false);
    };
    fetchZones();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* ---- الهيدر ---- */}
      <Header />

      {/* ---- قسم Hero + تتبع الشحنات ---- */}
      <HeroSection />

      {/* ---- مميزات الشركة ---- */}
      <FeaturesSection />

      {/* ---- أسعار ومناطق التغطية ---- */}
      <ZonesSection zones={zones} loading={zonesLoading} />

      {/* ---- حاسبة تكلفة الشحن ---- */}
      <ShippingCalculator zones={zones} />

      {/* ---- نموذج انضمام التجار ---- */}
      <MerchantJoinForm />

      {/* ---- الفوتر ---- */}
      <Footer />

      {/* ---- أزرار التواصل العائمة ---- */}
      <FloatingContactButtons />
    </div>
  );
}

// ============================================================================
// الهيدر
// ============================================================================
function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { href: '#features', label: 'مميزاتنا' },
    { href: '#zones', label: 'مناطق التغطية' },
    { href: '#calculator', label: 'حاسبة الشحن' },
    { href: '#join', label: 'انضم كتاجر' },
  ];

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 no-print ${
        scrolled
          ? 'bg-white/90 backdrop-blur-xl shadow-lg shadow-slate-200/50'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <BrandLogo size="md" variant={scrolled ? 'light' : 'dark'} />

          {/* نافذة الموبايل */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`lg:hidden p-2 transition-colors ${
              scrolled ? 'text-brand-navy' : 'text-white'
            }`}
            aria-label="فتح القائمة"
          >
            {menuOpen ? <X size={24} /> : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          {/* روابط التنقل - Desktop */}
          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`text-sm font-semibold transition-colors ${
                  scrolled
                    ? 'text-slate-600 hover:text-brand-orange'
                    : 'text-slate-200 hover:text-brand-orange'
                }`}
              >
                {link.label}
              </a>
            ))}
            <a
              href="/login"
              className={`text-sm font-bold px-5 py-2.5 rounded-xl transition-all shadow-xs ${
                scrolled
                  ? 'bg-brand-navy text-white hover:bg-slate-800'
                  : 'bg-white/10 text-white border border-white/20 hover:bg-white/20 backdrop-blur-xs'
              }`}
            >
              دخول الإدارة
            </a>
          </nav>
        </div>

        {/* قائمة الموبايل */}
        {menuOpen && (
          <nav className="lg:hidden pb-4 animate-fade-in-up">
            <div className="flex flex-col gap-2 bg-white rounded-2xl p-4 shadow-xl border border-slate-100">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="text-sm font-semibold text-slate-600 hover:text-brand-orange px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-all"
                >
                  {link.label}
                </a>
              ))}
              <a
                href="/login"
                className="bg-brand-navy text-white text-sm font-bold px-5 py-2.5 rounded-xl text-center hover:bg-slate-800 transition-colors mt-1"
              >
                دخول الإدارة
              </a>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}

// ============================================================================
// قسم Hero + محرك التتبع
// ============================================================================
function HeroSection() {
  const [awb, setAwb] = useState('');
  const [tracking, setTracking] = useState<TrackingResult | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  const handleTrack = useCallback(async () => {
    const trimmed = awb.trim();
    if (!trimmed) return;

    setTrackingLoading(true);
    setTrackingError(null);
    setTracking(null);

    const supabase = createClient();
    const { data, error } = await supabase.rpc('track_shipment_by_awb', {
      p_awb: trimmed,
    });

    if (error) {
      setTrackingError('حدث خطأ في البحث. حاول مرة أخرى.');
      setTrackingLoading(false);
      return;
    }

    if (!data) {
      setTrackingError('لم يتم العثور على شحنة بهذا الرقم. تأكد من رقم البوليصة.');
      setTrackingLoading(false);
      return;
    }

    setTracking(data as TrackingResult);
    setTrackingLoading(false);
  }, [awb]);

  return (
    <section className="relative pt-24 sm:pt-32 pb-16 sm:pb-24 overflow-hidden">
      {/* خلفية متدرجة */}
      <div className="absolute inset-0 bg-gradient-to-bl from-brand-navy via-slate-800 to-brand-navy" />
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-10 right-10 w-72 h-72 rounded-full bg-brand-blue blur-[120px]" />
        <div className="absolute bottom-10 left-10 w-96 h-96 rounded-full bg-brand-orange blur-[150px]" />
      </div>

      {/* نمط خطوط زخرفية */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 40px, #fff 40px, #fff 41px)`,
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-14 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 bg-brand-orange/10 border border-brand-orange/20 rounded-full px-4 py-1.5 mb-6">
            <Zap size={14} className="text-brand-orange" />
            <span className="text-brand-orange text-xs font-bold">
              شحن سريع وآمن في القاهرة الكبرى
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white leading-snug mb-4">
            شحنتك في <span className="text-brand-orange">أمان</span>
            <br />
            <span className="text-slate-300 text-2xl sm:text-3xl md:text-4xl font-bold block mt-1">
              وتوريدك أسرع مع أمانكو <span className="text-[#f97316]">بلس</span>{' '}
              <span className="text-slate-400 text-lg sm:text-xl font-sans font-extrabold uppercase">
                (AMANCO <span className="text-[#f97316]">PLUS</span>)
              </span>
            </span>
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto">
            خدمات لوجستية متكاملة للشحن والتوريد تغطي محافظات القاهرة والجيزة والقليوبية.
            استلام من مقرك، تتبع فوري، وتصفية حسابات سريعة.
          </p>
        </div>

        {/* ---- محرك تتبع الشحنات ---- */}
        <div className="max-w-2xl mx-auto animate-fade-in-up delay-200">
          <div className="bg-white/[0.08] backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl">
            <h2 className="text-white text-lg font-bold mb-4 flex items-center gap-2">
              <Search size={20} className="text-brand-orange" />
              تتبع شحنتك الآن
            </h2>

            <div className="flex gap-3">
              <input
                type="text"
                value={awb}
                onChange={(e) => setAwb(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
                placeholder="أدخل رقم البوليصة مثال: AMC-100101"
                className="flex-1 bg-white/10 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 transition-all text-sm sm:text-base"
                dir="ltr"
              />
              <button
                onClick={handleTrack}
                disabled={trackingLoading || !awb.trim()}
                className="bg-gradient-to-l from-brand-orange to-orange-600 text-white font-bold px-6 sm:px-8 rounded-xl hover:shadow-lg hover:shadow-brand-orange/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed animate-pulse-glow flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                {trackingLoading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <Search size={18} />
                    <span className="hidden sm:inline">تتبع</span>
                  </>
                )}
              </button>
            </div>

            {/* خطأ التتبع */}
            {trackingError && (
              <div className="mt-4 bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-xl p-3 text-center animate-fade-in-up">
                {trackingError}
              </div>
            )}

            {/* نتيجة التتبع */}
            {tracking && <TrackingResultCard result={tracking} />}
          </div>
        </div>
      </div>

      {/* موجة سفلية */}
      <div className="absolute bottom-0 inset-x-0">
        <svg viewBox="0 0 1440 80" fill="none" preserveAspectRatio="none" className="w-full h-12 sm:h-16">
          <path d="M0 40C360 80 720 0 1080 40C1260 60 1380 50 1440 40V80H0V40Z" fill="white" />
        </svg>
      </div>
    </section>
  );
}

// ============================================================================
// كارد نتيجة التتبع
// ============================================================================
function TrackingResultCard({ result }: { result: TrackingResult }) {
  return (
    <div className="mt-6 bg-white rounded-2xl p-5 sm:p-6 text-slate-800 animate-fade-in-up shadow-lg">
      {/* الحالة الحالية */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
        <div>
          <p className="text-xs text-slate-500 mb-1">رقم البوليصة</p>
          <p className="text-lg font-bold text-brand-navy tracking-wide" dir="ltr">
            {result.awb_number}
          </p>
        </div>
        <span
          className={`${STATUS_COLORS[result.status] || 'bg-slate-500'} text-white text-sm font-bold px-4 py-1.5 rounded-full`}
        >
          {SHIPMENT_STATUS_LABELS[result.status]}
        </span>
      </div>

      {/* تفاصيل الشحنة */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5 text-sm">
        <div>
          <p className="text-slate-400 text-xs mb-0.5">المستلم</p>
          <p className="font-semibold">{result.recipient_name}</p>
        </div>
        <div>
          <p className="text-slate-400 text-xs mb-0.5">المنطقة</p>
          <p className="font-semibold">
            {result.governorate} - {result.zone_name}
          </p>
        </div>
        <div>
          <p className="text-slate-400 text-xs mb-0.5">فتح الشحنة</p>
          <p className="font-semibold">
            {result.allow_open_package ? (
              <span className="text-emerald-600 flex items-center gap-1">
                <Eye size={14} /> مسموح
              </span>
            ) : (
              <span className="text-red-500 flex items-center gap-1">
                <EyeOff size={14} /> غير مسموح
              </span>
            )}
          </p>
        </div>
        {result.expected_cod > 0 && (
          <div>
            <p className="text-slate-400 text-xs mb-0.5">المبلغ المطلوب</p>
            <p className="font-bold text-brand-orange">
              {formatCurrency(result.expected_cod)}
            </p>
          </div>
        )}
      </div>

      {/* Timeline الأحداث */}
      {result.events.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-600 mb-3">
            سجل حركة الشحنة
          </h3>
          <div className="relative pr-6 space-y-4">
            {/* خط عمودي */}
            <div className="absolute right-[9px] top-2 bottom-2 w-0.5 bg-slate-200" />

            {result.events.map((event, index) => (
              <div key={index} className="relative animate-slide-in-right" style={{ animationDelay: `${index * 0.1}s` }}>
                <div
                  className={`absolute right-[-15px] top-1.5 w-3 h-3 rounded-full border-2 border-white ${
                    index === 0
                      ? STATUS_COLORS[event.status] || 'bg-slate-400'
                      : 'bg-slate-300'
                  }`}
                />
                <div className={`${index === 0 ? 'bg-slate-50' : ''} rounded-lg p-2.5`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-semibold ${index === 0 ? 'text-brand-navy' : 'text-slate-500'}`}>
                      {event.title}
                    </p>
                    <time className="text-[11px] text-slate-400 whitespace-nowrap" dir="ltr">
                      {new Date(event.created_at).toLocaleDateString('ar-EG', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </div>
                  {event.notes && (
                    <p className="text-xs text-slate-500 mt-1">{event.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// مميزات الشركة
// ============================================================================
function FeaturesSection() {
  const features = [
    {
      icon: <MapPin size={28} />,
      title: 'تغطية شاملة',
      description:
        'نغطي محافظات القاهرة والجيزة والقليوبية بالكامل بشبكة مناديب متخصصة.',
      color: 'from-blue-500 to-brand-blue',
    },
    {
      icon: <Truck size={28} />,
      title: 'استلام من مقرك',
      description:
        'مندوبنا يستلم الشحنات من مقر عملك (Pickup) بدون أي عناء عليك.',
      color: 'from-brand-orange to-orange-600',
    },
    {
      icon: <Package size={28} />,
      title: 'تسليم جزئي واستبدال',
      description:
        'ندعم التسليم الجزئي واستبدال الشحنات بمرونة تامة حسب رغبة العميل.',
      color: 'from-teal-500 to-emerald-600',
    },
    {
      icon: <Shield size={28} />,
      title: 'أمان وموثوقية',
      description:
        'كل شحنة مؤمّنة ومتتبعة برقم بوليصة فريد من لحظة الاستلام حتى التسليم.',
      color: 'from-indigo-500 to-brand-blue',
    },
    {
      icon: <CreditCard size={28} />,
      title: 'تصفية حسابات سريعة',
      description:
        'تصفية حسابات التجار بشكل دوري عبر كاش أو إنستاباي أو المحفظة الإلكترونية.',
      color: 'from-brand-green to-emerald-600',
    },
    {
      icon: <Clock size={28} />,
      title: 'تتبع فوري 24/7',
      description:
        'تتبع شحنتك في أي وقت برقم البوليصة بدون تسجيل دخول مع سجل حركة كامل.',
      color: 'from-amber-500 to-brand-orange',
    },
  ];

  return (
    <section id="features" className="py-16 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block bg-brand-orange/10 text-brand-orange text-xs font-bold px-4 py-1.5 rounded-full mb-4">
            لماذا أمانكو بلس؟
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-brand-navy mb-3">
            مميزات تجعلنا خيارك الأول
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto">
            نقدم لك خدمة شحن متكاملة بأعلى معايير الجودة والسرعة والأمان.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-xl hover:shadow-slate-100 hover:-translate-y-1 transition-all duration-300 animate-fade-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div
                className={`w-14 h-14 rounded-2xl bg-gradient-to-bl ${feature.color} flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform duration-300`}
              >
                {feature.icon}
              </div>
              <h3 className="text-lg font-bold text-brand-navy mb-2">
                {feature.title}
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// أسعار ومناطق التغطية
// ============================================================================
function ZonesSection({ zones, loading }: { zones: Zone[]; loading: boolean }) {
  const governorates: Governorate[] = ['القاهرة', 'الجيزة', 'القليوبية'];

  return (
    <section
      id="zones"
      className="py-16 sm:py-24 bg-gradient-to-b from-slate-50 to-white"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block bg-brand-blue/10 text-brand-blue text-xs font-bold px-4 py-1.5 rounded-full mb-4">
            التغطية والأسعار
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-brand-navy mb-3">
            مناطق التغطية وأسعار الشحن
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto">
            نغطي جميع المناطق الرئيسية في القاهرة الكبرى بأسعار تنافسية وشفافة.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="animate-spin mx-auto text-brand-orange" size={36} />
            <p className="text-slate-400 mt-3">جاري تحميل المناطق...</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {governorates.map((gov) => {
              const govZones = zones.filter((z) => z.governorate === gov);
              return (
                <div
                  key={gov}
                  className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300"
                >
                  <div className="bg-gradient-to-l from-brand-navy to-slate-800 text-white px-6 py-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <MapPin size={18} className="text-brand-orange" />
                      {gov}
                    </h3>
                    <p className="text-slate-300 text-xs mt-0.5">
                      {govZones.length} منطقة
                    </p>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {govZones.map((zone) => (
                      <div
                        key={zone.id}
                        className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50 transition-colors"
                      >
                        <span className="text-sm font-semibold text-slate-700">
                          {zone.name}
                        </span>
                        <span className="text-sm font-bold text-brand-orange bg-brand-orange/10 px-3 py-1 rounded-full">
                          {formatCurrency(zone.base_shipping_fee)}
                        </span>
                      </div>
                    ))}
                    {govZones.length === 0 && (
                      <p className="text-center text-slate-400 text-sm py-6">
                        لا توجد مناطق متاحة حالياً
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// حاسبة تكلفة الشحن
// ============================================================================
function ShippingCalculator({ zones }: { zones: Zone[] }) {
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [calculatedFee, setCalculatedFee] = useState<number | null>(null);

  const handleCalculate = () => {
    const zone = zones.find((z) => z.id === selectedZoneId);
    if (!zone) return;
    const fee = resolveShippingFee({
      zoneBaseShippingFee: zone.base_shipping_fee,
      merchantVipFee: null, // السعر العام (الزائر ليس تاجر VIP)
    });
    setCalculatedFee(fee);
  };

  return (
    <section
      id="calculator"
      className="py-16 sm:py-24 bg-white"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-bl from-brand-navy to-slate-800 rounded-3xl p-8 sm:p-12 text-center shadow-2xl relative overflow-hidden">
          {/* زخرفة */}
          <div className="absolute top-0 left-0 w-40 h-40 bg-brand-orange/10 rounded-full blur-[80px]" />
          <div className="absolute bottom-0 right-0 w-56 h-56 bg-brand-blue/10 rounded-full blur-[100px]" />

          <div className="relative z-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-orange/20 rounded-2xl mb-6">
              <Calculator size={32} className="text-brand-orange" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
              احسب تكلفة شحنتك
            </h2>
            <p className="text-slate-400 text-sm mb-8">
              اختر المنطقة لمعرفة سعر الشحن الأساسي فوراً.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-center">
              <div className="relative">
                <select
                  value={selectedZoneId}
                  onChange={(e) => {
                    setSelectedZoneId(e.target.value);
                    setCalculatedFee(null);
                  }}
                  className="appearance-none bg-white/10 border border-white/15 text-white rounded-xl py-3 pr-4 pl-10 w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 transition-all cursor-pointer"
                >
                  <option value="" className="text-slate-800">اختر المنطقة</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id} className="text-slate-800">
                      {zone.governorate} - {zone.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
              </div>

              <button
                onClick={handleCalculate}
                disabled={!selectedZoneId}
                className="bg-gradient-to-l from-brand-orange to-orange-600 text-white font-bold px-8 py-3 rounded-xl hover:shadow-lg hover:shadow-brand-orange/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                احسب السعر
              </button>
            </div>

            {calculatedFee !== null && (
              <div className="mt-8 animate-fade-in-up">
                <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl px-8 py-5">
                  <DollarSign size={24} className="text-brand-orange" />
                  <div className="text-right">
                    <p className="text-slate-400 text-xs">سعر الشحن</p>
                    <p className="text-3xl font-black text-white">
                      {formatCurrency(calculatedFee)}
                    </p>
                  </div>
                </div>
                <p className="text-slate-500 text-xs mt-3">
                  * الأسعار قابلة للتعديل بناءً على اتفاقيات التجار VIP
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// نموذج انضمام التجار
// ============================================================================
function MerchantJoinForm() {
  const [formData, setFormData] = useState<MerchantLeadInsert>({
    contact_name: '',
    brand_name: '',
    phone: '',
    governorate: 'القاهرة',
    expected_daily_orders: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    if (!formData.contact_name.trim() || !formData.brand_name.trim() || !formData.phone.trim()) {
      setFormError('يرجى ملء جميع الحقول المطلوبة.');
      setSubmitting(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.from('merchant_leads').insert([formData]);

    if (error) {
      setFormError('حدث خطأ أثناء إرسال الطلب. حاول مرة أخرى.');
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <section id="join" className="py-16 sm:py-24 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-xl mx-auto px-4 text-center animate-fade-in-up">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-10">
            <div className="w-20 h-20 bg-brand-green/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={40} className="text-brand-green" />
            </div>
            <h3 className="text-2xl font-black text-brand-navy mb-3">
              تم إرسال طلبك بنجاح!
            </h3>
            <p className="text-slate-500 mb-6">
              سيتواصل معك فريقنا خلال 24 ساعة لإتمام التعاقد.
            </p>
            <a
              href={buildWhatsAppLink(
                COMPANY_PHONE,
                'مرحباً، أرسلت طلب تعاقد عبر الموقع وأريد الاستفسار.',
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-brand-green text-white font-bold px-6 py-3 rounded-xl hover:bg-emerald-700 transition-colors"
            >
              <MessageCircle size={18} />
              تواصل عبر واتساب الآن
            </a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="join" className="py-16 sm:py-24 bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* النص التحفيزي */}
          <div className="animate-fade-in-up">
            <span className="inline-block bg-brand-green/10 text-brand-green text-xs font-bold px-4 py-1.5 rounded-full mb-4">
              فرصة للتجار
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-brand-navy mb-4">
              انضم لعائلة أمانكو بلس
            </h2>
            <p className="text-slate-500 mb-8 leading-relaxed">
              سجّل بياناتك الآن واحصل على خدمة شحن متكاملة بأسعار تنافسية مع
              استلام من مقرك وتصفية حسابات سريعة.
            </p>

            <div className="space-y-4">
              {[
                { icon: <Truck size={18} />, text: 'استلام يومي من مقرك (Pickup)' },
                { icon: <Star size={18} />, text: 'أسعار VIP مخصصة للتجار المميزين' },
                { icon: <RefreshCw size={18} />, text: 'دعم الاستبدال والتسليم الجزئي' },
                { icon: <CreditCard size={18} />, text: 'تصفية حسابات فورية (كاش / إنستاباي / محفظة)' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-brand-orange/10 rounded-lg flex items-center justify-center text-brand-orange shrink-0">
                    {item.icon}
                  </div>
                  <span className="text-sm font-semibold text-slate-700">
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* النموذج */}
          <div className="animate-fade-in-up delay-200">
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-3xl border border-slate-100 shadow-xl p-6 sm:p-8 space-y-5"
            >
              <h3 className="text-xl font-bold text-brand-navy flex items-center gap-2">
                <Handshake size={22} className="text-brand-orange" />
                طلب تعاقد جديد
              </h3>

              <div>
                <label htmlFor="join-name" className="block text-sm font-semibold text-slate-600 mb-1.5">
                  الاسم بالكامل *
                </label>
                <input
                  id="join-name"
                  type="text"
                  value={formData.contact_name}
                  onChange={(e) =>
                    setFormData({ ...formData, contact_name: e.target.value })
                  }
                  required
                  className="w-full border border-slate-200 rounded-xl py-3 px-4 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange/40 transition-all text-sm"
                  placeholder="مثال: أحمد محمد"
                />
              </div>

              <div>
                <label htmlFor="join-brand" className="block text-sm font-semibold text-slate-600 mb-1.5">
                  اسم البراند / المتجر *
                </label>
                <input
                  id="join-brand"
                  type="text"
                  value={formData.brand_name}
                  onChange={(e) =>
                    setFormData({ ...formData, brand_name: e.target.value })
                  }
                  required
                  className="w-full border border-slate-200 rounded-xl py-3 px-4 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange/40 transition-all text-sm"
                  placeholder="مثال: متجر الأناقة"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="join-phone" className="block text-sm font-semibold text-slate-600 mb-1.5">
                    رقم التليفون *
                  </label>
                  <input
                    id="join-phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    required
                    className="w-full border border-slate-200 rounded-xl py-3 px-4 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange/40 transition-all text-sm"
                    placeholder="01xxxxxxxxx"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label htmlFor="join-gov" className="block text-sm font-semibold text-slate-600 mb-1.5">
                    المحافظة *
                  </label>
                  <div className="relative">
                    <select
                      id="join-gov"
                      value={formData.governorate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          governorate: e.target.value as Governorate,
                        })
                      }
                      className="appearance-none w-full border border-slate-200 rounded-xl py-3 pr-4 pl-8 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange/40 transition-all text-sm cursor-pointer"
                    >
                      <option value="القاهرة">القاهرة</option>
                      <option value="الجيزة">الجيزة</option>
                      <option value="القليوبية">القليوبية</option>
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="join-orders" className="block text-sm font-semibold text-slate-600 mb-1.5">
                  عدد الأوردرات اليومية المتوقع
                </label>
                <input
                  id="join-orders"
                  type="text"
                  value={formData.expected_daily_orders || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      expected_daily_orders: e.target.value,
                    })
                  }
                  className="w-full border border-slate-200 rounded-xl py-3 px-4 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange/40 transition-all text-sm"
                  placeholder="مثال: 10-20 أوردر"
                />
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 text-center">
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-l from-brand-orange to-orange-600 text-white font-bold py-3.5 rounded-xl hover:shadow-lg hover:shadow-brand-orange/25 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    أرسل طلب التعاقد
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// الفوتر
// ============================================================================
function Footer() {
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <footer className="bg-brand-navy text-white pt-14 pb-8 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* العمود الأول: الشعار والوصف */}
          <div className="sm:col-span-2 lg:col-span-1">
            <BrandLogo size="lg" variant="dark" />
            <p className="text-slate-400 text-sm mt-4 leading-relaxed">
              شركة أمانكو بلس للشحن والتوريد (AMANCO PLUS) - خدمات لوجستية وشحن احترافي وتوريد بضائع في
              محافظات القاهرة والجيزة والقليوبية.
            </p>
          </div>

          {/* روابط سريعة */}
          <div>
            <h4 className="text-sm font-bold text-white mb-4">روابط سريعة</h4>
            <ul className="space-y-2.5">
              {[
                { href: '#features', label: 'مميزات الخدمة' },
                { href: '#zones', label: 'مناطق التغطية' },
                { href: '#calculator', label: 'حاسبة الشحن' },
                { href: '#join', label: 'انضم كتاجر' },
              ].map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-slate-400 text-sm hover:text-brand-orange transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* خدمات الشحن */}
          <div>
            <h4 className="text-sm font-bold text-white mb-4">خدماتنا</h4>
            <ul className="space-y-2.5">
              {[
                'شحن وتوصيل COD',
                'استلام من المقر (Pickup)',
                'تسليم جزئي واستبدال',
                'تتبع الشحنات',
                'تصفية حسابات دورية',
              ].map((item) => (
                <li key={item} className="text-slate-400 text-sm">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* التواصل */}
          <div>
            <h4 className="text-sm font-bold text-white mb-4">تواصل معنا</h4>
            <div className="space-y-3">
              <a
                href={buildTelLink(COMPANY_PHONE)}
                className="flex items-center gap-3 text-slate-400 text-sm hover:text-white transition-colors"
              >
                <Phone size={16} className="text-brand-orange shrink-0" />
                <span dir="ltr">{COMPANY_PHONE}</span>
              </a>
              <a
                href={buildWhatsAppLink(COMPANY_PHONE)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-slate-400 text-sm hover:text-white transition-colors"
              >
                <MessageCircle size={16} className="text-brand-green shrink-0" />
                واتساب
              </a>
              <p className="text-slate-500 text-xs mt-2">
                المسؤول: أ/ محمد عبد الباسط
              </p>
            </div>
          </div>
        </div>

        {/* حقوق النشر */}
        <div className="border-t border-slate-800 pt-6 text-center">
          <p className="text-slate-500 text-xs">
            © {currentYear} شركة أمانكو بلس للشحن والتوريد (AMANCO PLUS). جميع الحقوق محفوظة.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ============================================================================
// أزرار التواصل العائمة
// ============================================================================
function FloatingContactButtons() {
  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col gap-3 no-print">
      {/* واتساب */}
      <a
        href={buildWhatsAppLink(
          COMPANY_PHONE,
          'مرحباً، أريد الاستفسار عن خدمات الشحن والتوريد من أمانكو بلس (AMANCO PLUS).',
        )}
        target="_blank"
        rel="noopener noreferrer"
        className="w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center text-white shadow-lg shadow-[#25D366]/30 hover:scale-110 transition-transform duration-200"
        aria-label="تواصل عبر واتساب"
      >
        <MessageCircle size={26} />
      </a>
      {/* اتصال مباشر */}
      <a
        href={buildTelLink(COMPANY_PHONE)}
        className="w-14 h-14 bg-brand-blue rounded-full flex items-center justify-center text-white shadow-lg shadow-brand-blue/30 hover:scale-110 transition-transform duration-200"
        aria-label="اتصال مباشر"
      >
        <Phone size={24} />
      </a>
    </div>
  );
}
