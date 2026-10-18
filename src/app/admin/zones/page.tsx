'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/modules/finance/calculator';
import type { Zone, Governorate, ZoneInsert, ZoneUpdate } from '@/types/database';
import {
  MapPin,
  Plus,
  Search,
  Filter,
  Edit2,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertCircle,
  X,
  TrendingUp,
  Percent,
} from 'lucide-react';

const GOVERNORATES: Governorate[] = ['القاهرة', 'الجيزة', 'القليوبية'];

export default function AdminZonesPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGov, setSelectedGov] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Fields
  const [formData, setFormData] = useState<{
    governorate: Governorate;
    name: string;
    base_shipping_fee: number;
    courier_commission: number;
    is_active: boolean;
  }>({
    governorate: 'القاهرة',
    name: '',
    base_shipping_fee: 55,
    courier_commission: 20,
    is_active: true,
  });

  const fetchZones = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('zones')
        .select('*')
        .order('governorate', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching zones:', error);
      } else {
        setZones(data || []);
      }
    } catch (err) {
      console.error('Failed to load zones:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  const openAddModal = () => {
    setEditingZone(null);
    setFormData({
      governorate: 'القاهرة',
      name: '',
      base_shipping_fee: 55,
      courier_commission: 20,
      is_active: true,
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (zone: Zone) => {
    setEditingZone(zone);
    setFormData({
      governorate: zone.governorate,
      name: zone.name,
      base_shipping_fee: Number(zone.base_shipping_fee),
      courier_commission: Number(zone.courier_commission),
      is_active: zone.is_active,
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleToggleActive = async (zone: Zone) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('zones')
        .update({ is_active: !zone.is_active })
        .eq('id', zone.id);

      if (error) throw error;
      setZones((prev) =>
        prev.map((z) => (z.id === zone.id ? { ...z, is_active: !z.is_active } : z)),
      );
    } catch (err: unknown) {
      alert(`حدث خطأ أثناء تعديل حالة المنطقة: ${(err as Error).message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMessage('يرجى إدخال اسم المنطقة');
      return;
    }
    if (formData.base_shipping_fee <= 0) {
      setErrorMessage('سعر الشحن يجب أن يكون أكبر من صفر');
      return;
    }
    if (formData.courier_commission < 0) {
      setErrorMessage('عمولة المندوب لا يمكن أن تكون سالبة');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();

      if (editingZone) {
        // تحديث
        const updatePayload: ZoneUpdate = {
          governorate: formData.governorate,
          name: formData.name.trim(),
          base_shipping_fee: formData.base_shipping_fee,
          courier_commission: formData.courier_commission,
          is_active: formData.is_active,
        };

        const { error } = await supabase
          .from('zones')
          .update(updatePayload)
          .eq('id', editingZone.id);

        if (error) throw error;
      } else {
        // إضافة جديدة
        const insertPayload: ZoneInsert = {
          governorate: formData.governorate,
          name: formData.name.trim(),
          base_shipping_fee: formData.base_shipping_fee,
          courier_commission: formData.courier_commission,
          is_active: formData.is_active,
        };

        const { error } = await supabase.from('zones').insert(insertPayload);
        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchZones();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'حدث خطأ أثناء حفظ المنطقة');
    } finally {
      setSubmitting(false);
    }
  };

  // فلترة المناطق (Memoized)
  const filteredZones = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return zones.filter((zone) => {
      const matchesSearch =
        !q ||
        zone.name.toLowerCase().includes(q) ||
        zone.governorate.toLowerCase().includes(q);
      const matchesGov = selectedGov === 'ALL' || zone.governorate === selectedGov;
      return matchesSearch && matchesGov;
    });
  }, [zones, searchQuery, selectedGov]);

  // حساب الإحصائيات السريعة (Memoized)
  const { totalZones, activeZones, avgShipping, avgCommission } = useMemo(() => {
    const total = zones.length;
    let active = 0;
    let totalShipping = 0;
    let totalComm = 0;

    zones.forEach((z) => {
      if (z.is_active) active++;
      totalShipping += Number(z.base_shipping_fee) || 0;
      totalComm += Number(z.courier_commission) || 0;
    });

    return {
      totalZones: total,
      activeZones: active,
      avgShipping: total > 0 ? totalShipping / total : 0,
      avgCommission: total > 0 ? totalComm / total : 0,
    };
  }, [zones]);

  return (
    <div className="space-y-6">
      {/* ==================================================================== */}
      {/* ترويسة الصفحة */}
      {/* ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-brand-navy flex items-center gap-2.5">
            <MapPin className="text-brand-orange" size={26} />
            إدارة مناطق التغطية والتسعير
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            تحديد أسعار الشحن العامة وعمولات المناديب في القاهرة والجيزة والقليوبية
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
        >
          <Plus size={16} />
          <span>إضافة منطقة جديدة</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* بطاقات الإحصائيات السريعة */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-bold block mb-1">إجمالي المناطق</span>
          <span className="text-2xl font-black text-slate-800">{totalZones}</span>
          <span className="text-xs text-slate-400 mr-2">منطقة مسجلة</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-emerald-700 font-bold block mb-1">المناطق النشطة</span>
          <span className="text-2xl font-black text-emerald-600">{activeZones}</span>
          <span className="text-xs text-slate-400 mr-2">متاحة للشحن حالياً</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-blue-700 font-bold block mb-1">متوسط سعر الشحن</span>
          <span className="text-2xl font-black text-blue-600" dir="ltr">
            {formatCurrency(avgShipping)}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-amber-700 font-bold block mb-1">متوسط عمولة المندوب</span>
          <span className="text-2xl font-black text-amber-600" dir="ltr">
            {formatCurrency(avgCommission)}
          </span>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* أدوات البحث والفلترة */}
      {/* ==================================================================== */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* تبويبات المحافظات */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          <button
            onClick={() => setSelectedGov('ALL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              selectedGov === 'ALL'
                ? 'bg-brand-navy text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            كافة المحافظات ({zones.length})
          </button>
          {GOVERNORATES.map((gov) => {
            const count = zones.filter((z) => z.governorate === gov).length;
            return (
              <button
                key={gov}
                onClick={() => setSelectedGov(gov)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  selectedGov === gov
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {gov} ({count})
              </button>
            );
          })}
        </div>

        {/* حقل البحث بالاسم */}
        <div className="relative w-full md:w-72">
          <input
            type="text"
            placeholder="بحث عن اسم المنطقة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-right"
          />
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
        </div>
      </div>

      {/* ==================================================================== */}
      {/* جدول المناطق */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw size={26} className="animate-spin mx-auto mb-2 text-brand-orange" />
            <p className="text-sm">جاري تحميل المناطق والتسعير...</p>
          </div>
        ) : filteredZones.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <MapPin size={36} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold">لا توجد مناطق مطابقة للبحث</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">المحافظة</th>
                  <th className="py-3.5 px-4">اسم المنطقة</th>
                  <th className="py-3.5 px-4">سعر الشحن الأساسي</th>
                  <th className="py-3.5 px-4">عمولة المندوب</th>
                  <th className="py-3.5 px-4">هامش الشركة التقديري</th>
                  <th className="py-3.5 px-4">حالة التفعيل</th>
                  <th className="py-3.5 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredZones.map((zone) => {
                  const margin =
                    Number(zone.base_shipping_fee) - Number(zone.courier_commission);

                  return (
                    <tr
                      key={zone.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        !zone.is_active ? 'opacity-60 bg-slate-50/40' : ''
                      }`}
                    >
                      {/* المحافظة */}
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-md border ${
                            zone.governorate === 'القاهرة'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : zone.governorate === 'الجيزة'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-purple-50 text-purple-700 border-purple-200'
                          }`}
                        >
                          {zone.governorate}
                        </span>
                      </td>

                      {/* اسم المنطقة */}
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {zone.name}
                      </td>

                      {/* سعر الشحن */}
                      <td className="py-3 px-4 font-bold text-blue-700" dir="ltr">
                        {formatCurrency(Number(zone.base_shipping_fee))}
                      </td>

                      {/* عمولة المندوب */}
                      <td className="py-3 px-4 font-bold text-amber-700" dir="ltr">
                        {formatCurrency(Number(zone.courier_commission))}
                      </td>

                      {/* هامش الشركة */}
                      <td className="py-3 px-4 text-xs font-bold text-emerald-700" dir="ltr">
                        {formatCurrency(margin)}
                      </td>

                      {/* حالة التفعيل */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleActive(zone)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                            zone.is_active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          }`}
                          title="اضغط للتبديل"
                        >
                          {zone.is_active ? (
                            <>
                              <CheckCircle size={13} />
                              <span>مفعلة</span>
                            </>
                          ) : (
                            <>
                              <XCircle size={13} />
                              <span>معطلة</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* الإجراءات */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => openEditModal(zone)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="تعديل المنطقة"
                        >
                          <Edit2 size={16} />
                        </button>
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
      {/* نافذة منبثقة لإضافة أو تعديل المنطقة (Modal) */}
      {/* ==================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* عنوان المودال */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-black text-slate-900 text-base">
                {editingZone ? 'تعديل منطقة التغطية' : 'إضافة منطقة تغطية جديدة'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* محتوى النموذج */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* المحافظة */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  المحافظة <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.governorate}
                  onChange={(e) =>
                    setFormData({ ...formData, governorate: e.target.value as Governorate })
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

              {/* اسم المنطقة */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم المنطقة أو الأحياء <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="مثال: مدينة نصر ومصر الجديدة"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                />
              </div>

              {/* سعر الشحن العام وعمولة المندوب */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    سعر الشحن الأساسي (ج.م) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={formData.base_shipping_fee}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        base_shipping_fee: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">يُخصم من التاجر</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    عمولة المندوب (ج.م) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formData.courier_commission}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        courier_commission: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">تُصرف للمندوب</span>
                </div>
              </div>

              {/* حالة التفعيل */}
              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) =>
                      setFormData({ ...formData, is_active: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-700">
                    المنطقة مفعلة ومتاحة للشحن واستقبال الطلبات
                  </span>
                </label>
              </div>

              {/* أزرار الحفظ والإلغاء */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60 shadow-sm"
                >
                  {submitting ? 'جاري الحفظ...' : editingZone ? 'حفظ التعديلات' : 'إضافة المنطقة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
