'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  buildWhatsAppLink,
  buildTelLink,
  formatCurrency,
  calculateShipmentFinancials,
  DateFilterType,
  DateRange,
  getDateRange,
  isDateInRange,
  isDateBeforeToday,
  formatArabicDate,
} from '@/modules/finance/calculator';
import {
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_TYPE_LABELS,
  Shipment,
  ShipmentStatus,
  ShipmentType,
  Merchant,
  Zone,
  Courier,
} from '@/types/database';
import ShipmentFormModal from '@/components/admin/ShipmentFormModal';
import BulkUploadModal from '@/components/admin/BulkUploadModal';
import UpdateStatusModal from '@/components/admin/UpdateStatusModal';
import PrintShipmentsModal from '@/components/admin/PrintShipmentsModal';
import { WaybillShipmentData } from '@/components/admin/A4Waybill';
import {
  Package,
  Plus,
  FileSpreadsheet,
  Printer,
  Search,
  Filter,
  Phone,
  MessageCircle,
  Edit2,
  RefreshCw,
  CheckCircle2,
  Truck,
  RotateCcw,
  CheckSquare,
  Square,
  ChevronDown,
  Warehouse,
  Clock,
  Send,
  UserCheck,
  Eye,
  Lock,
  AlertCircle,
  AlertTriangle,
  Calendar,
  CalendarRange,
} from 'lucide-react';

interface ExtendedShipment extends Shipment {
  merchants?: { name: string; brand_name: string; phone?: string } | null;
  zones?: { name: string; governorate: string; courier_commission?: number } | null;
  couriers?: { name: string; phone?: string } | null;
}

export type ShipmentTab = 'ACTIVE' | 'PENDING_SETTLEMENT' | 'SETTLED' | 'ALL';

export default function AdminShipmentsPage() {
  const [shipments, setShipments] = useState<ExtendedShipment[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);

  // تبويب عرض الشحنات
  const [activeTab, setActiveTab] = useState<ShipmentTab>('ACTIVE');

  // فلترة التاريخ وجرد اليومية للشحنات
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // أدوات البحث والفلترة
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterMerchant, setFilterMerchant] = useState<string>('ALL');
  const [filterCourier, setFilterCourier] = useState<string>('ALL');
  const [filterZone, setFilterZone] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterOverdueOnly, setFilterOverdueOnly] = useState(false);

  // التحديد المتعدد (Multi-select)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // حالة الإجراء المجمع
  const [bulkCourierId, setBulkCourierId] = useState<string>('');
  const [bulkStatus, setBulkStatus] = useState<ShipmentStatus>('OUT_FOR_DELIVERY');
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);

  // النوافذ المنبثقة (Modals)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [shipmentToEdit, setShipmentToEdit] = useState<Shipment | null>(null);

  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusShipment, setStatusShipment] = useState<Shipment | null>(null);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [shipmentsToPrint, setShipmentsToPrint] = useState<WaybillShipmentData[]>([]);

  // جلب البيانات من Supabase
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();

      const [shipmentsRes, merchantsRes, zonesRes, couriersRes] = await Promise.all([
        supabase
          .from('shipments')
          .select(`
            *,
            merchants:merchant_id (name, brand_name, phone),
            zones:zone_id (name, governorate, courier_commission),
            couriers:courier_id (name, phone)
          `)
          .order('created_at', { ascending: false }),

        supabase
          .from('merchants')
          .select('*')
          .order('brand_name', { ascending: true }),

        supabase
          .from('zones')
          .select('*')
          .order('governorate', { ascending: true })
          .order('name', { ascending: true }),

        supabase
          .from('couriers')
          .select('*')
          .order('name', { ascending: true }),
      ]);

      if (shipmentsRes.error) console.error('Shipments error:', shipmentsRes.error);
      if (merchantsRes.error) console.error('Merchants error:', merchantsRes.error);
      if (zonesRes.error) console.error('Zones error:', zonesRes.error);
      if (couriersRes.error) console.error('Couriers error:', couriersRes.error);

      setShipments((shipmentsRes.data as unknown as ExtendedShipment[]) || []);
      setMerchants(merchantsRes.data || []);
      setZones(zonesRes.data || []);
      setCouriers(couriersRes.data || []);
    } catch (err) {
      console.error('Failed to load shipments:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // إدارة التحديد
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredShipments.length && filteredShipments.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredShipments.map((s) => s.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  };

  // فتح الطباعة للشحنات المحددة
  const handlePrintSelected = () => {
    const toPrint = shipments
      .filter((s) => selectedIds.has(s.id))
      .map((s) => ({
        id: s.id,
        awb_number: s.awb_number,
        recipient_name: s.recipient_name,
        recipient_phone: s.recipient_phone,
        recipient_phone_alt: s.recipient_phone_alt,
        recipient_address: s.recipient_address,
        package_description: s.package_description,
        pieces_count: s.pieces_count,
        shipment_type: s.shipment_type,
        allow_open_package: s.allow_open_package,
        exchange_instructions: s.exchange_instructions,
        expected_cod: Number(s.expected_cod),
        created_at: s.created_at,
        delivery_notes: s.delivery_notes,
        merchants: s.merchants,
        zones: s.zones,
      }));

    if (toPrint.length === 0) {
      alert('يرجى تحديد شحنة واحدة على الأقل للطباعة');
      return;
    }

    setShipmentsToPrint(toPrint);
    setIsPrintModalOpen(true);
  };

  // فتح الطباعة لشحنة فردية
  const handlePrintSingle = (shipment: ExtendedShipment) => {
    const single: WaybillShipmentData = {
      id: shipment.id,
      awb_number: shipment.awb_number,
      recipient_name: shipment.recipient_name,
      recipient_phone: shipment.recipient_phone,
      recipient_phone_alt: shipment.recipient_phone_alt,
      recipient_address: shipment.recipient_address,
      package_description: shipment.package_description,
      pieces_count: shipment.pieces_count,
      shipment_type: shipment.shipment_type,
      allow_open_package: shipment.allow_open_package,
      exchange_instructions: shipment.exchange_instructions,
      expected_cod: Number(shipment.expected_cod),
      created_at: shipment.created_at,
      delivery_notes: shipment.delivery_notes,
      merchants: shipment.merchants,
      zones: shipment.zones,
    };
    setShipmentsToPrint([single]);
    setIsPrintModalOpen(true);
  };

  // تنفيذ الإسناد وتغيير الحالة المجمع
  const handleApplyBulkAssignment = async () => {
    const rawTargetIds = Array.from(selectedIds);
    if (rawTargetIds.length === 0) return;

    // استبعاد الشحنات المسواة مالياً لحماية النزاهة المحاسبية
    const selectedShipments = shipments.filter((s) => selectedIds.has(s.id));
    const lockedCount = selectedShipments.filter((s) => Boolean(s.settlement_id)).length;
    const targetShipments = selectedShipments.filter((s) => !s.settlement_id);
    const targetIds = targetShipments.map((s) => s.id);

    if (lockedCount > 0) {
      alert(
        `تنبيه محاسبي: تم استبعاد ${lockedCount} شحنة مسواة مالياً (🔒) لأنها مدرجة في كشوف تسويات معتمدة. سيتم تطبيق الإجراء فقط على ${targetIds.length} شحنة غير مسواة.`
      );
    }

    if (targetIds.length === 0) {
      alert('جميع الشحنات المحددة مسواة مالياً ومغلقة، ولا يمكن تعديل حالتها أو إسنادها.');
      return;
    }

    if (bulkStatus === 'OUT_FOR_DELIVERY' && !bulkCourierId) {
      alert('يرجى اختيار المندوب لإسناد الشحنات إليه عند تغيير الحالة لـ "خرجت للتسليم"');
      return;
    }

    setIsApplyingBulk(true);
    try {
      const supabase = createClient();

      const updateData: Partial<Shipment> = {
        status: bulkStatus,
        updated_at: new Date().toISOString(),
      };
      if (bulkCourierId) {
        updateData.courier_id = bulkCourierId;
      }

      // 1. تحديث الشحنات
      const { error: updateErr } = await supabase
        .from('shipments')
        .update(updateData)
        .in('id', targetIds);

      if (updateErr) throw updateErr;

      // 2. تسجيل أحداث تتبع لكل شحنة
      const selectedCourierName = couriers.find((c) => c.id === bulkCourierId)?.name;
      const eventTitle =
        bulkStatus === 'OUT_FOR_DELIVERY'
          ? `خرجت للتسليم مع المندوب (${selectedCourierName || 'مندوب التوزيع'})`
          : bulkStatus === 'AT_HUB'
            ? 'تم استلام الشحنة في المخزن الرئيسي (Hub)'
            : `تغيير الحالة المجمع إلى ${SHIPMENT_STATUS_LABELS[bulkStatus]}`;

      const eventsToInsert = targetIds.map((shipmentId) => ({
        shipment_id: shipmentId,
        status: bulkStatus,
        title: eventTitle,
        notes: 'إجراء تشغيلي مجمع من لوحة الإدارة',
      }));

      await supabase.from('shipment_events').insert(eventsToInsert);

      setSelectedIds(new Set());
      fetchData();
    } catch (err: unknown) {
      alert(`حدث خطأ أثناء تنفيذ الإجراء المجمع: ${(err as Error).message}`);
    } finally {
      setIsApplyingBulk(false);
    }
  };

  // الحالات المنتهية (المكتملة تشغيلياً)
  const TERMINAL_STATUSES: ShipmentStatus[] = [
    'DELIVERED',
    'PARTIAL_DELIVERED',
    'EXCHANGED',
    'RETURNED',
  ];

  // دوال التحقق من الحسابات والعهد المفتوحة والمتأخرات من أيام سابقة
  const isShipmentUnclosed = (s: Shipment) => {
    // شحنة جارية غير منتهية تشغيلياً
    if (!TERMINAL_STATUSES.includes(s.status)) return true;
    // كاش محصل لم يورد للخزنة بعد
    if (!s.is_courier_cash_settled && (Number(s.collected_cash) || 0) > 0) return true;
    // مستحقات تاجر لم تسوّ بعد
    if (s.settlement_id === null) return true;
    return false;
  };

  const isShipmentOverdue = (s: Shipment) => {
    return isShipmentUnclosed(s) && isDateBeforeToday(s.created_at || s.updated_at);
  };

  // احتساب النطاق الزمني المحدد
  const dateRange = getDateRange(dateFilter, customStartDate, customEndDate);

  // شحنات الفترة المحددة + الحسابات المفتوحة التي لم تُقفل من أيام سابقة
  const dateFilteredShipments = shipments.filter((s) => {
    // عند اختيار كل الأوقات تظهر جميع الشحنات
    if (dateFilter === 'all') return true;

    // إن كانت ضمن نطاق التاريخ المحدد
    const inRange = isDateInRange(s.created_at, dateRange) || isDateInRange(s.updated_at, dateRange);
    if (inRange) return true;

    // قاعدة الحسابات المفتوحة: تظل ظاهرة دائماً ولا تختفي عند اختيار "حركة اليوم" إذا لم تُقفل
    return isShipmentUnclosed(s);
  });

  const totalOverdueCount = shipments.filter(isShipmentOverdue).length;

  // أعداد التبويبات بحسب الفترة المحددة
  const activeCount = dateFilteredShipments.filter(
    (s) => !TERMINAL_STATUSES.includes(s.status),
  ).length;
  const pendingSettlementCount = dateFilteredShipments.filter(
    (s) => TERMINAL_STATUSES.includes(s.status) && s.settlement_id === null,
  ).length;
  const settledCount = dateFilteredShipments.filter((s) => s.settlement_id !== null).length;
  const totalCount = dateFilteredShipments.length;

  // فلترة الشحنات المعروضة
  const filteredShipments = dateFilteredShipments.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    const brandName = (s.merchants?.brand_name || '').toLowerCase();
    const recipientName = (s.recipient_name || '').toLowerCase();
    const awb = (s.awb_number || '').toLowerCase();
    const phone = s.recipient_phone || '';

    const matchesSearch =
      !q ||
      awb.includes(q) ||
      recipientName.includes(q) ||
      phone.includes(q) ||
      brandName.includes(q);

    // فلترة التبويب المحدد
    const matchesTab = (() => {
      if (activeTab === 'ACTIVE') return !TERMINAL_STATUSES.includes(s.status);
      if (activeTab === 'PENDING_SETTLEMENT')
        return TERMINAL_STATUSES.includes(s.status) && s.settlement_id === null;
      if (activeTab === 'SETTLED') return s.settlement_id !== null;
      return true;
    })();

    const matchesStatus = filterStatus === 'ALL' || s.status === filterStatus;
    const matchesMerchant = filterMerchant === 'ALL' || s.merchant_id === filterMerchant;
    const matchesCourier = filterCourier === 'ALL' || s.courier_id === filterCourier;
    const matchesZone = filterZone === 'ALL' || s.zone_id === filterZone;
    const matchesType = filterType === 'ALL' || s.shipment_type === filterType;
    const matchesOverdue = !filterOverdueOnly || isShipmentOverdue(s);

    return (
      matchesSearch &&
      matchesTab &&
      matchesStatus &&
      matchesMerchant &&
      matchesCourier &&
      matchesZone &&
      matchesType &&
      matchesOverdue
    );
  });

  // حساب ملخص الأرقام المعروضة الدقيقة (حسب الحالة والتسوية)
  const totalDisplayShipping = filteredShipments.reduce(
    (sum, s) => sum + (Number(s.shipping_fee) || 0),
    0,
  );

  let pendingVaultCash = 0; // كاش بيد المناديب لم يورد بعد للخزنة
  let settledVaultCash = 0; // كاش تم توريده فعلياً للخزنة
  let unsettledMerchantNet = 0; // مستحقات التجار للشحنات غير المسواة (settlement_id === null)
  let settledMerchantNet = 0; // مستحقات الشحنات المسواة سابقاً (settlement_id !== null)

  filteredShipments.forEach((s) => {
    const fin = calculateShipmentFinancials({
      shipmentType: s.shipment_type,
      status: s.status,
      expectedCod: Number(s.expected_cod) || 0,
      shippingFee: Number(s.shipping_fee) || 0,
      zoneCourierCommission: Number(s.zones?.courier_commission) || 0,
      courierCommissionOverride: Number(s.courier_commission) || undefined,
      returnFeeBearer: s.return_fee_bearer || 'NONE',
      partialCollectedCash: Number(s.collected_cash) || 0,
    });

    const net = Number(s.merchant_net_amount) !== 0 ? Number(s.merchant_net_amount) : fin.merchantNetAmount;
    const cash = Number(s.collected_cash) > 0 ? Number(s.collected_cash) : fin.collectedCash;

    if (s.is_courier_cash_settled) {
      settledVaultCash += cash;
    } else {
      pendingVaultCash += cash;
    }

    const isTerminal = TERMINAL_STATUSES.includes(s.status);
    if (isTerminal) {
      if (s.settlement_id) {
        settledMerchantNet += net;
      } else {
        unsettledMerchantNet += net;
      }
    }
  });

  const getStatusBadge = (status: ShipmentStatus) => {
    switch (status) {
      case 'PICKUP_REQUESTED':
        return 'bg-amber-50 text-amber-700 border-amber-300';
      case 'AT_HUB':
        return 'bg-blue-50 text-blue-700 border-blue-300';
      case 'OUT_FOR_DELIVERY':
        return 'bg-indigo-50 text-indigo-700 border-indigo-300';
      case 'DELIVERED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-300';
      case 'PARTIAL_DELIVERED':
        return 'bg-teal-50 text-teal-700 border-teal-300';
      case 'EXCHANGED':
        return 'bg-purple-50 text-purple-700 border-purple-300';
      case 'POSTPONED':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'RETURNED':
        return 'bg-rose-50 text-rose-700 border-rose-300';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* ==================================================================== */}
      {/* ترويسة الصفحة والأزرار الرئيسية */}
      {/* ==================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-brand-navy flex items-center gap-2.5">
            <Package className="text-brand-orange" size={26} />
            منظومة الشحنات والبوالص المركزية
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            تسجيل ومتابعة الشحنات، رفع شيتات إكسيل، إسناد المناديب، وطباعة بوالص A4
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-brand-orange' : ''} />
            <span>تحديث</span>
          </button>

          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <FileSpreadsheet size={16} />
            <span>رفع شيت Excel مجمع</span>
          </button>

          <button
            onClick={() => {
              setShipmentToEdit(null);
              setIsFormModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>تسجيل شحنة فردية</span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* شريط الإحصائيات السريعة الدقيقة للشحنات المعروضة */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* بطاقة 1: الشحنات المعروضة */}
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-bold block mb-1">الشحنات المعروضة</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-800">
              {filteredShipments.length}
            </span>
            <span className="text-xs text-slate-400">من إجمالي {shipments.length}</span>
          </div>
          <div className="text-[11px] text-purple-700 font-bold mt-1.5 flex items-center gap-1">
            <Lock size={12} className="text-purple-600" />
            <span>منها {filteredShipments.filter((s) => s.settlement_id).length} شحنة مسواة 🔒</span>
          </div>
        </div>

        {/* بطاقة 2: عهدة التحصيل الحالية مفصلة */}
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-blue-700 font-bold block mb-1">عهدة التحصيل (بانتظار التوريد)</span>
          <span className="text-2xl font-black text-blue-700 block" dir="ltr">
            {formatCurrency(pendingVaultCash)}
          </span>
          <span className="text-[11px] text-emerald-700 font-bold block mt-1.5" dir="ltr">
            تم توريده للخزنة: {formatCurrency(settledVaultCash)}
          </span>
        </div>

        {/* بطاقة 3: إجمالي مصاريف الشحن */}
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-amber-700 font-bold block mb-1">إجمالي مصاريف الشحن</span>
          <span className="text-2xl font-black text-amber-700 block" dir="ltr">
            {formatCurrency(totalDisplayShipping)}
          </span>
          <span className="text-[11px] text-slate-400 font-semibold block mt-1.5">
            لـ {filteredShipments.length} شحنة معروضة
          </span>
        </div>

        {/* بطاقة 4: مستحقات التجار غير المسواة */}
        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20">
          <span className="text-xs text-emerald-800 font-bold block mb-1">مستحقات التجار غير المسواة</span>
          <span className="text-2xl font-black text-emerald-700 block" dir="ltr">
            {formatCurrency(unsettledMerchantNet)}
          </span>
          <span className="text-[11px] text-purple-700 font-bold block mt-1.5" dir="ltr">
            المسواة سابقاً: {formatCurrency(settledMerchantNet)}
          </span>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* شريط تبويبات تقسيم الشحنات (قيد التشغيل / بانتظار التسوية / مسواة / الكل) */}
      {/* ==================================================================== */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
        <button
          onClick={() => setActiveTab('ACTIVE')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'ACTIVE'
              ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Clock size={16} className={activeTab === 'ACTIVE' ? 'text-blue-600' : 'text-slate-400'} />
          <span>شحنات جارية / قيد التشغيل</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeTab === 'ACTIVE'
                ? 'bg-blue-100 text-blue-800 font-black'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            {activeCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('PENDING_SETTLEMENT')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'PENDING_SETTLEMENT'
              ? 'bg-white text-amber-700 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <AlertCircle
            size={16}
            className={activeTab === 'PENDING_SETTLEMENT' ? 'text-amber-600' : 'text-slate-400'}
          />
          <span>شحنات منتهية بانتظار تسوية التاجر</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeTab === 'PENDING_SETTLEMENT'
                ? 'bg-amber-100 text-amber-800 font-black'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            {pendingSettlementCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('SETTLED')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'SETTLED'
              ? 'bg-white text-purple-700 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Lock size={16} className={activeTab === 'SETTLED' ? 'text-purple-600' : 'text-slate-400'} />
          <span>أرشيف الشحنات المسواة مالياً 🔒</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeTab === 'SETTLED'
                ? 'bg-purple-100 text-purple-800 font-black'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            {settledCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('ALL')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'ALL'
              ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Package size={16} className={activeTab === 'ALL' ? 'text-slate-700' : 'text-slate-400'} />
          <span>كل الشحنات (السجل الكامل)</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeTab === 'ALL'
                ? 'bg-slate-200 text-slate-800 font-black'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            {totalCount}
          </span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* شريط البحث المتقدم والفلاتر المتعددة */}
      {/* ==================================================================== */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* حقل البحث الرئيسي */}
        <div className="relative">
          <input
            type="text"
            placeholder="بحث برقم البوليصة (AWB)، اسم المستلم، هاتف المستلم، أو اسم البراند..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 text-right"
          />
          <Search size={18} className="absolute left-3.5 top-3 text-slate-400" />
        </div>

        {/* شريط الفلترة بالتواريخ وجرد اليومية */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1 px-1">
              <Calendar size={14} className="text-brand-orange" />
              <span>فلترة التاريخ:</span>
            </span>

            <button
              onClick={() => setDateFilter('today')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                dateFilter === 'today'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              اليوم
            </button>

            <button
              onClick={() => setDateFilter('yesterday')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                dateFilter === 'yesterday'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              أمس
            </button>

            <button
              onClick={() => setDateFilter('week')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                dateFilter === 'week'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              هذا الأسبوع
            </button>

            <button
              onClick={() => setDateFilter('month')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                dateFilter === 'month'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              هذا الشهر
            </button>

            <button
              onClick={() => setDateFilter('custom')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                dateFilter === 'custom'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <CalendarRange size={13} />
              <span>تاريخ مخصص</span>
            </button>

            <button
              onClick={() => setDateFilter('all')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                dateFilter === 'all'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              كل الأوقات
            </button>

            {/* زر فلترة المتأخرات غير المقفلة */}
            <button
              onClick={() => setFilterOverdueOnly((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterOverdueOnly
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
              title="تصفية الشحنات والعهد المتأخرة غير المقفلة من أيام سابقة"
            >
              <AlertTriangle size={13} className={filterOverdueOnly ? 'text-white' : 'text-amber-600'} />
              <span>⚠️ متأخرات لم تُقفل</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  filterOverdueOnly ? 'bg-amber-800 text-white' : 'bg-amber-200 text-amber-900 font-black'
                }`}
              >
                {totalOverdueCount}
              </span>
            </button>
          </div>

          {dateFilter !== 'all' && (
            <div className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-md border border-blue-200">
              معروض شحنات:{' '}
              {dateFilter === 'today'
                ? `اليوم (${formatArabicDate(new Date().toISOString())})`
                : dateFilter === 'yesterday'
                ? 'أمس'
                : dateFilter === 'week'
                ? 'هذا الأسبوع'
                : dateFilter === 'month'
                ? 'هذا الشهر'
                : 'فترة مخصصة'}
            </div>
          )}
        </div>

        {dateFilter === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">من تاريخ:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-mono font-bold text-slate-800"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">إلى تاريخ:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-mono font-bold text-slate-800"
              />
            </div>
            {(customStartDate || customEndDate) && (
              <button
                onClick={() => {
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="text-xs text-rose-600 hover:underline font-bold px-2 py-0.5 cursor-pointer"
              >
                مسح
              </button>
            )}
          </div>
        )}

        {/* فلاتر منسدلة */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
          {/* فلتر الحالة */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-slate-50 text-slate-700"
          >
            <option value="ALL">كافة الحالات</option>
            {Object.entries(SHIPMENT_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          {/* فلتر التاجر */}
          <select
            value={filterMerchant}
            onChange={(e) => setFilterMerchant(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-slate-50 text-slate-700"
          >
            <option value="ALL">كافة التجار</option>
            {merchants.map((m) => (
              <option key={m.id} value={m.id}>
                {m.brand_name}
              </option>
            ))}
          </select>

          {/* فلتر المندوب */}
          <select
            value={filterCourier}
            onChange={(e) => setFilterCourier(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-slate-50 text-slate-700"
          >
            <option value="ALL">كافة المناديب</option>
            {couriers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* فلتر المنطقة */}
          <select
            value={filterZone}
            onChange={(e) => setFilterZone(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-slate-50 text-slate-700"
          >
            <option value="ALL">كافة المناطق</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.governorate} - {z.name}
              </option>
            ))}
          </select>

          {/* فلتر نوع الشحنة */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-slate-50 text-slate-700"
          >
            <option value="ALL">كافة أنواع الشحنات</option>
            {Object.entries(SHIPMENT_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* شريط الإجراءات المجمعة العائم عند تحديد صفوف (Batch Actions Bar) */}
      {/* ==================================================================== */}
      {selectedIds.size > 0 && (
        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <span className="bg-brand-orange text-white text-xs font-black px-3 py-1 rounded-full">
              {selectedIds.size} شحنة محددة
            </span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-slate-400 hover:text-white underline"
            >
              إلغاء التحديد
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* اختيار المندوب للإسناد */}
            <select
              value={bulkCourierId}
              onChange={(e) => setBulkCourierId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-xs text-white"
            >
              <option value="">اختر المندوب للإسناد...</option>
              {couriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone})
                </option>
              ))}
            </select>

            {/* اختيار الحالة المجمعة */}
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as ShipmentStatus)}
              className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-xs text-white"
            >
              <option value="OUT_FOR_DELIVERY">خرجت للتسليم</option>
              <option value="AT_HUB">بالمخزن الرئيسي (Hub)</option>
              <option value="POSTPONED">مؤجلة</option>
            </select>

            {/* زر تطبيق الإسناد المجمع */}
            <button
              onClick={handleApplyBulkAssignment}
              disabled={isApplyingBulk}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              <UserCheck size={15} />
              <span>{isApplyingBulk ? 'جاري التطبيق...' : 'إسناد وتغيير الحالة'}</span>
            </button>

            {/* زر طباعة البوالص المحددة */}
            <button
              onClick={handlePrintSelected}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-orange hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <Printer size={15} />
              <span>طباعة بوالص A4 ({selectedIds.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* جدول الشحنات المركزي */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400">
            <RefreshCw size={28} className="animate-spin mx-auto mb-3 text-brand-orange" />
            <p className="text-sm font-semibold">جاري تحميل الشحنات وقواعد البيانات...</p>
          </div>
        ) : filteredShipments.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <Package size={40} className="mx-auto mb-3 text-slate-300" />
            <h3 className="text-base font-bold text-slate-700 mb-1">لا توجد شحنات مطابقة</h3>
            <p className="text-xs text-slate-400">جرب تغيير معايير البحث أو الفلترة أعلاه</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-center w-10">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="p-1 text-slate-500 hover:text-blue-600 cursor-pointer"
                      title="تحديد الكل"
                    >
                      {selectedIds.size === filteredShipments.length && filteredShipments.length > 0 ? (
                        <CheckSquare size={16} className="text-blue-600" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </th>
                  <th className="py-3.5 px-3">رقم البوليصة (AWB)</th>
                  <th className="py-3.5 px-3">التاجر / البراند</th>
                  <th className="py-3.5 px-3">المستلم والتواصل</th>
                  <th className="py-3.5 px-3">المنطقة والعنوان</th>
                  <th className="py-3.5 px-3">نوع الشحنة</th>
                  <th className="py-3.5 px-3">المبلغ المطلوب (COD)</th>
                  <th className="py-3.5 px-3">الحالة التشغيلية</th>
                  <th className="py-3.5 px-3">المندوب</th>
                  <th className="py-3.5 px-3 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredShipments.map((shipment) => {
                  const isSelected = selectedIds.has(shipment.id);

                  // رسالة الواتساب الجاهزة للعميل
                  const waMsg = `مرحباً أ/ ${shipment.recipient_name}، شحنتك رقم (${shipment.awb_number}) من براند (${
                    shipment.merchants?.brand_name || 'أمانكو بلس'
                  }) قادمة إليك عبر شركة أمانكو بلس للشحن والتوريد (AMANCO PLUS). المبلغ المطلوب تحصيله: ${
                    shipment.shipment_type === 'PREPAID' ? '0 ج.م (مدفوعة مسبقاً)' : `${shipment.expected_cod} ج.م`
                  }. يمكنك تتبع خط سير الشحنة عبر موقعنا برقم البوليصة.`;

                  return (
                    <tr
                      key={shipment.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSelectRow(shipment.id)}
                          className="p-1 text-slate-500 hover:text-blue-600 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare size={16} className="text-blue-600" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </td>

                      {/* رقم البوليصة وتاريخ الإنشاء */}
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-blue-700" dir="ltr">
                          {shipment.awb_number}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                          {formatArabicDate(shipment.created_at)}
                        </div>
                      </td>

                      {/* التاجر */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800">
                          {shipment.merchants?.brand_name || 'تاجر عام'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {shipment.merchants?.name}
                        </div>
                      </td>

                      {/* المستلم والتواصل المباشر */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">
                          {shipment.recipient_name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {/* اتصال سريع */}
                          <a
                            href={buildTelLink(shipment.recipient_phone)}
                            className="text-[11px] font-mono text-blue-700 hover:underline flex items-center gap-0.5"
                            dir="ltr"
                            title="اتصال هاتفي"
                          >
                            <Phone size={11} />
                            <span>{shipment.recipient_phone}</span>
                          </a>

                          {/* واتساب مباشر */}
                          <a
                            href={buildWhatsAppLink(shipment.recipient_phone, waMsg)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                            title="مراسلة واتساب فورية"
                          >
                            <MessageCircle size={13} />
                          </a>
                        </div>
                      </td>

                      {/* المنطقة والعنوان */}
                      <td className="py-3 px-3 max-w-xs">
                        <div className="font-bold text-slate-800">
                          {shipment.zones ? `${shipment.zones.governorate} - ${shipment.zones.name}` : '-'}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate" title={shipment.recipient_address}>
                          {shipment.recipient_address}
                        </div>
                      </td>

                      {/* نوع الشحنة */}
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded text-xs whitespace-nowrap inline-flex items-center">
                          {SHIPMENT_TYPE_LABELS[shipment.shipment_type]}
                        </span>
                        {shipment.allow_open_package ? (
                          <span className="whitespace-nowrap inline-flex items-center text-[10px] text-emerald-700 font-bold mt-1">
                            ✓ فحص ومعاينة
                          </span>
                        ) : (
                          <span className="whitespace-nowrap inline-flex items-center text-[10px] text-red-600 font-bold mt-1">
                            ✕ ممنوع الفتح
                          </span>
                        )}
                      </td>

                      {/* المبلغ COD */}
                      <td className="py-3 px-3 font-bold text-slate-900" dir="ltr">
                        {shipment.shipment_type === 'PREPAID'
                          ? '0.00 ج.م'
                          : formatCurrency(Number(shipment.expected_cod))}
                      </td>

                      {/* الحالة التشغيلية والأقفال المالية */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1 items-start">
                          <button
                            onClick={() => {
                              setStatusShipment(shipment);
                              setIsStatusModalOpen(true);
                            }}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer hover:shadow-xs ${getStatusBadge(
                              shipment.status,
                            )}`}
                            title="اضغط لتحديث الحالة ومسار الشحنة"
                          >
                            <span>{SHIPMENT_STATUS_LABELS[shipment.status]}</span>
                            <ChevronDown size={12} />
                          </button>

                          {shipment.settlement_id && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-100 text-purple-900 border border-purple-300">
                              <Lock size={10} className="text-purple-700" />
                              <span>🔒 تمت التسوية للتاجر</span>
                            </span>
                          )}

                          {shipment.is_courier_cash_settled && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 size={10} className="text-emerald-600" />
                              <span>💵 موردة للخزنة</span>
                            </span>
                          )}

                          {isShipmentOverdue(shipment) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                              <AlertTriangle size={10} className="text-amber-700" />
                              <span>⚠️ متأخرات من أيام سابقة ({formatArabicDate(shipment.updated_at || shipment.created_at)})</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* المندوب */}
                      <td className="py-3 px-3 text-slate-600">
                        {shipment.couriers?.name || (
                          <span className="text-slate-400">غير مسندة</span>
                        )}
                      </td>

                      {/* الإجراءات */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* طباعة البوليصة فردية */}
                          <button
                            onClick={() => handlePrintSingle(shipment)}
                            className="p-1.5 text-slate-500 hover:text-brand-orange hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
                            title="طباعة بوليصة A4"
                          >
                            <Printer size={15} />
                          </button>

                          {/* تعديل بيانات الشحنة أو إغلاقها مالياً */}
                          {shipment.settlement_id ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-50 text-purple-700 text-[10px] font-bold border border-purple-200 cursor-not-allowed"
                              title="هذه الشحنة تمت تسويتها مالياً مع التاجر ومغلقة لحماية الحسابات"
                            >
                              <Lock size={11} className="text-purple-600" />
                              <span>مغلقة 🔒</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                setShipmentToEdit(shipment);
                                setIsFormModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="تعديل الشحنة"
                            >
                              <Edit2 size={15} />
                            </button>
                          )}
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

      {/* ==================================================================== */}
      {/* النوافذ المنبثقة (Modals) */}
      {/* ==================================================================== */}

      {/* مودال تسجيل / تعديل شحنة فردية */}
      {isFormModalOpen && (
        <ShipmentFormModal
          shipmentToEdit={shipmentToEdit}
          merchants={merchants}
          zones={zones}
          couriers={couriers}
          onClose={() => setIsFormModalOpen(false)}
          onSuccess={() => {
            setIsFormModalOpen(false);
            fetchData();
          }}
        />
      )}

      {/* مودال رفع ملف إكسيل مجمع */}
      {isBulkModalOpen && (
        <BulkUploadModal
          merchants={merchants}
          zones={zones}
          onClose={() => setIsBulkModalOpen(false)}
          onSuccess={() => {
            setIsBulkModalOpen(false);
            fetchData();
          }}
        />
      )}

      {/* مودال تحديث الحالة الذكي والماليات */}
      {isStatusModalOpen && statusShipment && (
        <UpdateStatusModal
          shipment={statusShipment}
          couriers={couriers}
          onClose={() => setIsStatusModalOpen(false)}
          onSuccess={() => {
            setIsStatusModalOpen(false);
            fetchData();
          }}
        />
      )}

      {/* مودال طباعة بوالص الشحن على ورق A4 */}
      {isPrintModalOpen && shipmentsToPrint.length > 0 && (
        <PrintShipmentsModal
          shipments={shipmentsToPrint}
          onClose={() => setIsPrintModalOpen(false)}
        />
      )}
    </div>
  );
}
