'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  buildWhatsAppLink,
  buildTelLink,
  formatCurrency,
} from '@/modules/finance/calculator';
import type {
  Merchant,
  Governorate,
  MerchantInsert,
  MerchantUpdate,
  Zone,
  MerchantVipRate,
} from '@/types/database';
import {
  Users,
  Plus,
  Search,
  Crown,
  Phone,
  MessageCircle,
  Edit2,
  Settings2,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertCircle,
  X,
  MapPin,
  Sparkles,
  Save,
  Trash2,
} from 'lucide-react';

const GOVERNORATES: Governorate[] = ['القاهرة', 'الجيزة', 'القليوبية'];

export default function AdminMerchantsPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [vipFilter, setVipFilter] = useState<'ALL' | 'VIP' | 'REGULAR'>('ALL');

  // Modal تاجر (إضافة / تعديل)
  const [isMerchantModalOpen, setIsMerchantModalOpen] = useState(false);
  const [editingMerchant, setEditingMerchant] = useState<Merchant | null>(null);
  const [merchantSubmitting, setMerchantSubmitting] = useState(false);
  const [merchantError, setMerchantError] = useState<string | null>(null);

  // فورم التاجر
  const [merchantForm, setMerchantForm] = useState<{
    name: string;
    brand_name: string;
    phone: string;
    whatsapp: string;
    pickup_address: string;
    governorate: Governorate;
    is_vip: boolean;
    notes: string;
    is_active: boolean;
  }>({
    name: '',
    brand_name: '',
    phone: '',
    whatsapp: '',
    pickup_address: '',
    governorate: 'القاهرة',
    is_vip: false,
    notes: '',
    is_active: true,
  });

  // Modal أسعار VIP
  const [isVipModalOpen, setIsVipModalOpen] = useState(false);
  const [selectedMerchantForVip, setSelectedMerchantForVip] = useState<Merchant | null>(null);
  const [vipRates, setVipRates] = useState<Record<string, number>>({});
  const [loadingVipRates, setLoadingVipRates] = useState(false);
  const [savingVipRates, setSavingVipRates] = useState(false);
  const [vipSuccessMessage, setVipSuccessMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();

      const [merchantsRes, zonesRes] = await Promise.all([
        supabase
          .from('merchants')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('zones')
          .select('*')
          .order('governorate', { ascending: true })
          .order('name', { ascending: true }),
      ]);

      if (merchantsRes.error) console.error('Merchants error:', merchantsRes.error);
      else setMerchants(merchantsRes.data || []);

      if (zonesRes.error) console.error('Zones error:', zonesRes.error);
      else setZones(zonesRes.data || []);
    } catch (err) {
      console.error('Failed to load merchants data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // فتح مودال إضافة تاجر
  const openAddMerchantModal = () => {
    setEditingMerchant(null);
    setMerchantForm({
      name: '',
      brand_name: '',
      phone: '',
      whatsapp: '',
      pickup_address: '',
      governorate: 'القاهرة',
      is_vip: false,
      notes: '',
      is_active: true,
    });
    setMerchantError(null);
    setIsMerchantModalOpen(true);
  };

  // فتح مودال تعديل تاجر
  const openEditMerchantModal = (merchant: Merchant) => {
    setEditingMerchant(merchant);
    setMerchantForm({
      name: merchant.name,
      brand_name: merchant.brand_name,
      phone: merchant.phone,
      whatsapp: merchant.whatsapp || '',
      pickup_address: merchant.pickup_address,
      governorate: merchant.governorate,
      is_vip: merchant.is_vip,
      notes: merchant.notes || '',
      is_active: merchant.is_active,
    });
    setMerchantError(null);
    setIsMerchantModalOpen(true);
  };

  // حفظ التاجر (إضافة / تعديل)
  const handleMerchantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchantForm.name.trim() || !merchantForm.brand_name.trim() || !merchantForm.phone.trim()) {
      setMerchantError('يرجى ملء الاسم واسم البراند ورقم الهاتف');
      return;
    }
    if (!merchantForm.pickup_address.trim()) {
      setMerchantError('يرجى إدخال عنوان استلام الشحنات (Pickup Address)');
      return;
    }

    setMerchantSubmitting(true);
    setMerchantError(null);

    try {
      const supabase = createClient();

      if (editingMerchant) {
        const payload: MerchantUpdate = {
          name: merchantForm.name.trim(),
          brand_name: merchantForm.brand_name.trim(),
          phone: merchantForm.phone.trim(),
          whatsapp: merchantForm.whatsapp.trim() || null,
          pickup_address: merchantForm.pickup_address.trim(),
          governorate: merchantForm.governorate,
          is_vip: merchantForm.is_vip,
          notes: merchantForm.notes.trim() || null,
          is_active: merchantForm.is_active,
        };

        const { error } = await supabase
          .from('merchants')
          .update(payload)
          .eq('id', editingMerchant.id);

        if (error) throw error;
      } else {
        const payload: MerchantInsert = {
          name: merchantForm.name.trim(),
          brand_name: merchantForm.brand_name.trim(),
          phone: merchantForm.phone.trim(),
          whatsapp: merchantForm.whatsapp.trim() || null,
          pickup_address: merchantForm.pickup_address.trim(),
          governorate: merchantForm.governorate,
          is_vip: merchantForm.is_vip,
          notes: merchantForm.notes.trim() || null,
          is_active: merchantForm.is_active,
        };

        const { error } = await supabase.from('merchants').insert(payload);
        if (error) throw error;
      }

      setIsMerchantModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      setMerchantError((err as Error).message || 'حدث خطأ أثناء حفظ التاجر');
    } finally {
      setMerchantSubmitting(false);
    }
  };

  // فتح نافذة أسعار VIP لتاجر محدد
  const openVipRatesModal = async (merchant: Merchant) => {
    setSelectedMerchantForVip(merchant);
    setLoadingVipRates(true);
    setVipRates({});
    setVipSuccessMessage(null);
    setIsVipModalOpen(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('merchant_vip_rates')
        .select('*')
        .eq('merchant_id', merchant.id);

      if (error) throw error;

      const rateMap: Record<string, number> = {};
      (data || []).forEach((r: MerchantVipRate) => {
        rateMap[r.zone_id] = Number(r.custom_shipping_fee);
      });
      setVipRates(rateMap);
    } catch (err) {
      console.error('Failed to load VIP rates:', err);
    } finally {
      setLoadingVipRates(false);
    }
  };

  // حفظ أسعار VIP
  const handleSaveVipRates = async () => {
    if (!selectedMerchantForVip) return;
    setSavingVipRates(true);
    setVipSuccessMessage(null);

    try {
      const supabase = createClient();
      const merchantId = selectedMerchantForVip.id;

      // 1. حذف الأسعار القديمة لهذا التاجر
      const { error: deleteErr } = await supabase
        .from('merchant_vip_rates')
        .delete()
        .eq('merchant_id', merchantId);

      if (deleteErr) throw deleteErr;

      // 2. إدخال الأسعار المخصصة المحددة فقط
      const rowsToInsert = Object.entries(vipRates)
        .filter(([_, fee]) => fee !== undefined && fee !== null && !isNaN(fee) && fee > 0)
        .map(([zoneId, fee]) => ({
          merchant_id: merchantId,
          zone_id: zoneId,
          custom_shipping_fee: fee,
        }));

      if (rowsToInsert.length > 0) {
        const { error: insertErr } = await supabase
          .from('merchant_vip_rates')
          .insert(rowsToInsert);

        if (insertErr) throw insertErr;
      }

      // إذا لم يكن معلماً كـ VIP وتمت إضافة أسعار خاصة، نقوم بترقيته لـ VIP تلقائياً
      if (!selectedMerchantForVip.is_vip && rowsToInsert.length > 0) {
        await supabase
          .from('merchants')
          .update({ is_vip: true })
          .eq('id', merchantId);

        setMerchants((prev) =>
          prev.map((m) => (m.id === merchantId ? { ...m, is_vip: true } : m)),
        );
      }

      setVipSuccessMessage(`تم حفظ أسعار الـ VIP بنجاح (${rowsToInsert.length} منطقة مخصصة)`);
      setTimeout(() => {
        setIsVipModalOpen(false);
      }, 1200);
    } catch (err: unknown) {
      alert(`حدث خطأ أثناء حفظ أسعار VIP: ${(err as Error).message}`);
    } finally {
      setSavingVipRates(false);
    }
  };

  // تبديل حالة نشاط التاجر
  const handleToggleMerchantActive = async (merchant: Merchant) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('merchants')
        .update({ is_active: !merchant.is_active })
        .eq('id', merchant.id);

      if (error) throw error;
      setMerchants((prev) =>
        prev.map((m) => (m.id === merchant.id ? { ...m, is_active: !m.is_active } : m)),
      );
    } catch (err: unknown) {
      alert(`حدث خطأ: ${(err as Error).message}`);
    }
  };

  // حذف تاجر (فقط إذا لم يكن مرتبطاً بشحنات)
  const handleDeleteMerchant = async (merchant: Merchant) => {
    const confirmed = window.confirm(
      `هل أنت متأكد من حذف التاجر "${merchant.brand_name}"? لا يمكن التراجع عن هذا الإجراء.`,
    );
    if (!confirmed) return;

    try {
      const supabase = createClient();

      // التحقق من عدم وجود شحنات مرتبطة بهذا التاجر
      const { data: linkedShipments, error: checkErr } = await supabase
        .from('shipments')
        .select('id')
        .eq('merchant_id', merchant.id)
        .limit(1);

      if (checkErr) throw checkErr;

      if (linkedShipments && linkedShipments.length > 0) {
        alert(
          `لا يمكن حذف التاجر "${merchant.brand_name}" لأنه مرتبط بشحنات مسجلة. يمكنك تعطيل حسابه بدلاً من ذلك.`,
        );
        return;
      }

      // حذف أسعار VIP المرتبطة أولاً
      await supabase
        .from('merchant_vip_rates')
        .delete()
        .eq('merchant_id', merchant.id);

      // حذف التاجر
      const { error: deleteErr } = await supabase
        .from('merchants')
        .delete()
        .eq('id', merchant.id);

      if (deleteErr) throw deleteErr;

      setMerchants((prev) => prev.filter((m) => m.id !== merchant.id));
    } catch (err: unknown) {
      alert(`حدث خطأ أثناء حذف التاجر: ${(err as Error).message}`);
    }
  };

  // فلترة التجار (Memoized)
  const filteredMerchants = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return merchants.filter((m) => {
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.brand_name.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        (m.pickup_address && m.pickup_address.toLowerCase().includes(q));

      const matchesVip =
        vipFilter === 'ALL' ||
        (vipFilter === 'VIP' && m.is_vip) ||
        (vipFilter === 'REGULAR' && !m.is_vip);

      return matchesSearch && matchesVip;
    });
  }, [merchants, searchQuery, vipFilter]);

  const { totalMerchants, vipCount } = useMemo(() => {
    return {
      totalMerchants: merchants.length,
      vipCount: merchants.filter((m) => m.is_vip).length,
    };
  }, [merchants]);

  return (
    <div className="space-y-6">
      {/* ==================================================================== */}
      {/* ترويسة الصفحة */}
      {/* ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-brand-navy flex items-center gap-2.5">
            <Users className="text-brand-orange" size={26} />
            إدارة التجار وقوائم أسعار VIP
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            إدارة بيانات التجار المتعاقدين، عناوين الاستلام، وتخصيص أسعار شحن مميزة
          </p>
        </div>

        <button
          onClick={openAddMerchantModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
        >
          <Plus size={16} />
          <span>إضافة تاجر متعاقد جديد</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* أدوات البحث والفلترة */}
      {/* ==================================================================== */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* تبويبات الفلترة */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setVipFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              vipFilter === 'ALL'
                ? 'bg-brand-navy text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            كافة التجار ({totalMerchants})
          </button>

          <button
            onClick={() => setVipFilter('VIP')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
              vipFilter === 'VIP'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <Crown size={14} className="text-amber-300" />
            <span>تجار VIP المميزين ({vipCount})</span>
          </button>

          <button
            onClick={() => setVipFilter('REGULAR')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              vipFilter === 'REGULAR'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            تجار التسعير العام ({totalMerchants - vipCount})
          </button>
        </div>

        {/* حقل البحث */}
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
      {/* جدول التجار */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw size={26} className="animate-spin mx-auto mb-2 text-brand-orange" />
            <p className="text-sm">جاري تحميل قائمة التجار...</p>
          </div>
        ) : filteredMerchants.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users size={36} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold">لا يوجد تجار مطابقين للبحث</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">البراند والتاجر</th>
                  <th className="py-3.5 px-4">التصنيف</th>
                  <th className="py-3.5 px-4">التواصل السريع</th>
                  <th className="py-3.5 px-4">عنوان الاستلام (Pickup)</th>
                  <th className="py-3.5 px-4">الحالة</th>
                  <th className="py-3.5 px-4 text-center">الإجراءات والـ VIP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMerchants.map((merchant) => (
                  <tr
                    key={merchant.id}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      !merchant.is_active ? 'opacity-60 bg-slate-50/40' : ''
                    }`}
                  >
                    {/* البراند والتاجر */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-base">
                        {merchant.brand_name}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span>المسؤول: {merchant.name}</span>
                        <span>•</span>
                        <span className="text-blue-600">{merchant.governorate}</span>
                      </div>
                    </td>

                    {/* تصنيف VIP */}
                    <td className="py-3.5 px-4">
                      {merchant.is_vip ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-300 shadow-xs">
                          <Crown size={13} className="text-amber-500 fill-amber-500" />
                          <span>تاجر VIP</span>
                        </span>
                      ) : (
                        <span className="inline-block text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          تسعير عام
                        </span>
                      )}
                    </td>

                    {/* التواصل السريع */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        {/* اتصال مباشر */}
                        <a
                          href={buildTelLink(merchant.phone)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors"
                          title="اتصال هاتفي"
                        >
                          <Phone size={13} />
                          <span dir="ltr">{merchant.phone}</span>
                        </a>

                        {/* واتساب مباشر */}
                        <a
                          href={buildWhatsAppLink(
                            merchant.whatsapp || merchant.phone,
                            `أهلاً بحضرتك أ/ ${merchant.name}، شركة أمانكو بلس للشحن والتوريد (AMANCO PLUS) ترحب بك...`,
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                          title="مراسلة واتساب فورية"
                        >
                          <MessageCircle size={15} />
                        </a>
                      </div>
                    </td>

                    {/* عنوان الاستلام */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="flex items-start gap-1.5 text-xs text-slate-600 line-clamp-2">
                        <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                        <span>{merchant.pickup_address}</span>
                      </div>
                    </td>

                    {/* حالة الحساب */}
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleToggleMerchantActive(merchant)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                          merchant.is_active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        }`}
                        title="اضغط لتغيير الحالة"
                      >
                        {merchant.is_active ? 'نشط' : 'معطل'}
                      </button>
                    </td>

                    {/* الإجراءات وأسعار VIP */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* زر تخصيص أسعار VIP */}
                        <button
                          onClick={() => openVipRatesModal(merchant)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            merchant.is_vip
                              ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                          title="تخصيص أسعار شحن VIP"
                        >
                          <Crown size={14} className="text-amber-600" />
                          <span>أسعار VIP</span>
                        </button>

                        {/* زر تعديل بيانات التاجر */}
                        <button
                          onClick={() => openEditMerchantModal(merchant)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="تعديل بيانات التاجر"
                        >
                          <Edit2 size={16} />
                        </button>

                        {/* زر حذف التاجر */}
                        <button
                          onClick={() => handleDeleteMerchant(merchant)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="حذف التاجر (إذا لم يكن مرتبطاً بشحنات)"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* Modal إضافة أو تعديل تاجر */}
      {/* ==================================================================== */}
      {isMerchantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-black text-slate-900 text-base">
                {editingMerchant ? 'تعديل بيانات التاجر' : 'إضافة تاجر متعاقد جديد'}
              </h3>
              <button
                onClick={() => setIsMerchantModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleMerchantSubmit} className="p-6 space-y-4">
              {merchantError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{merchantError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    اسم التاجر / المسؤول <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: أحمد محمود"
                    value={merchantForm.name}
                    onChange={(e) => setMerchantForm({ ...merchantForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    اسم البراند / النشاط <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: براند الأناقة ستور"
                    value={merchantForm.brand_name}
                    onChange={(e) =>
                      setMerchantForm({ ...merchantForm, brand_name: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    رقم الهاتف الأساسي <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="01xxxxxxxxx"
                    dir="ltr"
                    value={merchantForm.phone}
                    onChange={(e) => setMerchantForm({ ...merchantForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-right"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    رقم الواتساب (اختياري)
                  </label>
                  <input
                    type="tel"
                    placeholder="01xxxxxxxxx"
                    dir="ltr"
                    value={merchantForm.whatsapp}
                    onChange={(e) => setMerchantForm({ ...merchantForm, whatsapp: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-right"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  المحافظة الرئيسية <span className="text-red-500">*</span>
                </label>
                <select
                  value={merchantForm.governorate}
                  onChange={(e) =>
                    setMerchantForm({ ...merchantForm, governorate: e.target.value as Governorate })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  {GOVERNORATES.map((gov) => (
                    <option key={gov} value={gov}>
                      {gov}
                    </option>
                  ))}
                </select>
              </div>

              {/* عنوان الاستلام Pickup Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  عنوان استلام الشحنات (Pickup Address) <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="العنوان التفصيلي لإرسال مندوب الاستلام (الشارع، رقم العمارة، علامة مميزة)..."
                  value={merchantForm.pickup_address}
                  onChange={(e) =>
                    setMerchantForm({ ...merchantForm, pickup_address: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                />
              </div>

              {/* ملاحظات */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ملاحظات أو شروط خاصة
                </label>
                <input
                  type="text"
                  placeholder="أي ملاحظات تشغيلية..."
                  value={merchantForm.notes}
                  onChange={(e) => setMerchantForm({ ...merchantForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* خيارات VIP والنشاط */}
              <div className="pt-2 space-y-2">
                <label className="flex items-center gap-3 cursor-pointer p-2.5 bg-amber-50/60 rounded-xl border border-amber-200/80">
                  <input
                    type="checkbox"
                    checked={merchantForm.is_vip}
                    onChange={(e) =>
                      setMerchantForm({ ...merchantForm, is_vip: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-amber-300"
                  />
                  <div>
                    <span className="text-xs font-bold text-amber-900 block">
                      تمييز هذا التاجر كـ VIP 👑
                    </span>
                    <span className="text-[11px] text-amber-700">
                      يمنح التاجر أولوية تشغيل وإمكانية وضع أسعار شحن خاصة بمناطق محددة
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer px-2 pt-1">
                  <input
                    type="checkbox"
                    checked={merchantForm.is_active}
                    onChange={(e) =>
                      setMerchantForm({ ...merchantForm, is_active: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    حساب التاجر نشط ويستقبل شحنات
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMerchantModalOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={merchantSubmitting}
                  className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60 shadow-sm cursor-pointer"
                >
                  {merchantSubmitting ? 'جاري الحفظ...' : editingMerchant ? 'حفظ التعديلات' : 'إضافة التاجر'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* Modal تخصيص أسعار الـ VIP للمناطق (merchant_vip_rates) */}
      {/* ==================================================================== */}
      {isVipModalOpen && selectedMerchantForVip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* رأس المودال */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-500 text-white">
              <div className="flex items-center gap-2.5">
                <Crown size={22} className="text-amber-200 fill-amber-200" />
                <div>
                  <h3 className="font-black text-base">
                    تخصيص أسعار VIP: {selectedMerchantForVip.brand_name}
                  </h3>
                  <p className="text-xs text-amber-100 mt-0.5">
                    الأسعار المدخلة هنا تتجاوز السعر الأساسي للمنطقة تلقائياً لهذا التاجر
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsVipModalOpen(false)}
                className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* إشعار النجاح */}
            {vipSuccessMessage && (
              <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-600" />
                <span>{vipSuccessMessage}</span>
              </div>
            )}

            {/* محتوى أسعار المناطق */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {loadingVipRates ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw size={26} className="animate-spin mx-auto mb-2 text-amber-500" />
                  <p className="text-xs">جاري تحميل الأسعار المخصصة الحالية...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {GOVERNORATES.map((gov) => {
                    const govZones = zones.filter((z) => z.governorate === gov);
                    if (govZones.length === 0) return null;

                    return (
                      <div key={gov} className="space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                          <span className="text-xs font-black text-slate-700">{gov}</span>
                          <span className="text-[11px] text-slate-400">
                            {govZones.length} منطقة
                          </span>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                          {govZones.map((zone) => {
                            const customVal = vipRates[zone.id];
                            const hasCustom =
                              customVal !== undefined &&
                              customVal !== null &&
                              customVal > 0;

                            return (
                              <div
                                key={zone.id}
                                className={`p-3 rounded-xl border transition-all ${
                                  hasCustom
                                    ? 'bg-amber-50/70 border-amber-300'
                                    : 'bg-slate-50 border-slate-200'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-bold text-slate-800">
                                    {zone.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    الأساسي: {zone.base_shipping_fee} ج.م
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <div className="relative flex-1">
                                    <input
                                      type="number"
                                      step="0.5"
                                      placeholder={String(zone.base_shipping_fee)}
                                      value={customVal ?? ''}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setVipRates((prev) => ({
                                          ...prev,
                                          [zone.id]: val === '' ? (undefined as unknown as number) : parseFloat(val),
                                        }));
                                      }}
                                      className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 ${
                                        hasCustom
                                          ? 'border-amber-400 bg-white text-amber-900'
                                          : 'border-slate-300 bg-white text-slate-700'
                                      }`}
                                    />
                                    <span className="absolute left-2.5 top-1.5 text-[10px] text-slate-400">
                                      ج.م
                                    </span>
                                  </div>

                                  {hasCustom && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setVipRates((prev) => {
                                          const copy = { ...prev };
                                          delete copy[zone.id];
                                          return copy;
                                        });
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                                      title="إلغاء التخصيص والرجوع للسعر الأساسي"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* أسفل مودال VIP */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                المناطق الفارغة ستستخدم السعر الأساسي العام تلقائياً
              </span>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsVipModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors cursor-pointer"
                >
                  إغلاق
                </button>
                <button
                  type="button"
                  onClick={handleSaveVipRates}
                  disabled={savingVipRates}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors disabled:opacity-60 shadow-sm cursor-pointer"
                >
                  <Save size={15} />
                  <span>{savingVipRates ? 'جاري الحفظ...' : 'حفظ أسعار VIP'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
