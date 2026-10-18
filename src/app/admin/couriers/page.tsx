'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  buildWhatsAppLink,
  buildTelLink,
  formatCurrency,
  formatArabicDate,
  formatArabicDateTime,
  getDateRange,
  isDateInRange,
  generateCourierSettlementCode,
  DateFilterType,
} from '@/modules/finance/calculator';
import type {
  Courier,
  CourierInsert,
  CourierUpdate,
  Zone,
  CourierSettlement,
  CourierSettlementType,
} from '@/types/database';
import dynamic from 'next/dynamic';
import { COURIER_SETTLEMENT_TYPE_LABELS } from '@/types/database';

// استيراد ديناميكي كسول لنافذة تفاصيل التسوية لتقليل First Load JS
const CourierSettlementDetailsModal = dynamic(
  () => import('@/components/admin/CourierSettlementDetailsModal'),
  { ssr: false },
);
import {
  Truck,
  Plus,
  Search,
  Phone,
  MessageCircle,
  Edit2,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertCircle,
  X,
  MapPin,
  CreditCard,
  Banknote,
  Package,
  Receipt,
  Calendar,
  CalendarRange,
  Eye,
  SlidersHorizontal,
  Printer,
  History,
} from 'lucide-react';

interface CourierWithStats extends Courier {
  default_zone?: { name: string; governorate: string } | null;
  activeShipmentsCount: number;
  unsettledCashAmount: number;
  pendingCommission: number;
  settledCommission: number;
  pendingCommissionShipmentsCount: number;
  pendingCommissionShipmentIds: string[];
}

export default function AdminCouriersPage() {
  const [activeTab, setActiveTab] = useState<'COURIERS_LIST' | 'SETTLEMENTS_LOG'>('COURIERS_LIST');

  const [couriers, setCouriers] = useState<CourierWithStats[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [courierSettlements, setCourierSettlements] = useState<
    (CourierSettlement & { couriers?: Courier | null })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // فلاتر سجل التسويات (التبويب الثاني)
  const [selectedCourierFilter, setSelectedCourierFilter] = useState<string>('ALL');
  const [settlementTypeFilter, setSettlementTypeFilter] = useState<string>('ALL');
  const [settlementDateFilter, setSettlementDateFilter] = useState<DateFilterType>('all');
  const [customSettlementStart, setCustomSettlementStart] = useState<string>('');
  const [customSettlementEnd, setCustomSettlementEnd] = useState<string>('');

  // نافذة عرض تفاصيل وإيصال التسوية
  const [viewingSettlement, setViewingSettlement] = useState<
    (CourierSettlement & { couriers?: Courier | null }) | null
  >(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourier, setEditingCourier] = useState<Courier | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // نافذة تأكيد محاسبة وتصفية عمولة المندوب
  const [settlingCourier, setSettlingCourier] = useState<CourierWithStats | null>(null);
  const [submittingSettlement, setSubmittingSettlement] = useState(false);
  const [rawShipments, setRawShipments] = useState<any[]>([]);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    phone: string;
    whatsapp: string;
    national_id: string;
    default_zone_id: string;
    is_active: boolean;
  }>({
    name: '',
    phone: '',
    whatsapp: '',
    national_id: '',
    default_zone_id: '',
    is_active: true,
  });

  const fetchCouriersAndZones = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();

      const [couriersRes, zonesRes, shipmentsRes, settlementsRes] = await Promise.all([
        supabase
          .from('couriers')
          .select(`
            *,
            default_zone:default_zone_id (name, governorate)
          `)
          .order('name', { ascending: true }),

        supabase
          .from('zones')
          .select('*')
          .order('governorate', { ascending: true })
          .order('name', { ascending: true }),

        // جلب الشحنات لحساب عهد المناديب والكاش المحصل والعمولات
        supabase
          .from('shipments')
          .select('id, courier_id, zone_id, status, collected_cash, courier_commission, is_courier_cash_settled, is_courier_commission_settled')
          .not('courier_id', 'is', null),

        // جلب سجل تسويات وتوريدات المناديب
        supabase
          .from('courier_settlements')
          .select(`
            *,
            couriers:courier_id (*)
          `)
          .order('settled_at', { ascending: false }),
      ]);

      if (couriersRes.error) console.error('Couriers error:', couriersRes.error);
      if (zonesRes.error) console.error('Zones error:', zonesRes.error);
      if (shipmentsRes.error) console.error('Shipments error:', shipmentsRes.error);
      if (settlementsRes.error) console.error('Courier settlements error:', settlementsRes.error);

      const allZones = zonesRes.data || [];
      setZones(allZones);

      const allShipments = shipmentsRes.data || [];
      setRawShipments(allShipments);

      setCourierSettlements(
        (settlementsRes.data as unknown as (CourierSettlement & { couriers?: Courier | null })[]) || [],
      );

      // دالة استخراج عمولة الشحنة مع القيمة الاحتياطية من المنطقة
      const getShipmentCommission = (s: any) => {
        const c = Number(s.courier_commission) || 0;
        if (c > 0) return c;
        const zone = allZones.find((z) => z.id === s.zone_id);
        return Number(zone?.courier_commission) || 0;
      };

      // حساب إحصائيات كل مندوب
      const mappedCouriers: CourierWithStats[] = (couriersRes.data || []).map((courier: any) => {
        const courierShipments = allShipments.filter((s) => s.courier_id === courier.id);

        // عدد الشحنات بعهدته حالياً (خرجت للتسليم أو مؤجلة أو طلب استلام)
        const activeCount = courierShipments.filter(
          (s) =>
            s.status === 'OUT_FOR_DELIVERY' ||
            s.status === 'POSTPONED' ||
            s.status === 'PICKUP_REQUESTED',
        ).length;

        // إجمالي الكاش المحصل بطرفه ولم يورد للخزنة
        const unsettledCash = courierShipments
          .filter((s) => !s.is_courier_cash_settled && (s.collected_cash || 0) > 0)
          .reduce((sum, s) => sum + (Number(s.collected_cash) || 0), 0);

        // العمولات المستحقة (غير مصروفة) vs العمولات المصروفة سابقاً للشحنات المنتهية
        const commissionEligibleStatuses = ['DELIVERED', 'PARTIAL_DELIVERED', 'EXCHANGED'];
        const pendingCommShipments = courierShipments.filter(
          (s) =>
            commissionEligibleStatuses.includes(s.status) &&
            !s.is_courier_commission_settled,
        );
        const settledCommShipments = courierShipments.filter(
          (s) =>
            commissionEligibleStatuses.includes(s.status) &&
            s.is_courier_commission_settled,
        );

        const pendingCommission = pendingCommShipments.reduce(
          (sum, s) => sum + getShipmentCommission(s),
          0,
        );
        const settledCommission = settledCommShipments.reduce(
          (sum, s) => sum + getShipmentCommission(s),
          0,
        );

        return {
          ...courier,
          activeShipmentsCount: activeCount,
          unsettledCashAmount: unsettledCash,
          pendingCommission,
          settledCommission,
          pendingCommissionShipmentsCount: pendingCommShipments.length,
          pendingCommissionShipmentIds: pendingCommShipments.map((s) => s.id),
        };
      });

      setCouriers(mappedCouriers);
    } catch (err) {
      console.error('Failed to load couriers data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCouriersAndZones();
  }, [fetchCouriersAndZones]);

  // فتح مودال إضافة مندوب
  const openAddModal = () => {
    setEditingCourier(null);
    setFormData({
      name: '',
      phone: '',
      whatsapp: '',
      national_id: '',
      default_zone_id: zones[0]?.id || '',
      is_active: true,
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  // فتح مودال تعديل مندوب
  const openEditModal = (courier: Courier) => {
    setEditingCourier(courier);
    setFormData({
      name: courier.name,
      phone: courier.phone,
      whatsapp: courier.whatsapp || '',
      national_id: courier.national_id || '',
      default_zone_id: courier.default_zone_id || '',
      is_active: courier.is_active,
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  // تبديل حالة نشاط المندوب
  const handleToggleActive = async (courier: Courier) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('couriers')
        .update({ is_active: !courier.is_active })
        .eq('id', courier.id);

      if (error) throw error;
      setCouriers((prev) =>
        prev.map((c) => (c.id === courier.id ? { ...c, is_active: !c.is_active } : c)),
      );
    } catch (err: unknown) {
      alert(`حدث خطأ أثناء تعديل حالة المندوب: ${(err as Error).message}`);
    }
  };

  // حفظ المندوب
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) {
      setErrorMessage('يرجى إدخال اسم المندوب ورقم الهاتف');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();

      if (editingCourier) {
        const payload: CourierUpdate = {
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          whatsapp: formData.whatsapp.trim() || null,
          national_id: formData.national_id.trim() || null,
          default_zone_id: formData.default_zone_id || null,
          is_active: formData.is_active,
        };

        const { error } = await supabase
          .from('couriers')
          .update(payload)
          .eq('id', editingCourier.id);

        if (error) throw error;
      } else {
        const payload: CourierInsert = {
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          whatsapp: formData.whatsapp.trim() || null,
          national_id: formData.national_id.trim() || null,
          default_zone_id: formData.default_zone_id || null,
          is_active: formData.is_active,
        };

        const { error } = await supabase.from('couriers').insert(payload);
        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchCouriersAndZones();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'حدث خطأ أثناء حفظ بيانات المندوب');
    } finally {
      setSubmitting(false);
    }
  };

  // محاسبة وتصفية عمولة المندوب بضغطة واحدة مع التوثيق في courier_settlements
  const handleConfirmSettleCourier = async () => {
    if (!settlingCourier || settlingCourier.pendingCommissionShipmentIds.length === 0) return;

    setSubmittingSettlement(true);
    try {
      const supabase = createClient();

      const targetShipments = rawShipments.filter((s) =>
        settlingCourier.pendingCommissionShipmentIds.includes(s.id),
      );

      let totalCommissionAmount = 0;
      let totalCashCollected = 0;

      const standardIds: string[] = [];
      const overrideShipments: { id: string; effComm: number }[] = [];

      for (const s of targetShipments) {
        const comm = Number(s.courier_commission) || 0;
        const zone = zones.find((z) => z.id === s.zone_id);
        const effComm = comm > 0 ? comm : Number(zone?.courier_commission) || 0;
        totalCommissionAmount += effComm;
        totalCashCollected += Number(s.collected_cash) || 0;

        if (comm === 0 && effComm > 0) {
          overrideShipments.push({ id: s.id, effComm });
        } else {
          standardIds.push(s.id);
        }
      }

      // 1. تحديث جماعي فوري دفعة واحدة للشحنات ذات العمولة المحددة مسبقاً (Batch Update)
      if (standardIds.length > 0) {
        const { error: batchErr } = await supabase
          .from('shipments')
          .update({ is_courier_commission_settled: true })
          .in('id', standardIds);

        if (batchErr) throw batchErr;
      }

      // 2. تحديث متوازٍ بالكامل عبر Promise.all للشحنات التي تحتاج تسجيل العمولة المستحقة
      if (overrideShipments.length > 0) {
        const updateResults = await Promise.all(
          overrideShipments.map((item) =>
            supabase
              .from('shipments')
              .update({
                is_courier_commission_settled: true,
                courier_commission: item.effComm,
              })
              .eq('id', item.id),
          ),
        );

        for (const res of updateResults) {
          if (res.error) throw res.error;
        }
      }

      // توثيق العملية كـ COMMISSION_PAYOUT في courier_settlements
      const settlementCode = generateCourierSettlementCode();
      const { error: settlementErr } = await supabase.from('courier_settlements').insert({
        settlement_code: settlementCode,
        courier_id: settlingCourier.id,
        settlement_type: 'COMMISSION_PAYOUT',
        shipments_count: settlingCourier.pendingCommissionShipmentIds.length,
        total_cash_collected: totalCashCollected,
        total_commission_amount: totalCommissionAmount,
        net_treasury_amount: totalCommissionAmount,
        shipment_ids: settlingCourier.pendingCommissionShipmentIds,
        notes: `صرف وتسوية عمولة (${settlingCourier.pendingCommissionShipmentIds.length}) شحنة للمندوب ${settlingCourier.name}`,
      });

      if (settlementErr) console.error('Error inserting settlement record:', settlementErr);

      setSettlingCourier(null);
      await fetchCouriersAndZones();
    } catch (err: unknown) {
      alert(`حدث خطأ أثناء محاسبة وتصفية العمولة: ${(err as Error).message}`);
    } finally {
      setSubmittingSettlement(false);
    }
  };

  // فلترة المناديب (التبويب الأول) - Memoized
  const filteredCouriers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return couriers.filter((c) => {
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.national_id && c.national_id.includes(q)) ||
        (c.default_zone && c.default_zone.name.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && c.is_active) ||
        (statusFilter === 'INACTIVE' && !c.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [couriers, searchQuery, statusFilter]);

  // احتساب مؤشرات المناديب بدقة وكفاءة (Memoized)
  const {
    totalCouriers,
    activeCouriers,
    totalActiveShipments,
    totalUnsettledCash,
    totalPendingCommissions,
    totalSettledCommissions,
  } = useMemo(() => {
    let active = 0;
    let activeShipments = 0;
    let unsettledCash = 0;
    let pendingComm = 0;
    let settledComm = 0;

    couriers.forEach((c) => {
      if (c.is_active) active++;
      activeShipments += c.activeShipmentsCount;
      unsettledCash += c.unsettledCashAmount;
      pendingComm += c.pendingCommission;
      settledComm += c.settledCommission;
    });

    return {
      totalCouriers: couriers.length,
      activeCouriers: active,
      totalActiveShipments: activeShipments,
      totalUnsettledCash: unsettledCash,
      totalPendingCommissions: pendingComm,
      totalSettledCommissions: settledComm,
    };
  }, [couriers]);

  // فلترة سجل التسويات (التبويب الثاني)
  const settlementDateRange = useMemo(
    () => getDateRange(settlementDateFilter, customSettlementStart, customSettlementEnd),
    [settlementDateFilter, customSettlementStart, customSettlementEnd],
  );

  const filteredSettlements = useMemo(() => {
    return courierSettlements.filter((cs) => {
      // فلتر المندوب
      if (selectedCourierFilter !== 'ALL' && cs.courier_id !== selectedCourierFilter) {
        return false;
      }
      // فلتر نوع العملية
      if (settlementTypeFilter !== 'ALL' && cs.settlement_type !== settlementTypeFilter) {
        return false;
      }
      // فلتر التاريخ
      if (!isDateInRange(cs.settled_at, settlementDateRange)) {
        return false;
      }
      return true;
    });
  }, [courierSettlements, selectedCourierFilter, settlementTypeFilter, settlementDateRange]);

  // إحصائيات السجل المفلتر
  const selectedCourierObj = useMemo(
    () => couriers.find((c) => c.id === selectedCourierFilter),
    [couriers, selectedCourierFilter],
  );

  const totalSettledCashHandedOver = useMemo(() => {
    return filteredSettlements
      .filter((s) => s.settlement_type === 'NET_HANDOVER' || s.settlement_type === 'CASH_HANDOVER')
      .reduce((sum, s) => sum + (Number(s.total_cash_collected) || 0), 0);
  }, [filteredSettlements]);

  const totalSettledCommissionsPaid = useMemo(() => {
    return filteredSettlements
      .filter((s) => s.settlement_type === 'NET_HANDOVER' || s.settlement_type === 'COMMISSION_PAYOUT')
      .reduce((sum, s) => sum + (Number(s.total_commission_amount) || 0), 0);
  }, [filteredSettlements]);

  const totalNetTreasuryHandedOver = useMemo(() => {
    return filteredSettlements
      .filter((s) => s.settlement_type === 'NET_HANDOVER' || s.settlement_type === 'CASH_HANDOVER')
      .reduce((sum, s) => sum + (Number(s.net_treasury_amount) || 0), 0);
  }, [filteredSettlements]);

  return (
    <div className="space-y-6">
      {/* ==================================================================== */}
      {/* ترويسة الصفحة */}
      {/* ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-brand-navy flex items-center gap-2.5">
            <Truck className="text-brand-orange" size={26} />
            إدارة مناديب الشحن والعهد والتسويات
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            متابعة خطوط سير المناديب، عدد الشحنات في عهدتهم، وسجل كافة التوريدات والتسويات المجمعة
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchCouriersAndZones}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-brand-orange' : ''} />
            <span>تحديث</span>
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>إضافة مندوب جديد</span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* شريط التبويبات الرئيسية (المناديب والعهد الحالية vs سجل تسويات وتوريدات المناديب) */}
      {/* ==================================================================== */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
        <button
          onClick={() => setActiveTab('COURIERS_LIST')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'COURIERS_LIST'
              ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Truck size={16} className={activeTab === 'COURIERS_LIST' ? 'text-blue-600' : 'text-slate-400'} />
          <span>قائمة المناديب والعهد الحالية</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeTab === 'COURIERS_LIST'
                ? 'bg-blue-100 text-blue-800 font-black'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            {totalCouriers}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('SETTLEMENTS_LOG')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'SETTLEMENTS_LOG'
              ? 'bg-white text-brand-orange shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Receipt size={16} className={activeTab === 'SETTLEMENTS_LOG' ? 'text-brand-orange' : 'text-slate-400'} />
          <span>سجل تسويات وتوريدات المناديب (الأرشيف المالي)</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeTab === 'SETTLEMENTS_LOG'
                ? 'bg-orange-100 text-brand-orange font-black'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            {courierSettlements.length}
          </span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* محتوى التبويب الأول: قائمة المناديب والعهد الحالية */}
      {/* ==================================================================== */}
      {activeTab === 'COURIERS_LIST' && (
        <div className="space-y-6">
          {/* بطاقات الإحصائيات السريعة */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-bold block mb-1">إجمالي المناديب</span>
              <span className="text-2xl font-black text-slate-800">{totalCouriers}</span>
              <span className="text-xs text-slate-400 mr-2">مندوب مسجل</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-xs text-emerald-700 font-bold block mb-1">المناديب النشطين</span>
              <span className="text-2xl font-black text-emerald-600">{activeCouriers}</span>
              <span className="text-xs text-slate-400 mr-2">على رأس العمل</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-xs text-indigo-700 font-bold block mb-1">شحنات جارية بعهدتهم</span>
              <span className="text-2xl font-black text-indigo-600">{totalActiveShipments}</span>
              <span className="text-xs text-slate-400 mr-2">طرد قيد التسليم</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20">
              <span className="text-xs text-amber-800 font-bold block mb-1">كاش محصل غير مورد</span>
              <span className="text-2xl font-black text-amber-700" dir="ltr">
                {formatCurrency(totalUnsettledCash)}
              </span>
              <span className="text-[11px] text-amber-600 block mt-0.5 font-medium">بعهدة المناديب</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-amber-300 bg-amber-50/30">
              <span className="text-xs text-amber-800 font-bold block mb-1">عمولة مستحقة (غير مصروفة)</span>
              <span className="text-2xl font-black text-amber-700" dir="ltr">
                {formatCurrency(totalPendingCommissions)}
              </span>
              <span className="text-[11px] text-amber-600 block mt-0.5 font-medium">مستحقة للمناديب</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 bg-slate-50/50">
              <span className="text-xs text-slate-500 font-bold block mb-1">عمولات تم صرفها سابقاً</span>
              <span className="text-2xl font-black text-slate-600" dir="ltr">
                {formatCurrency(totalSettledCommissions)}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5 font-medium">تمت تسويتها بالكامل</span>
            </div>
          </div>

          {/* شريط البحث والفلترة */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-brand-navy text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                كافة المناديب ({totalCouriers})
              </button>

              <button
                onClick={() => setStatusFilter('ACTIVE')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  statusFilter === 'ACTIVE'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                النشطين ({activeCouriers})
              </button>

              <button
                onClick={() => setStatusFilter('INACTIVE')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  statusFilter === 'INACTIVE'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                المتوقفين ({totalCouriers - activeCouriers})
              </button>
            </div>

            <div className="relative w-full md:w-80">
              <input
                type="text"
                placeholder="بحث بالاسم، الهاتف، أو المنطقة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-right"
              />
              <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            </div>
          </div>

          {/* جدول المناديب */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw size={26} className="animate-spin mx-auto mb-2 text-brand-orange" />
                <p className="text-sm">جاري تحميل المناديب والعهد...</p>
              </div>
            ) : filteredCouriers.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Truck size={36} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-bold">لا يوجد مناديب مطابقين لمعايير البحث</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-700 text-xs font-bold border-b border-slate-200">
                      <th className="py-3 px-4">اسم المندوب</th>
                      <th className="py-3 px-4">رقم الهاتف والتواصل</th>
                      <th className="py-3 px-4">المنطقة الافتراضية</th>
                      <th className="py-3 px-4">الرقم القومي</th>
                      <th className="py-3 px-4">شحنات بعهدته</th>
                      <th className="py-3 px-4">كاش محصل طرفه</th>
                      <th className="py-3 px-4">عمولة مستحقة (غير مصروفة)</th>
                      <th className="py-3 px-4">عمولات تم صرفها سابقاً</th>
                      <th className="py-3 px-4">الحالة</th>
                      <th className="py-3 px-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredCouriers.map((courier) => {
                      const waMsg = `أهلاً بك يا كابتن ${courier.name}، معك إدارة شركة أمانكو بلس للشحن والتوريد (AMANCO PLUS). نود الاستفسار عن خط السير والتحصيلات الحالية.`;

                      return (
                        <tr key={courier.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* اسم المندوب */}
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {courier.name}
                          </td>

                          {/* رقم الهاتف والتواصل */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <a
                                href={buildTelLink(courier.phone)}
                                className="font-mono text-xs text-blue-700 hover:underline flex items-center gap-1"
                                dir="ltr"
                                title="اتصال هاتفي"
                              >
                                <Phone size={12} />
                                <span>{courier.phone}</span>
                              </a>

                              <a
                                href={buildWhatsAppLink(courier.whatsapp || courier.phone, waMsg)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                                title="مراسلة واتساب فورية"
                              >
                                <MessageCircle size={14} />
                              </a>
                            </div>
                          </td>

                          {/* المنطقة الافتراضية */}
                          <td className="py-3.5 px-4 text-slate-700">
                            {courier.default_zone ? (
                              <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-xs">
                                <MapPin size={11} className="text-brand-orange" />
                                <span>{courier.default_zone.governorate} - {courier.default_zone.name}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400">عام (بدون تخصيص)</span>
                            )}
                          </td>

                          {/* الرقم القومي */}
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                            {courier.national_id ? (
                              <span dir="ltr">{courier.national_id}</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>

                          {/* شحنات بعهدته */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                courier.activeShipmentsCount > 0
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              <Package size={13} />
                              <span>{courier.activeShipmentsCount} شحنة</span>
                            </span>
                          </td>

                          {/* كاش محصل طرفه */}
                          <td className="py-3.5 px-4 font-bold text-amber-700" dir="ltr">
                            {formatCurrency(courier.unsettledCashAmount)}
                          </td>

                          {/* عمولة مستحقة له (غير مصروفة) */}
                          <td className="py-3.5 px-4">
                            <div
                              className={`font-black text-sm ${
                                courier.pendingCommission > 0 ? 'text-amber-700' : 'text-slate-400'
                              }`}
                              dir="ltr"
                            >
                              {formatCurrency(courier.pendingCommission)}
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">
                              {courier.pendingCommissionShipmentsCount > 0
                                ? `${courier.pendingCommissionShipmentsCount} شحنة مستحقة`
                                : 'تمت تصفية العمولات'}
                            </div>
                          </td>

                          {/* عمولات تم صرفها سابقاً - قابلة للنقر لعرض السجل المفلتر */}
                          <td className="py-3.5 px-4 font-semibold text-slate-500 text-xs" dir="ltr">
                            <button
                              onClick={() => {
                                setSelectedCourierFilter(courier.id);
                                setActiveTab('SETTLEMENTS_LOG');
                              }}
                              className="font-black text-slate-700 hover:text-blue-700 hover:underline cursor-pointer flex items-center gap-1"
                              title="اضغط لاستعراض سجل تسويات وعمولات هذا المندوب"
                            >
                              <span>{formatCurrency(courier.settledCommission)}</span>
                            </button>
                          </td>

                          {/* الحالة */}
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => handleToggleActive(courier)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                                courier.is_active
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                              }`}
                              title="اضغط لتغيير الحالة"
                            >
                              {courier.is_active ? 'نشط' : 'معطل'}
                            </button>
                          </td>

                          {/* الإجراءات */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {/* زر اختصار فتح سجل تسويات المندوب */}
                              <button
                                onClick={() => {
                                  setSelectedCourierFilter(courier.id);
                                  setActiveTab('SETTLEMENTS_LOG');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-colors cursor-pointer border border-blue-200 shadow-2xs whitespace-nowrap"
                                title="استعراض سجل تسويات وتوريدات هذا المندوب"
                              >
                                <Receipt size={13} />
                                <span>📜 سجل التسويات</span>
                              </button>

                              {/* زر اختصار محاسبة وتصفية العمولة */}
                              <button
                                onClick={() => setSettlingCourier(courier)}
                                disabled={courier.pendingCommission <= 0}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-700 font-bold text-xs transition-colors cursor-pointer border border-emerald-200 shadow-2xs whitespace-nowrap"
                                title={
                                  courier.pendingCommission > 0
                                    ? `محاسبة وتصفية عمولة (${formatCurrency(courier.pendingCommission)})`
                                    : 'لا توجد عمولات مستحقة حالياً'
                                }
                              >
                                <CheckCircle size={13} />
                                <span>محاسبة وتصفية</span>
                              </button>

                              {/* تعديل بيانات المندوب */}
                              <button
                                onClick={() => openEditModal(courier)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title="تعديل بيانات المندوب"
                              >
                                <Edit2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* محتوى التبويب الثاني: سجل تسويات وتوريدات المناديب (الأرشيف المالي) */}
      {/* ==================================================================== */}
      {activeTab === 'SETTLEMENTS_LOG' && (
        <div className="space-y-6">
          {/* شريط الإحصائيات المالية المفلترة للسجل */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/20">
              <span className="text-xs text-blue-800 font-bold block mb-1">
                إجمالي الكاش المورد (في العمليات المعروضة)
              </span>
              <span className="text-2xl font-black text-blue-900" dir="ltr">
                {formatCurrency(totalSettledCashHandedOver)}
              </span>
              <span className="text-[11px] text-blue-600 block mt-0.5">
                {selectedCourierObj ? `للمندوب: ${selectedCourierObj.name}` : 'لكافة المناديب المحددين'}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-purple-200 bg-purple-50/20">
              <span className="text-xs text-purple-800 font-bold block mb-1">
                إجمالي العمولات المصروفة
              </span>
              <span className="text-2xl font-black text-purple-900" dir="ltr">
                {formatCurrency(totalSettledCommissionsPaid)}
              </span>
              <span className="text-[11px] text-purple-600 block mt-0.5">
                تم صرفها للمناديب
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20">
              <span className="text-xs text-emerald-800 font-bold block mb-1">
                صافي التوريد المورد للخزنة
              </span>
              <span className="text-2xl font-black text-emerald-900" dir="ltr">
                {formatCurrency(totalNetTreasuryHandedOver)}
              </span>
              <span className="text-[11px] text-emerald-600 block mt-0.5">
                صافي السيولة الداخلة
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-600 font-bold block mb-1">
                عدد عمليات التسوية والتوريد
              </span>
              <span className="text-2xl font-black text-slate-800">
                {filteredSettlements.length}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                عملية مسجلة وموثقة
              </span>
            </div>
          </div>

          {/* شريط الفلاتر المتقدمة لسجل التسويات */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between pb-3 border-b border-slate-100">
              {/* فلتر المندوب */}
              <div className="w-full md:w-72">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  فلترة بمندوب محدد:
                </label>
                <select
                  value={selectedCourierFilter}
                  onChange={(e) => setSelectedCourierFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="ALL">كافة المناديب ({couriers.length})</option>
                  {couriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* فلتر نوع العملية */}
              <div className="w-full md:w-64">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  نوع العملية:
                </label>
                <select
                  value={settlementTypeFilter}
                  onChange={(e) => setSettlementTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="ALL">كافة العمليات</option>
                  <option value="NET_HANDOVER">توريد الصافي وتقفيل العمولة</option>
                  <option value="CASH_HANDOVER">توريد كامل الكاش فقط</option>
                  <option value="COMMISSION_PAYOUT">صرف وتسوية العمولات</option>
                </select>
              </div>

              {/* زر إعادة التعيين */}
              {(selectedCourierFilter !== 'ALL' || settlementTypeFilter !== 'ALL' || settlementDateFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSelectedCourierFilter('ALL');
                    setSettlementTypeFilter('ALL');
                    setSettlementDateFilter('all');
                    setCustomSettlementStart('');
                    setCustomSettlementEnd('');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold cursor-pointer transition-colors self-end"
                >
                  إعادة ضبط الفلاتر
                </button>
              )}
            </div>

            {/* شريط الفلترة الزمنية واليومية */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1 px-1">
                  <Calendar size={14} className="text-brand-orange" />
                  <span>فلترة التاريخ:</span>
                </span>

                <button
                  onClick={() => setSettlementDateFilter('today')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    settlementDateFilter === 'today'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  اليوم
                </button>

                <button
                  onClick={() => setSettlementDateFilter('yesterday')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    settlementDateFilter === 'yesterday'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  أمس
                </button>

                <button
                  onClick={() => setSettlementDateFilter('week')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    settlementDateFilter === 'week'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  هذا الأسبوع
                </button>

                <button
                  onClick={() => setSettlementDateFilter('month')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    settlementDateFilter === 'month'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  هذا الشهر
                </button>

                <button
                  onClick={() => setSettlementDateFilter('custom')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    settlementDateFilter === 'custom'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <CalendarRange size={13} />
                  <span>تاريخ مخصص</span>
                </button>

                <button
                  onClick={() => setSettlementDateFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    settlementDateFilter === 'all'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  كل الأوقات
                </button>
              </div>

              {settlementDateFilter !== 'all' && (
                <div className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-md border border-blue-200">
                  معروض عمليات:{' '}
                  {settlementDateFilter === 'today'
                    ? `اليوم (${formatArabicDate(new Date().toISOString())})`
                    : settlementDateFilter === 'yesterday'
                    ? 'أمس'
                    : settlementDateFilter === 'week'
                    ? 'هذا الأسبوع'
                    : settlementDateFilter === 'month'
                    ? 'هذا الشهر'
                    : 'فترة مخصصة'}
                </div>
              )}
            </div>

            {settlementDateFilter === 'custom' && (
              <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200 animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-600">من تاريخ:</label>
                  <input
                    type="date"
                    value={customSettlementStart}
                    onChange={(e) => setCustomSettlementStart(e.target.value)}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-mono font-bold text-slate-800"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-600">إلى تاريخ:</label>
                  <input
                    type="date"
                    value={customSettlementEnd}
                    onChange={(e) => setCustomSettlementEnd(e.target.value)}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-mono font-bold text-slate-800"
                  />
                </div>
              </div>
            )}
          </div>

          {/* جدول سجل تسويات وتوريدات المناديب */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw size={26} className="animate-spin mx-auto mb-2 text-brand-orange" />
                <p className="text-sm">جاري تحميل سجل التسويات...</p>
              </div>
            ) : filteredSettlements.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Receipt size={36} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-bold">لا توجد عمليات تسوية مسجلة مطابقة لهذه الفلاتر</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-700 text-xs font-bold border-b border-slate-200">
                      <th className="py-3 px-4">كود التسوية</th>
                      <th className="py-3 px-4">تاريخ ووقت العملية</th>
                      <th className="py-3 px-4">اسم المندوب</th>
                      <th className="py-3 px-4">نوع العملية</th>
                      <th className="py-3 px-4 text-center">عدد الشحنات</th>
                      <th className="py-3 px-4 text-left">الكاش المحصل</th>
                      <th className="py-3 px-4 text-left">إجمالي العمولة</th>
                      <th className="py-3 px-4 text-left">الصافي للخزنة / المنصرف</th>
                      <th className="py-3 px-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredSettlements.map((settlement) => {
                      const courier = settlement.couriers || couriers.find((c) => c.id === settlement.courier_id);

                      return (
                        <tr key={settlement.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* كود التسوية */}
                          <td className="py-3.5 px-4 font-mono font-bold text-blue-700" dir="ltr">
                            {settlement.settlement_code}
                          </td>

                          {/* تاريخ ووقت العملية */}
                          <td className="py-3.5 px-4 text-slate-600 font-medium">
                            {formatArabicDateTime(settlement.settled_at)}
                          </td>

                          {/* اسم المندوب */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">
                              {courier?.name || 'مندوب'}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono" dir="ltr">
                              {courier?.phone}
                            </div>
                          </td>

                          {/* نوع العملية */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                settlement.settlement_type === 'NET_HANDOVER'
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : settlement.settlement_type === 'CASH_HANDOVER'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}
                            >
                              {COURIER_SETTLEMENT_TYPE_LABELS[settlement.settlement_type] || settlement.settlement_type}
                            </span>
                          </td>

                          {/* عدد الشحنات */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                              <Package size={12} />
                              <span>{settlement.shipments_count}</span>
                            </span>
                          </td>

                          {/* الكاش المحصل */}
                          <td className="py-3.5 px-4 text-left font-mono font-bold text-slate-800" dir="ltr">
                            {formatCurrency(Number(settlement.total_cash_collected))}
                          </td>

                          {/* إجمالي العمولة */}
                          <td className="py-3.5 px-4 text-left font-mono font-bold text-purple-700" dir="ltr">
                            {formatCurrency(Number(settlement.total_commission_amount))}
                          </td>

                          {/* الصافي */}
                          <td
                            className={`py-3.5 px-4 text-left font-mono font-black ${
                              settlement.settlement_type === 'COMMISSION_PAYOUT'
                                ? 'text-emerald-700'
                                : 'text-slate-900'
                            }`}
                            dir="ltr"
                          >
                            {formatCurrency(Number(settlement.net_treasury_amount))}
                          </td>

                          {/* الإجراءات */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setViewingSettlement(settlement)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer whitespace-nowrap"
                              >
                                <Eye size={14} />
                                <span>عرض تفاصيل التسوية ({settlement.shipments_count} شحنة)</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* نافذة تفاصيل التسوية المجمعة للمندوب وطباعة الإيصال (A4) */}
      {/* ==================================================================== */}
      {viewingSettlement && (
        <CourierSettlementDetailsModal
          settlement={viewingSettlement}
          onClose={() => setViewingSettlement(null)}
        />
      )}

      {/* ==================================================================== */}
      {/* نافذة إضافة / تعديل مندوب */}
      {/* ==================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Truck size={18} className="text-brand-orange" />
                <span>{editingCourier ? 'تعديل بيانات المندوب' : 'إضافة مندوب جديد'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* اسم المندوب */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم المندوب بالكامل <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: أحمد عبد الله"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* الهاتف والواتساب */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    رقم هاتف الاتصال <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="01xxxxxxxxx"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    رقم الواتساب (اختياري)
                  </label>
                  <input
                    type="tel"
                    placeholder="01xxxxxxxxx"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-right"
                  />
                </div>
              </div>

              {/* الرقم القومي */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الرقم القومي (14 رقم)
                </label>
                <input
                  type="text"
                  maxLength={14}
                  placeholder="29xxxxxxxxx..."
                  value={formData.national_id}
                  onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-right"
                />
              </div>

              {/* المنطقة الأساسية */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  المنطقة الأساسية المخصصة (خط السير الافتراضي)
                </label>
                <select
                  value={formData.default_zone_id}
                  onChange={(e) => setFormData({ ...formData, default_zone_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">بدون منطقة محددة (عام لكافة المناطق)</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.governorate} - {zone.name} (عمولة: {zone.courier_commission} ج.م)
                    </option>
                  ))}
                </select>
              </div>

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
                    المندوب نشط ومتاح لإسناد الشحنات وخطوط السير
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60 shadow-sm cursor-pointer"
                >
                  {submitting ? 'جاري الحفظ...' : editingCourier ? 'حفظ التعديلات' : 'إضافة المندوب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* نافذة تأكيد محاسبة وتصفية عمولة المندوب بضغطة واحدة */}
      {/* ==================================================================== */}
      {settlingCourier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-700 text-white">
              <div>
                <h3 className="font-black text-base">محاسبة وتصفية عمولة المندوب</h3>
                <p className="text-xs text-emerald-100">كابتن: {settlingCourier.name}</p>
              </div>
              <button
                onClick={() => setSettlingCourier(null)}
                className="p-1 text-white/80 hover:text-white rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-center">
                <span className="text-xs text-emerald-800 font-bold block mb-1">
                  إجمالي العمولة المستحقة للصرف
                </span>
                <span className="text-3xl font-black text-emerald-700" dir="ltr">
                  {formatCurrency(settlingCourier.pendingCommission)}
                </span>
                <div className="text-xs text-emerald-800 mt-1 font-semibold">
                  مستحقة عن ({settlingCourier.pendingCommissionShipmentsCount}) شحنة منجزة
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs flex items-start gap-2.5">
                <AlertCircle size={18} className="shrink-0 text-amber-600 mt-0.5" />
                <div className="leading-relaxed">
                  هل تريد تأكيد تسليم وصرف هذه العمولات للمندوب الآن؟ سيتم تصفير المستحقات ونقلها وتوثيقها في سجل تسويات وتوريدات المناديب الرسمي.
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSettlingCourier(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmSettleCourier}
                disabled={submittingSettlement}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-50 shadow-sm cursor-pointer"
              >
                <CheckCircle size={15} />
                <span>
                  {submittingSettlement ? 'جاري التصفية والتسجيل...' : 'تأكيد الصرف وتوثيق التسوية'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
