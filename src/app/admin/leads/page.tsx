'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { buildWhatsAppLink, buildTelLink } from '@/modules/finance/calculator';
import type { MerchantLead, MerchantInsert, Governorate } from '@/types/database';
import {
  UserPlus,
  Phone,
  MessageCircle,
  CheckCircle,
  Clock,
  Search,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  PackageCheck,
  Check,
  Building,
  MapPin,
  Calendar,
  X,
} from 'lucide-react';

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<MerchantLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'CONTACTED'>('PENDING');

  // بيانات التجار الحاليين لمنع التكرار
  const [existingMerchantPhones, setExistingMerchantPhones] = useState<Set<string>>(new Set());
  const [existingMerchantBrands, setExistingMerchantBrands] = useState<Set<string>>(new Set());

  // Modal تحويل لتاجر متعاقد
  const [convertingLead, setConvertingLead] = useState<MerchantLead | null>(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [isVipInitial, setIsVipInitial] = useState(false);
  const [submittingConvert, setSubmittingConvert] = useState(false);
  const [convertSuccess, setConvertSuccess] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [leadsRes, merchantsRes] = await Promise.all([
        supabase
          .from('merchant_leads')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('merchants')
          .select('phone, brand_name'),
      ]);

      if (leadsRes.error) console.error('Error fetching leads:', leadsRes.error);
      else setLeads(leadsRes.data || []);

      if (!merchantsRes.error && merchantsRes.data) {
        setExistingMerchantPhones(new Set(merchantsRes.data.map((m) => m.phone.trim())));
        setExistingMerchantBrands(new Set(merchantsRes.data.map((m) => m.brand_name.trim().toLowerCase())));
      }
    } catch (err) {
      console.error('Failed to load merchant leads:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // تبديل حالة "تم التواصل"
  const handleToggleContacted = async (lead: MerchantLead) => {
    try {
      const supabase = createClient();
      const newStatus = !lead.is_contacted;
      const { error } = await supabase
        .from('merchant_leads')
        .update({ is_contacted: newStatus })
        .eq('id', lead.id);

      if (error) throw error;
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, is_contacted: newStatus } : l)),
      );
    } catch (err: unknown) {
      alert(`حدث خطأ أثناء تحديث حالة الطلب: ${(err as Error).message}`);
    }
  };

  // فتح نافذة تحويل الطلب لتاجر متعاقد
  const openConvertModal = (lead: MerchantLead) => {
    setConvertingLead(lead);
    setPickupAddress(`محافظة ${lead.governorate}`);
    setIsVipInitial(false);
    setConvertSuccess(null);
  };

  // تأكيد تحويل الطلب لتاجر متعاقد رسمي
  const handleConfirmConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingLead) return;
    if (!pickupAddress.trim()) {
      alert('يرجى تحديد عنوان مبدئي لاستلام الشحنات');
      return;
    }

    setSubmittingConvert(true);
    try {
      const supabase = createClient();

      // تحقق سيرفري من عدم وجود تاجر بنفس رقم الهاتف قبل الإدراج
      const { data: existingByPhone } = await supabase
        .from('merchants')
        .select('id')
        .eq('phone', convertingLead.phone.trim())
        .limit(1);

      if (existingByPhone && existingByPhone.length > 0) {
        alert(`يوجد بالفعل تاجر مسجل بنفس رقم الهاتف (${convertingLead.phone}). لا يمكن إنشاء تاجر مكرر.`);
        setSubmittingConvert(false);
        return;
      }

      // 1. إنشاء التاجر الجديد في جدول merchants
      const merchantPayload: MerchantInsert = {
        name: convertingLead.contact_name.trim(),
        brand_name: convertingLead.brand_name.trim(),
        phone: convertingLead.phone.trim(),
        whatsapp: convertingLead.phone.trim(),
        pickup_address: pickupAddress.trim(),
        governorate: convertingLead.governorate,
        is_vip: isVipInitial,
        notes: `تم تحويله آلياً من طلب انضمام وارد للموقع بتاريخ ${new Date(
          convertingLead.created_at,
        ).toLocaleDateString('ar-EG')}. الشحنات المتوقعة: ${
          convertingLead.expected_daily_orders || 'غير محدد'
        }`,
        is_active: true,
      };

      const { error: insertErr } = await supabase
        .from('merchants')
        .insert(merchantPayload);

      if (insertErr) throw insertErr;

      // 2. تحديث الطلب كـ "تم التواصل"
      await supabase
        .from('merchant_leads')
        .update({ is_contacted: true })
        .eq('id', convertingLead.id);

      // تحديث الواجهة
      setLeads((prev) =>
        prev.map((l) => (l.id === convertingLead.id ? { ...l, is_contacted: true } : l)),
      );

      setConvertSuccess(
        `تم تحويل براند "${convertingLead.brand_name}" بنجاح إلى تاجر متعاقد رسمي!`,
      );

      // تحديث قوائم التجار الموجودين لمنع تكرار إعادة التحويل
      setExistingMerchantPhones((prev) => new Set(prev).add(convertingLead.phone.trim()));
      setExistingMerchantBrands((prev) => new Set(prev).add(convertingLead.brand_name.trim().toLowerCase()));

      setTimeout(() => {
        setConvertingLead(null);
      }, 1500);
    } catch (err: unknown) {
      alert(`حدث خطأ أثناء تحويل الطلب: ${(err as Error).message}`);
    } finally {
      setSubmittingConvert(false);
    }
  };

  // فلترة الطلبات (Memoized)
  const filteredLeads = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return leads.filter((lead) => {
      const matchesSearch =
        !q ||
        lead.contact_name.toLowerCase().includes(q) ||
        lead.brand_name.toLowerCase().includes(q) ||
        lead.phone.includes(q) ||
        lead.governorate.toLowerCase().includes(q);

      const matchesStatus =
        filterStatus === 'ALL' ||
        (filterStatus === 'PENDING' && !lead.is_contacted) ||
        (filterStatus === 'CONTACTED' && lead.is_contacted);

      return matchesSearch && matchesStatus;
    });
  }, [leads, searchQuery, filterStatus]);

  const { totalLeads, pendingLeads, contactedLeads } = useMemo(() => {
    let pending = 0;
    let contacted = 0;
    leads.forEach((l) => {
      if (l.is_contacted) contacted++;
      else pending++;
    });
    return {
      totalLeads: leads.length,
      pendingLeads: pending,
      contactedLeads: contacted,
    };
  }, [leads]);

  return (
    <div className="space-y-6">
      {/* ==================================================================== */}
      {/* ترويسة الصفحة */}
      {/* ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-brand-navy flex items-center gap-2.5">
            <UserPlus className="text-brand-orange" size={26} />
            طلبات انضمام التجار الجدد
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            متابعة طلبات التعاقد الواردة من الموقع التعريفي والتواصل مع العملاء المحتملين
          </p>
        </div>

        <button
          onClick={fetchLeads}
          className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin text-brand-orange' : ''} />
          <span>تحديث الطلبات</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* بطاقات الإحصائيات السريعة */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-bold block mb-1">إجمالي الطلبات المستلمة</span>
          <span className="text-2xl font-black text-slate-800">{totalLeads}</span>
          <span className="text-xs text-slate-400 mr-2">طلب انضمام</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-orange-200 bg-orange-50/30">
          <span className="text-xs text-brand-orange font-bold block mb-1">بانتظار التواصل (جديد)</span>
          <span className="text-2xl font-black text-brand-orange">{pendingLeads}</span>
          <span className="text-xs text-slate-500 mr-2">يحتاج إلى اتصال سريع</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/30">
          <span className="text-xs text-emerald-700 font-bold block mb-1">تم التواصل معهم</span>
          <span className="text-2xl font-black text-emerald-600">{contactedLeads}</span>
          <span className="text-xs text-slate-500 mr-2">تم التنسيق معهم</span>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* شريط الفلترة والبحث */}
      {/* ==================================================================== */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setFilterStatus('PENDING')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
              filterStatus === 'PENDING'
                ? 'bg-brand-orange text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Clock size={13} />
            <span>طلبات جديدة ({pendingLeads})</span>
          </button>

          <button
            onClick={() => setFilterStatus('CONTACTED')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
              filterStatus === 'CONTACTED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Check size={13} />
            <span>تم التواصل ({contactedLeads})</span>
          </button>

          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              filterStatus === 'ALL'
                ? 'bg-brand-navy text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            الكل ({totalLeads})
          </button>
        </div>

        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="بحث بالاسم، البراند، أو الهاتف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-right"
          />
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
        </div>
      </div>

      {/* ==================================================================== */}
      {/* قائمة الطلبات */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw size={26} className="animate-spin mx-auto mb-2 text-brand-orange" />
            <p className="text-sm">جاري تحميل طلبات الانضمام...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <UserPlus size={36} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold">لا توجد طلبات مطابقة للفلتر المحدد</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">البراند والمسؤول</th>
                  <th className="py-3.5 px-4">المحافظة</th>
                  <th className="py-3.5 px-4">الطلبات اليومية المتوقعة</th>
                  <th className="py-3.5 px-4">التواصل السريع</th>
                  <th className="py-3.5 px-4">تاريخ التقديم</th>
                  <th className="py-3.5 px-4">حالة المتابعة</th>
                  <th className="py-3.5 px-4 text-center">التحويل لتاجر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.map((lead) => {
                  const whatsappMsg = `أهلاً بحضرتك أ/ ${lead.contact_name}، معك إدارة شركة أمانكو بلس للشحن والتوريد (AMANCO PLUS) بخصوص طلب انضمام براند "${lead.brand_name}" في محافظة ${lead.governorate}...`;

                  return (
                    <tr
                      key={lead.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        !lead.is_contacted ? 'bg-orange-50/20' : ''
                      }`}
                    >
                      {/* البراند والمسؤول */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-base">
                          {lead.brand_name}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          المسؤول: {lead.contact_name}
                        </div>
                      </td>

                      {/* المحافظة */}
                      <td className="py-3.5 px-4">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                          {lead.governorate}
                        </span>
                      </td>

                      {/* حجم الطلبات المتوقع */}
                      <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                        {lead.expected_daily_orders ? (
                          <span className="bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-800">
                            {lead.expected_daily_orders} شحنة/يوم
                          </span>
                        ) : (
                          <span className="text-slate-400">غير محدد</span>
                        )}
                      </td>

                      {/* التواصل المباشر */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <a
                            href={buildTelLink(lead.phone)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors"
                            title="اتصال هاتفي"
                          >
                            <Phone size={13} />
                            <span dir="ltr">{lead.phone}</span>
                          </a>

                          <a
                            href={buildWhatsAppLink(lead.phone, whatsappMsg)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                            title="مراسلة واتساب فورية"
                          >
                            <MessageCircle size={15} />
                          </a>
                        </div>
                      </td>

                      {/* التاريخ */}
                      <td className="py-3.5 px-4 text-xs text-slate-400 whitespace-nowrap" dir="ltr">
                        {new Date(lead.created_at).toLocaleDateString('ar-EG', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* حالة المتابعة */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleContacted(lead)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                            lead.is_contacted
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 animate-pulse'
                          }`}
                          title="اضغط لتغيير حالة التواصل"
                        >
                          {lead.is_contacted ? (
                            <>
                              <CheckCircle size={13} />
                              <span>تم التواصل</span>
                            </>
                          ) : (
                            <>
                              <Clock size={13} />
                              <span>بانتظار الاتصال</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* التحويل لتاجر متعاقد */}
                      <td className="py-3.5 px-4 text-center">
                        {existingMerchantPhones.has(lead.phone.trim()) ||
                         existingMerchantBrands.has(lead.brand_name.trim().toLowerCase()) ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                            <CheckCircle size={14} />
                            <span>✓ تم التحويل لتاجر بالفعل</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => openConvertModal(lead)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-l from-brand-orange to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
                            title="تحويل هذا الطلب إلى حساب تاجر رسمي في ثوانٍ"
                          >
                            <PackageCheck size={14} />
                            <span>تحويل لتاجر</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* Modal تحويل الطلب لتاجر متعاقد */}
      {/* ==================================================================== */}
      {convertingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <PackageCheck size={20} className="text-brand-orange" />
                <h3 className="font-black text-base">
                  تحويل الطلب إلى تاجر متعاقد رسمي
                </h3>
              </div>
              <button
                onClick={() => setConvertingLead(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {convertSuccess ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle size={32} />
                </div>
                <h4 className="text-base font-bold text-slate-800">{convertSuccess}</h4>
                <p className="text-xs text-slate-400">
                  يمكنك الآن إضافة وتعيين شحنات جديدة لهذا التاجر مباشرة
                </p>
              </div>
            ) : (
              <form onSubmit={handleConfirmConvert} className="p-6 space-y-4">
                <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100 text-xs text-slate-700 space-y-1">
                  <p className="font-bold text-blue-900 text-sm mb-1">
                    بيانات التاجر المنقولة تلقائياً:
                  </p>
                  <p>البراند: <span className="font-bold">{convertingLead.brand_name}</span></p>
                  <p>المسؤول: <span className="font-bold">{convertingLead.contact_name}</span></p>
                  <p>الهاتف: <span className="font-bold" dir="ltr">{convertingLead.phone}</span></p>
                  <p>المحافظة: <span className="font-bold">{convertingLead.governorate}</span></p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    عنوان استلام الشحنات (Pickup Address) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    placeholder="العنوان التفصيلي لإرسال مندوب الاستلام..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    يمكنك تعديل هذا العنوان لاحقاً من صفحة التجار
                  </span>
                </div>

                <div className="pt-1">
                  <label className="flex items-center gap-3 cursor-pointer p-2.5 bg-amber-50/60 rounded-xl border border-amber-200/80">
                    <input
                      type="checkbox"
                      checked={isVipInitial}
                      onChange={(e) => setIsVipInitial(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-amber-300"
                    />
                    <div>
                      <span className="text-xs font-bold text-amber-900 block">
                        تمييز هذا التاجر كـ VIP فور التعاقد 👑
                      </span>
                      <span className="text-[11px] text-amber-700">
                        لتخصيص قائمة أسعار مخفضة فورية له
                      </span>
                    </div>
                  </label>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setConvertingLead(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={submittingConvert}
                    className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold bg-brand-orange hover:bg-orange-600 text-white transition-colors disabled:opacity-60 shadow-sm cursor-pointer"
                  >
                    {submittingConvert ? 'جاري التحويل...' : 'تأكيد إنشاء التاجر'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
