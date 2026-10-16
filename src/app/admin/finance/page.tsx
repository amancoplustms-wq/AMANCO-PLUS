'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  formatCurrency,
  buildWhatsAppLink,
  buildTelLink,
  DateFilterType,
  DateRange,
  getDateRange,
  isDateInRange,
  isDateBeforeToday,
  formatArabicDate,
  formatArabicDateTime,
  generateCourierSettlementCode,
} from '@/modules/finance/calculator';
import {
  PAYMENT_METHOD_LABELS,
  SHIPMENT_STATUS_LABELS,
  COURIER_SETTLEMENT_TYPE_LABELS,
  MerchantSettlement,
  MerchantSettlementInsert,
  CourierSettlement,
  CourierSettlementType,
  PaymentMethod,
  Merchant,
  Courier,
  Shipment,
} from '@/types/database';
import PrintSettlementModal from '@/components/admin/PrintSettlementModal';
import {
  Wallet,
  Banknote,
  Receipt,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  TrendingUp,
  RefreshCw,
  CheckCircle,
  Truck,
  Users,
  Search,
  Filter,
  Printer,
  MessageCircle,
  FileText,
  AlertCircle,
  CheckSquare,
  Square,
  X,
  CreditCard,
  Building,
  Calendar,
  CalendarRange,
  AlertTriangle,
  Clock,
  History,
  Eye,
  Package,
} from 'lucide-react';

// دالة احتساب عمولة المندوب الفعلية مع استخدام عمولة المنطقة كقيمة احتياطية (Fallback)
export function getShipmentCommission(s: {
  courier_commission?: number | null;
  zones?: { courier_commission?: number | null } | null;
}): number {
  const c = Number(s.courier_commission) || 0;
  if (c > 0) return c;
  return Number(s.zones?.courier_commission) || 0;
}

interface ExtendedShipmentWithZone extends Shipment {
  zones?: { name: string; governorate: string; courier_commission?: number } | null;
  merchants?: Merchant | null;
  couriers?: Courier | null;
}

interface CourierCustodySummary {
  courier: Courier;
  shipmentsCount: number;
  totalCollectedCash: number;
  pendingCommissions: number;
  settledCommissions: number;
  totalCommissions: number;
  netHandover: number;
  shipments: ExtendedShipmentWithZone[];
  commissionShipments: ExtendedShipmentWithZone[];
  // مقاييس المتأخرات والفترة الزمنية
  hasOverdueShipments: boolean;
  earliestOverdueDate: string | null;
  overdueShipmentsCount: number;
  overdueCash: number;
  periodShipmentsCount: number;
  periodCash: number;
}

interface MerchantPendingSummary {
  merchant: Merchant;
  shipmentsCount: number;
  totalCod: number;
  totalShippingFee: number;
  netPayout: number;
  shipments: ExtendedShipmentWithZone[];
  // مقاييس المتأخرات والفترة الزمنية
  hasOverdueShipments: boolean;
  earliestOverdueDate: string | null;
  overdueShipmentsCount: number;
  overdueNetPayout: number;
  periodShipmentsCount: number;
  periodNetPayout: number;
}

interface ExtendedSettlement extends MerchantSettlement {
  merchants?: Merchant | null;
  shipments?: ExtendedShipmentWithZone[];
}

export default function AdminFinancePage() {
  const [activeTab, setActiveTab] = useState<'COURIERS' | 'MERCHANTS' | 'ARCHIVE'>('COURIERS');
  const [loading, setLoading] = useState(true);

  // شريط الفلترة الزمنية الذكي وجرد اليومية
  const [dateFilter, setDateFilter] = useState<DateFilterType>('today');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // نطاق عرض المتأخرات في تبويب العهد والتسويات
  const [pendingFilterScope, setPendingFilterScope] = useState<'ALL' | 'OVERDUE' | 'PERIOD'>('ALL');

  // تخزين البيانات الأصلية من قاعدة البيانات
  const [rawShipments, setRawShipments] = useState<ExtendedShipmentWithZone[]>([]);
  const [rawCouriers, setRawCouriers] = useState<Courier[]>([]);
  const [rawMerchants, setRawMerchants] = useState<Merchant[]>([]);
  const [rawSettlements, setRawSettlements] = useState<ExtendedSettlement[]>([]);

  // بيانات التبويب 1: عهد المناديب
  const [handoverMode, setHandoverMode] = useState<'NET' | 'GROSS'>('NET'); // صافي (بعد خصم العمولة) أو إجمالي الكاش

  // نافذة توريد عهدة مندوب
  const [selectedCourierForHandover, setSelectedCourierForHandover] = useState<CourierCustodySummary | null>(null);
  const [selectedHandoverShipmentIds, setSelectedHandoverShipmentIds] = useState<Set<string>>(new Set());
  const [handoverSettlementChoice, setHandoverSettlementChoice] = useState<'SETTLE_BOTH' | 'CASH_ONLY'>('SETTLE_BOTH');
  const [submittingHandover, setSubmittingHandover] = useState(false);

  // نافذة صرف وتسوية العمولات المستحقة للمندوب
  const [courierForCommissionSettlement, setCourierForCommissionSettlement] = useState<CourierCustodySummary | null>(null);
  const [submittingCommissionSettlement, setSubmittingCommissionSettlement] = useState(false);

  // بيانات التبويب 2: تسويات التجار المعلقة
  const [selectedMerchantForSettlement, setSelectedMerchantForSettlement] = useState<MerchantPendingSummary | null>(null);
  const [selectedSettlementShipmentIds, setSelectedSettlementShipmentIds] = useState<Set<string>>(new Set());
  const [settlementPaymentMethod, setSettlementPaymentMethod] = useState<PaymentMethod>('INSTAPAY');
  const [settlementRef, setSettlementRef] = useState('');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [submittingSettlement, setSubmittingSettlement] = useState(false);

  // بيانات التبويب 3: أرشيف كشوف التسويات
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archivePaymentFilter, setArchivePaymentFilter] = useState<string>('ALL');
  const [viewingSettlement, setViewingSettlement] = useState<ExtendedSettlement | null>(null);

  // جلب كافة البيانات المالية من Supabase
  const fetchFinanceData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();

      const [shipmentsRes, couriersRes, merchantsRes, settlementsRes] = await Promise.all([
        supabase
          .from('shipments')
          .select(`
            *,
            merchants:merchant_id (*),
            zones:zone_id (name, governorate, courier_commission),
            couriers:courier_id (*)
          `),

        supabase.from('couriers').select('*'),
        supabase.from('merchants').select('*'),
        supabase
          .from('merchant_settlements')
          .select(`
            *,
            merchants:merchant_id (*),
            shipments:shipments (
              *,
              zones:zone_id (name, governorate, courier_commission)
            )
          `)
          .order('settled_at', { ascending: false }),
      ]);

      setRawShipments((shipmentsRes.data as unknown as ExtendedShipmentWithZone[]) || []);
      setRawCouriers(couriersRes.data || []);
      setRawMerchants(merchantsRes.data || []);
      setRawSettlements((settlementsRes.data as unknown as ExtendedSettlement[]) || []);
    } catch (err) {
      console.error('Failed to load finance data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFinanceData();
  }, [fetchFinanceData]);

  // احتساب النطاق الزمني المحدد
  const dateRange = useMemo(
    () => getDateRange(dateFilter, customStartDate, customEndDate),
    [dateFilter, customStartDate, customEndDate],
  );

  const terminalStatuses = useMemo(
    () => ['DELIVERED', 'PARTIAL_DELIVERED', 'EXCHANGED', 'RETURNED'],
    [],
  );
  const commissionEligibleStatuses = useMemo(
    () => ['DELIVERED', 'PARTIAL_DELIVERED', 'EXCHANGED'],
    [],
  );

  // احتساب المؤشرات المالية (KPIs) الأربعة بدقة محاسبية
  const treasuryStats = useMemo(() => {
    let periodVaultCash = 0;
    let allTimeVaultCash = 0;
    let allTimeCommissionsSettled = 0;

    let totalOpenStreetCash = 0;
    let todayStreetCash = 0;
    let overdueStreetCash = 0;

    let totalOpenMerchantDues = 0;
    let todayMerchantDues = 0;
    let overdueMerchantDues = 0;

    let periodShippingFee = 0;
    let periodCourierCommission = 0;

    rawShipments.forEach((s) => {
      const cash = Number(s.collected_cash) || 0;
      const fee = Number(s.shipping_fee) || 0;
      const comm = getShipmentCommission(s);
      const net = Number(s.merchant_net_amount) || 0;
      const dStr = s.updated_at || s.created_at;

      // 1. النقدية الموردة للخزنة (الفترة المحددة والتراكمي للدرج)
      if (s.is_courier_cash_settled && cash > 0) {
        allTimeVaultCash += cash;
        if (isDateInRange(dStr, dateRange)) {
          periodVaultCash += cash;
        }
      }

      if (s.is_courier_commission_settled) {
        allTimeCommissionsSettled += comm;
      }

      // 2. النقدية بعهدة المناديب بالشارع (المفتوحة حالياً دائماً + تفصيل اليوم والمتأخرات)
      if (!s.is_courier_cash_settled && cash > 0) {
        totalOpenStreetCash += cash;
        if (isDateBeforeToday(dStr)) {
          overdueStreetCash += cash;
        } else {
          todayStreetCash += cash;
        }
      }

      // 3. مستحقات التجار الجاهزة للصرف (المفتوحة حالياً دائماً + تفصيل اليوم والمتأخرات)
      if (terminalStatuses.includes(s.status) && !s.settlement_id) {
        totalOpenMerchantDues += net;
        if (isDateBeforeToday(dStr)) {
          overdueMerchantDues += net;
        } else {
          todayMerchantDues += net;
        }
      }

      // 4. أرباح الشركة (تتحدث ديناميكياً حسب الفترة المختارة)
      if (terminalStatuses.includes(s.status) && isDateInRange(dStr, dateRange)) {
        periodShippingFee += fee;
        periodCourierCommission += comm;
      }
    });

    // إجمالي ما صُرف للتجار في كشوفات التسويات المعتمدة
    const allTimeSettlementsPaid = rawSettlements.reduce(
      (sum, st) => sum + (Number(st.net_payout_amount) || 0),
      0,
    );

    // الرصيد الصافي المتبقي بالدرج بعد خصم تحويلات التجار والعمولات المصروفة
    const cumulativeDrawerNet = Math.max(
      0,
      allTimeVaultCash - allTimeSettlementsPaid - allTimeCommissionsSettled,
    );

    return {
      periodVaultCash,
      cumulativeDrawerNet,
      totalOpenStreetCash,
      todayStreetCash,
      overdueStreetCash,
      totalOpenMerchantDues,
      todayMerchantDues,
      overdueMerchantDues,
      periodCompanyProfit: periodShippingFee - periodCourierCommission,
      periodShippingFee,
      periodCourierCommission,
    };
  }, [rawShipments, rawSettlements, dateRange, terminalStatuses]);

  // احتساب عهد المناديب وتتبع المتأخرات
  const allCourierCustodies = useMemo(() => {
    const list: CourierCustodySummary[] = [];

    rawCouriers.forEach((courier) => {
      const unsettledCash = rawShipments.filter(
        (s) =>
          s.courier_id === courier.id &&
          !s.is_courier_cash_settled &&
          (Number(s.collected_cash) > 0 || terminalStatuses.includes(s.status)),
      );

      const unsettledComm = rawShipments.filter(
        (s) =>
          s.courier_id === courier.id &&
          commissionEligibleStatuses.includes(s.status) &&
          !s.is_courier_commission_settled,
      );

      const settledComm = rawShipments.filter(
        (s) =>
          s.courier_id === courier.id &&
          commissionEligibleStatuses.includes(s.status) &&
          s.is_courier_commission_settled,
      );

      const totalCash = unsettledCash.reduce((sum, s) => sum + (Number(s.collected_cash) || 0), 0);
      const pendingCommTotal = unsettledComm.reduce((sum, s) => sum + getShipmentCommission(s), 0);
      const settledCommTotal = settledComm.reduce((sum, s) => sum + getShipmentCommission(s), 0);

      // فحص المتأخرات من أيام سابقة
      let earliestOverdueDate: string | null = null;
      let overdueCount = 0;
      let overdueCash = 0;
      let periodShipmentsCount = 0;
      let periodCash = 0;

      unsettledCash.forEach((s) => {
        const dStr = s.updated_at || s.created_at;
        if (isDateBeforeToday(dStr)) {
          overdueCount++;
          overdueCash += Number(s.collected_cash) || 0;
          if (!earliestOverdueDate || (dStr && new Date(dStr) < new Date(earliestOverdueDate))) {
            earliestOverdueDate = dStr;
          }
        }
        if (isDateInRange(dStr, dateRange)) {
          periodShipmentsCount++;
          periodCash += Number(s.collected_cash) || 0;
        }
      });

      unsettledComm.forEach((s) => {
        const dStr = s.updated_at || s.created_at;
        if (isDateBeforeToday(dStr)) {
          if (!earliestOverdueDate || (dStr && new Date(dStr) < new Date(earliestOverdueDate))) {
            earliestOverdueDate = dStr;
          }
        }
      });

      if (unsettledCash.length > 0 || unsettledComm.length > 0) {
        list.push({
          courier,
          shipmentsCount: unsettledCash.length,
          totalCollectedCash: totalCash,
          pendingCommissions: pendingCommTotal,
          settledCommissions: settledCommTotal,
          totalCommissions: pendingCommTotal,
          netHandover: totalCash - pendingCommTotal,
          shipments: unsettledCash,
          commissionShipments: unsettledComm,
          hasOverdueShipments: Boolean(earliestOverdueDate),
          earliestOverdueDate,
          overdueShipmentsCount: overdueCount,
          overdueCash,
          periodShipmentsCount,
          periodCash,
        });
      }
    });

    return list;
  }, [rawCouriers, rawShipments, dateRange, terminalStatuses, commissionEligibleStatuses]);

  // تطبيق فلتر المتأخرات على عهد المناديب
  const courierCustodies = useMemo(() => {
    if (pendingFilterScope === 'OVERDUE') {
      return allCourierCustodies.filter((c) => c.hasOverdueShipments);
    }
    if (pendingFilterScope === 'PERIOD') {
      return allCourierCustodies.filter((c) => c.periodShipmentsCount > 0);
    }
    return allCourierCustodies; // 'ALL'
  }, [allCourierCustodies, pendingFilterScope]);

  // احتساب تسويات التجار المعلقة وتتبع المتأخرات
  const allMerchantPendings = useMemo(() => {
    const list: MerchantPendingSummary[] = [];

    rawMerchants.forEach((merchant) => {
      const pendingShipments = rawShipments.filter(
        (s) =>
          s.merchant_id === merchant.id &&
          terminalStatuses.includes(s.status) &&
          !s.settlement_id,
      );

      if (pendingShipments.length > 0) {
        const codSum = pendingShipments.reduce((sum, s) => sum + (Number(s.collected_cash) || 0), 0);
        const feeSum = pendingShipments.reduce((sum, s) => sum + (Number(s.shipping_fee) || 0), 0);
        const netSum = pendingShipments.reduce((sum, s) => sum + (Number(s.merchant_net_amount) || 0), 0);

        let earliestOverdueDate: string | null = null;
        let overdueCount = 0;
        let overdueNetPayout = 0;
        let periodShipmentsCount = 0;
        let periodNetPayout = 0;

        pendingShipments.forEach((s) => {
          const dStr = s.updated_at || s.created_at;
          if (isDateBeforeToday(dStr)) {
            overdueCount++;
            overdueNetPayout += Number(s.merchant_net_amount) || 0;
            if (!earliestOverdueDate || (dStr && new Date(dStr) < new Date(earliestOverdueDate))) {
              earliestOverdueDate = dStr;
            }
          }
          if (isDateInRange(dStr, dateRange)) {
            periodShipmentsCount++;
            periodNetPayout += Number(s.merchant_net_amount) || 0;
          }
        });

        list.push({
          merchant,
          shipmentsCount: pendingShipments.length,
          totalCod: codSum,
          totalShippingFee: feeSum,
          netPayout: netSum,
          shipments: pendingShipments,
          hasOverdueShipments: Boolean(earliestOverdueDate),
          earliestOverdueDate,
          overdueShipmentsCount: overdueCount,
          overdueNetPayout,
          periodShipmentsCount,
          periodNetPayout,
        });
      }
    });

    return list;
  }, [rawMerchants, rawShipments, dateRange, terminalStatuses]);

  // تطبيق فلتر المتأخرات على تسويات التجار
  const merchantPendings = useMemo(() => {
    if (pendingFilterScope === 'OVERDUE') {
      return allMerchantPendings.filter((m) => m.hasOverdueShipments);
    }
    if (pendingFilterScope === 'PERIOD') {
      return allMerchantPendings.filter((m) => m.periodShipmentsCount > 0);
    }
    return allMerchantPendings; // 'ALL'
  }, [allMerchantPendings, pendingFilterScope]);

  // ==========================================================================
  // الإجراءات التفاعلية: توريد عهدة المندوب
  // ==========================================================================
  const openCourierHandoverModal = (summary: CourierCustodySummary) => {
    setSelectedCourierForHandover(summary);
    // افتراضياً تحديد كافة شحنات المندوب
    setSelectedHandoverShipmentIds(new Set(summary.shipments.map((s) => s.id)));
    setHandoverSettlementChoice('SETTLE_BOTH');
  };

  const handleConfirmHandover = async () => {
    if (!selectedCourierForHandover) return;
    const targetIds = Array.from(selectedHandoverShipmentIds);
    if (targetIds.length === 0) {
      alert('يرجى تحديد شحنة واحدة على الأقل لتأكيد توريد نقدها للخزنة');
      return;
    }

    setSubmittingHandover(true);
    try {
      const supabase = createClient();
      const targetShipments = selectedCourierForHandover.shipments.filter((s) =>
        targetIds.includes(s.id),
      );
      const totalCash = targetShipments.reduce(
        (sum, s) => sum + (Number(s.collected_cash) || 0),
        0,
      );
      const totalComm = targetShipments.reduce(
        (sum, s) => sum + getShipmentCommission(s),
        0,
      );
      const isSettleBoth = handoverSettlementChoice === 'SETTLE_BOTH';
      const settlementType: CourierSettlementType = isSettleBoth ? 'NET_HANDOVER' : 'CASH_HANDOVER';
      const commAmount = isSettleBoth ? totalComm : 0;
      const netAmount = isSettleBoth ? totalCash - totalComm : totalCash;

      if (isSettleBoth) {
        for (const s of targetShipments) {
          const effComm = getShipmentCommission(s);
          const updatePayload: {
            is_courier_cash_settled: boolean;
            is_courier_commission_settled: boolean;
            courier_commission?: number;
          } = {
            is_courier_cash_settled: true,
            is_courier_commission_settled: true,
          };
          if (Number(s.courier_commission) === 0 && effComm > 0) {
            updatePayload.courier_commission = effComm;
          }
          await supabase.from('shipments').update(updatePayload).eq('id', s.id);
        }
      } else {
        const { error } = await supabase
          .from('shipments')
          .update({ is_courier_cash_settled: true })
          .in('id', targetIds);
        if (error) throw error;
      }

      // توثيق وحفظ سجل في جدول courier_settlements
      const settlementCode = generateCourierSettlementCode();
      const { error: settlementErr } = await supabase.from('courier_settlements').insert({
        settlement_code: settlementCode,
        courier_id: selectedCourierForHandover.courier.id,
        settlement_type: settlementType,
        shipments_count: targetShipments.length,
        total_cash_collected: totalCash,
        total_commission_amount: commAmount,
        net_treasury_amount: netAmount,
        shipment_ids: targetIds,
        notes: isSettleBoth
          ? `توريد صافي كاش وتسوية عمولة (${targetShipments.length}) شحنة للمندوب ${selectedCourierForHandover.courier.name}`
          : `توريد كامل الكاش (${targetShipments.length}) شحنة للمندوب ${selectedCourierForHandover.courier.name} مع بقاء العمولة مستحقة`,
      });
      if (settlementErr) console.error('Error inserting courier settlement:', settlementErr);

      setSelectedCourierForHandover(null);
      fetchFinanceData();
    } catch (err: unknown) {
      alert(`حدث خطأ أثناء توريد النقدية: ${(err as Error).message}`);
    } finally {
      setSubmittingHandover(false);
    }
  };

  // تأكيد صرف وتسوية العمولات المستحقة للمندوب
  const handleConfirmCommissionSettlement = async () => {
    if (!courierForCommissionSettlement) return;
    const targetShipments = courierForCommissionSettlement.commissionShipments;
    if (targetShipments.length === 0) {
      alert('لا توجد شحنات بعمولات مستحقة لهذا المندوب');
      return;
    }

    setSubmittingCommissionSettlement(true);
    try {
      const supabase = createClient();
      const targetIds = targetShipments.map((s) => s.id);
      const totalCash = targetShipments.reduce(
        (sum, s) => sum + (Number(s.collected_cash) || 0),
        0,
      );
      const totalComm = targetShipments.reduce(
        (sum, s) => sum + getShipmentCommission(s),
        0,
      );

      for (const s of targetShipments) {
        const effComm = getShipmentCommission(s);
        const updatePayload: {
          is_courier_commission_settled: boolean;
          courier_commission?: number;
        } = {
          is_courier_commission_settled: true,
        };
        if (Number(s.courier_commission) === 0 && effComm > 0) {
          updatePayload.courier_commission = effComm;
        }
        await supabase.from('shipments').update(updatePayload).eq('id', s.id);
      }

      // توثيق وحفظ سجل في جدول courier_settlements
      const settlementCode = generateCourierSettlementCode();
      const { error: settlementErr } = await supabase.from('courier_settlements').insert({
        settlement_code: settlementCode,
        courier_id: courierForCommissionSettlement.courier.id,
        settlement_type: 'COMMISSION_PAYOUT',
        shipments_count: targetShipments.length,
        total_cash_collected: totalCash,
        total_commission_amount: totalComm,
        net_treasury_amount: totalComm,
        shipment_ids: targetIds,
        notes: `صرف وتسوية عمولات (${targetShipments.length}) شحنة للمندوب ${courierForCommissionSettlement.courier.name}`,
      });
      if (settlementErr) console.error('Error inserting courier commission payout:', settlementErr);

      setCourierForCommissionSettlement(null);
      fetchFinanceData();
    } catch (err: unknown) {
      alert(`حدث خطأ أثناء صرف وتسوية العمولات: ${(err as Error).message}`);
    } finally {
      setSubmittingCommissionSettlement(false);
    }
  };

  // ==========================================================================
  // الإجراءات التفاعلية: إصدار كشف تسوية تاجر جديد
  // ==========================================================================
  const openNewSettlementModal = (summary: MerchantPendingSummary) => {
    setSelectedMerchantForSettlement(summary);
    setSelectedSettlementShipmentIds(new Set(summary.shipments.map((s) => s.id)));
    setSettlementPaymentMethod('INSTAPAY');
    setSettlementRef('');
    setSettlementNotes('');
  };

  const handleConfirmSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMerchantForSettlement) return;

    const chosenShipments = selectedMerchantForSettlement.shipments.filter((s) =>
      selectedSettlementShipmentIds.has(s.id),
    );

    if (chosenShipments.length === 0) {
      alert('يرجى تحديد شحنة واحدة على الأقل لتضمينها في كشف التسوية');
      return;
    }

    setSubmittingSettlement(true);
    try {
      const supabase = createClient();

      // احتساب الأرقام للشحنات المحددة فقط
      const totalCod = chosenShipments.reduce(
        (sum, s) => sum + (Number(s.collected_cash) || 0),
        0,
      );
      const totalShipping = chosenShipments.reduce(
        (sum, s) => sum + (Number(s.shipping_fee) || 0),
        0,
      );
      const netPayout = chosenShipments.reduce(
        (sum, s) => sum + (Number(s.merchant_net_amount) || 0),
        0,
      );

      // توليد كود تسوية فريد متسلسل
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const settlementCode = `STL-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${randomSuffix}`;

      // 1. إنشاء سجل كشف التسوية في جدول merchant_settlements
      const settlementPayload: MerchantSettlementInsert = {
        settlement_code: settlementCode,
        merchant_id: selectedMerchantForSettlement.merchant.id,
        total_cod_collected: totalCod,
        total_shipping_deducted: totalShipping,
        net_payout_amount: netPayout,
        payment_method: settlementPaymentMethod,
        transfer_reference: settlementRef.trim() || null,
        notes: settlementNotes.trim() || null,
        settled_at: new Date().toISOString(),
      };

      const { data: createdSettlement, error: insertErr } = await supabase
        .from('merchant_settlements')
        .insert(settlementPayload)
        .select()
        .single();

      if (insertErr) throw insertErr;

      // 2. تحديث settlement_id في كافة الشحنات المشمولة
      const shipmentIds = chosenShipments.map((s) => s.id);
      const { error: updateErr } = await supabase
        .from('shipments')
        .update({ settlement_id: createdSettlement.id })
        .in('id', shipmentIds);

      if (updateErr) throw updateErr;

      setSelectedMerchantForSettlement(null);
      setActiveTab('ARCHIVE');
      fetchFinanceData();
    } catch (err: unknown) {
      alert(`حدث خطأ أثناء إصدار كشف التسوية: ${(err as Error).message}`);
    } finally {
      setSubmittingSettlement(false);
    }
  };

  // فلترة أرشيف التسويات بالتاريخ والبحث وطريقة الدفع
  const filteredArchive = useMemo(() => {
    return rawSettlements.filter((st) => {
      const q = archiveSearch.toLowerCase().trim();
      const code = (st.settlement_code || '').toLowerCase();
      const brand = (st.merchants?.brand_name || '').toLowerCase();
      const ref = (st.transfer_reference || '').toLowerCase();

      const matchesSearch = !q || code.includes(q) || brand.includes(q) || ref.includes(q);
      const matchesMethod = archivePaymentFilter === 'ALL' || st.payment_method === archivePaymentFilter;
      const matchesDate = isDateInRange(st.settled_at, dateRange);

      return matchesSearch && matchesMethod && matchesDate;
    });
  }, [rawSettlements, archiveSearch, archivePaymentFilter, dateRange]);

  return (
    <div className="space-y-6">
      {/* ==================================================================== */}
      {/* ترويسة الصفحة */}
      {/* ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-brand-navy flex items-center gap-2.5">
            <Wallet className="text-brand-orange" size={26} />
            الخزنة المركزية والتسويات المالية
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            إدارة النقدية المحصلة، توريد عهد المناديب، وإصدار وطباعة كشوف تسوية حسابات التجار
          </p>
        </div>

        <button
          onClick={fetchFinanceData}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin text-brand-orange' : ''} />
          <span>تحديث الماليات</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* شريط الفلترة الزمنية الذكي وجرد اليومية (Date Range & Daily Filter Bar) */}
      {/* ==================================================================== */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Calendar className="text-brand-orange" size={20} />
            <span className="font-black text-slate-800 text-sm">جرد اليومية والفلترة الزمنية للخزنة</span>
          </div>
          <div className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
            <span>الفترة النشطة:</span>
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-mono">
              {dateFilter === 'today' && `حركة اليوم (${formatArabicDate(new Date().toISOString())})`}
              {dateFilter === 'yesterday' && 'أمس'}
              {dateFilter === 'week' && 'هذا الأسبوع'}
              {dateFilter === 'month' && 'هذا الشهر'}
              {dateFilter === 'custom' &&
                (customStartDate || customEndDate
                  ? `فترة مخصصة (${customStartDate || 'البداية'} إلى ${customEndDate || 'الآن'})`
                  : 'تحديد فترة')}
              {dateFilter === 'all' && 'كل الأوقات (السجل التراكمي الكامل)'}
            </span>
          </div>
        </div>

        {/* أزرار الفلترة السريعة */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setDateFilter('today')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              dateFilter === 'today'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Clock size={14} />
            <span>حركة اليوم (جرد اليومية)</span>
          </button>

          <button
            onClick={() => setDateFilter('yesterday')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              dateFilter === 'yesterday'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            أمس
          </button>

          <button
            onClick={() => setDateFilter('week')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              dateFilter === 'week'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            هذا الأسبوع
          </button>

          <button
            onClick={() => setDateFilter('month')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              dateFilter === 'month'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            هذا الشهر
          </button>

          <button
            onClick={() => setDateFilter('custom')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              dateFilter === 'custom'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <CalendarRange size={14} />
            <span>تحديد يوم أو فترة قديمة</span>
          </button>

          <button
            onClick={() => setDateFilter('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              dateFilter === 'all'
                ? 'bg-brand-navy text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            كل الأوقات (السجل التراكمي)
          </button>
        </div>

        {/* حقول التاريخ المخصص */}
        {dateFilter === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 bg-slate-50 p-3 rounded-xl border border-slate-200 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">من تاريخ:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono font-bold text-slate-800"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">إلى تاريخ:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono font-bold text-slate-800"
              />
            </div>
            {(customStartDate || customEndDate) && (
              <button
                onClick={() => {
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="text-xs text-rose-600 hover:underline font-bold px-2 py-1 cursor-pointer"
              >
                مسح التواريخ
              </button>
            )}
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* بطاقات المؤشرات المالية للخزنة (Treasury KPI Cards) */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* بطاقة 1: نقدية الخزنة الفعلية الموردة */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-300 shadow-xs relative overflow-hidden group hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-emerald-800">
                نقدية فعلية بالخزنة ({dateFilter === 'today' ? 'اليوم' : dateFilter === 'all' ? 'تراكمي' : 'الفترة'})
              </span>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Banknote size={20} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 mb-1" dir="ltr">
              {loading ? '...' : formatCurrency(treasuryStats.periodVaultCash)}
            </div>
            <div className="text-xs text-emerald-800 font-medium">تم توريدها رسمياً للخزنة في الفترة</div>
          </div>

          <div className="text-[11px] text-emerald-950 font-medium mt-3 pt-2.5 border-t border-emerald-100 flex flex-col gap-0.5 bg-emerald-50/50 -mx-5 -mb-5 p-3 rounded-b-2xl">
            <span className="text-emerald-800 font-bold">الصافي المتبقي بالدرج بعد خصم تحويلات التجار والعمولات المصروفة:</span>
            <span className="font-black text-xs text-emerald-900" dir="ltr">
              {loading ? '...' : formatCurrency(treasuryStats.cumulativeDrawerNet)}
            </span>
          </div>
        </div>

        {/* بطاقة 2: عهد معلقة بطرف المناديب بالشارع */}
        <div className="bg-white p-5 rounded-2xl border border-amber-300 shadow-xs relative overflow-hidden group hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-amber-800">نقدية بعهدة المناديب بالشارع</span>
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Truck size={20} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-700 mb-1" dir="ltr">
              {loading ? '...' : formatCurrency(treasuryStats.totalOpenStreetCash)}
            </div>
            <div className="text-xs text-amber-800 font-medium">إجمالي العهد المفتوحة غير الموردة</div>
          </div>

          <div className="text-[11px] text-amber-950 font-medium mt-3 pt-2.5 border-t border-amber-100 flex flex-wrap items-center gap-1.5 bg-amber-50/50 -mx-5 -mb-5 p-3 rounded-b-2xl">
            <span>منها اليوم:</span>
            <span className="font-bold text-emerald-700" dir="ltr">
              {loading ? '...' : formatCurrency(treasuryStats.todayStreetCash)}
            </span>
            <span className="text-slate-300">|</span>
            <span>متأخرات أيام سابقة:</span>
            <span className="font-bold text-rose-600" dir="ltr">
              {loading ? '...' : formatCurrency(treasuryStats.overdueStreetCash)}
            </span>
          </div>
        </div>

        {/* بطاقة 3: مستحقات تجار جاهزة للصرف */}
        <div className="bg-white p-5 rounded-2xl border border-blue-300 shadow-xs relative overflow-hidden group hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-blue-800">مستحقات تجار جاهزة للصرف</span>
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                <Receipt size={20} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-blue-700 mb-1" dir="ltr">
              {loading ? '...' : formatCurrency(treasuryStats.totalOpenMerchantDues)}
            </div>
            <div className="text-xs text-blue-800 font-medium">صافي شحنات منتهية لم تسوّ بعد</div>
          </div>

          <div className="text-[11px] text-blue-950 font-medium mt-3 pt-2.5 border-t border-blue-100 flex flex-wrap items-center gap-1.5 bg-blue-50/50 -mx-5 -mb-5 p-3 rounded-b-2xl">
            <span>منها اليوم:</span>
            <span className="font-bold text-emerald-700" dir="ltr">
              {loading ? '...' : formatCurrency(treasuryStats.todayMerchantDues)}
            </span>
            <span className="text-slate-300">|</span>
            <span>متأخرات أيام سابقة:</span>
            <span className="font-bold text-rose-600" dir="ltr">
              {loading ? '...' : formatCurrency(treasuryStats.overdueMerchantDues)}
            </span>
          </div>
        </div>

        {/* بطاقة 4: صافي أرباح أمانكو بلس */}
        <div className="bg-white p-5 rounded-2xl border border-purple-300 shadow-xs relative overflow-hidden group hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-purple-800">
                صافي أرباح أمانكو بلس ({dateFilter === 'today' ? 'اليوم' : dateFilter === 'all' ? 'تراكمي' : 'الفترة'})
              </span>
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <TrendingUp size={20} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-purple-700 mb-1" dir="ltr">
              {loading ? '...' : formatCurrency(treasuryStats.periodCompanyProfit)}
            </div>
            <div className="text-xs text-purple-800 font-medium">رسوم الشحن مطروحاً منها العمولات</div>
          </div>

          <div className="text-[11px] text-purple-950 font-medium mt-3 pt-2.5 border-t border-purple-100 flex flex-wrap items-center gap-1.5 bg-purple-50/50 -mx-5 -mb-5 p-3 rounded-b-2xl">
            <span>إيراد الشحن:</span>
            <span className="font-bold text-purple-800" dir="ltr">
              {loading ? '...' : formatCurrency(treasuryStats.periodShippingFee)}
            </span>
            <span className="text-slate-300">|</span>
            <span>عمولات المناديب:</span>
            <span className="font-bold text-amber-700" dir="ltr">
              {loading ? '...' : `-${formatCurrency(treasuryStats.periodCourierCommission)}`}
            </span>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* تبويبات الأقسام الثلاثة */}
      {/* ==================================================================== */}
      <div className="flex items-center bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs gap-2 text-xs font-bold">
        <button
          onClick={() => setActiveTab('COURIERS')}
          className={`flex-1 py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'COURIERS'
              ? 'bg-brand-navy text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Truck size={17} />
          <span>عهد المناديب وتوريد الخزنة ({courierCustodies.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('MERCHANTS')}
          className={`flex-1 py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'MERCHANTS'
              ? 'bg-brand-navy text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Users size={17} />
          <span>تسوية مستحقات التجار ({merchantPendings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ARCHIVE')}
          className={`flex-1 py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'ARCHIVE'
              ? 'bg-brand-navy text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Receipt size={17} />
          <span>سجل كشوف تسوية التجار ({filteredArchive.length})</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* التبويب الأول: عهد المناديب وتوريد النقدية للخزنة */}
      {/* ==================================================================== */}
      {activeTab === 'COURIERS' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <div>
              <h2 className="font-black text-slate-800 text-base">
                المناديب المطالبين بتوريد نقدية للخزنة
              </h2>
              <p className="text-xs text-slate-500">
                متابعة المبالغ المحصلة فعلياً بيد كل مندوب واعتماد استلامها في خزنة الشركة
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* فلتر المتأخرات الصغير */}
              <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <span className="text-slate-500 px-1.5 text-[11px]">تصفية العهد:</span>
                <button
                  onClick={() => setPendingFilterScope('ALL')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    pendingFilterScope === 'ALL'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  الكل ({allCourierCustodies.length})
                </button>
                <button
                  onClick={() => setPendingFilterScope('OVERDUE')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    pendingFilterScope === 'OVERDUE'
                      ? 'bg-amber-500 text-white shadow-xs font-black'
                      : 'text-amber-800 hover:bg-amber-200/60'
                  }`}
                >
                  <span>⚠️ متأخرات سابقة</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      pendingFilterScope === 'OVERDUE'
                        ? 'bg-black/20 text-white'
                        : 'bg-amber-200 text-amber-900'
                    }`}
                  >
                    {allCourierCustodies.filter((c) => c.hasOverdueShipments).length}
                  </span>
                </button>
                <button
                  onClick={() => setPendingFilterScope('PERIOD')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    pendingFilterScope === 'PERIOD'
                      ? 'bg-blue-600 text-white shadow-xs font-black'
                      : 'text-blue-700 hover:bg-blue-200/60'
                  }`}
                >
                  <span>الفترة المحددة</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      pendingFilterScope === 'PERIOD'
                        ? 'bg-black/20 text-white'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {allCourierCustodies.filter((c) => c.periodShipmentsCount > 0).length}
                  </span>
                </button>
              </div>

              {/* مفتاح التبديل بين صافي العهدة وإجمالي الكاش */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <span className="text-slate-500 px-1.5 text-[11px]">الحساب:</span>
                <button
                  onClick={() => setHandoverMode('NET')}
                  className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    handoverMode === 'NET'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  الصافي
                </button>
                <button
                  onClick={() => setHandoverMode('GROSS')}
                  className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    handoverMode === 'GROSS'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  كامل الكاش
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw size={26} className="animate-spin mx-auto mb-2 text-brand-orange" />
                <p className="text-sm">جاري مراجعة عهد المناديب...</p>
              </div>
            ) : courierCustodies.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <CheckCircle size={36} className="mx-auto mb-2 text-emerald-500" />
                <h3 className="text-base font-bold text-slate-700 mb-1">
                  لا توجد عهد نقدية مطابقة لهذا الفلتر
                </h3>
                <p className="text-xs text-slate-400">
                  {pendingFilterScope === 'OVERDUE'
                    ? 'رائع! لا توجد أي متأخرات سابقة بعهدة المناديب'
                    : 'تم توريد وتقفيل كافة الشحنات بنجاح'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-4">المندوب</th>
                      <th className="py-3.5 px-4">التواصل السريع</th>
                      <th className="py-3.5 px-4">عهدة الكاش المطلوب توريدها</th>
                      <th className="py-3.5 px-4">عمولة المندوب المستحقة (غير مدفوعة)</th>
                      <th className="py-3.5 px-4">عمولات مصروفة سابقاً</th>
                      <th className="py-3.5 px-4">
                        {handoverMode === 'NET' ? 'الصافي المطلوب للتوريد' : 'كامل الكاش المطلوب'}
                      </th>
                      <th className="py-3.5 px-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {courierCustodies.map((item) => {
                      const amountToCollect =
                        handoverMode === 'NET' ? item.netHandover : item.totalCollectedCash;

                      return (
                        <tr key={item.courier.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 text-sm">
                              {item.courier.name}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              كود: {item.courier.id.slice(0, 8)}
                            </div>
                            {item.hasOverdueShipments && (
                              <div className="mt-1.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                  <AlertTriangle size={12} className="text-amber-600 shrink-0" />
                                  <span>⚠️ متأخرات من أيام سابقة (منذ {formatArabicDate(item.earliestOverdueDate)})</span>
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <a
                                href={buildTelLink(item.courier.phone)}
                                className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-mono text-[11px] transition-colors"
                                dir="ltr"
                              >
                                {item.courier.phone}
                              </a>
                              <a
                                href={buildWhatsAppLink(
                                  item.courier.whatsapp || item.courier.phone,
                                  `مرحباً كابتن ${item.courier.name}، يرجى تجهيز توريد نقدية الشحنات بقيمة ${formatCurrency(
                                    amountToCollect,
                                  )} للخزنة...`,
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                              >
                                <MessageCircle size={14} />
                              </a>
                            </div>
                          </td>

                          {/* عهدة الكاش المطلوب توريدها */}
                          <td className="py-3.5 px-4">
                            <div className="font-black text-slate-900 text-sm" dir="ltr">
                              {formatCurrency(item.totalCollectedCash)}
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium">
                              {item.shipmentsCount} شحنة بعهدته
                            </div>
                          </td>

                          {/* عمولة المندوب المستحقة غير المدفوعة */}
                          <td className="py-3.5 px-4">
                            <div
                              className={`font-black text-sm ${
                                item.pendingCommissions > 0 ? 'text-amber-700' : 'text-slate-400'
                              }`}
                              dir="ltr"
                            >
                              {formatCurrency(item.pendingCommissions)}
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium">
                              {item.commissionShipments.length > 0
                                ? `${item.commissionShipments.length} شحنة مستحقة`
                                : 'تم صرف كافة العمولات'}
                            </div>
                          </td>

                          {/* عمولات تم صرفها سابقاً */}
                          <td className="py-3.5 px-4 font-semibold text-slate-500" dir="ltr">
                            {formatCurrency(item.settledCommissions)}
                          </td>

                          {/* الصافي المطلوب للتوريد */}
                          <td className="py-3.5 px-4 font-black text-sm text-emerald-700" dir="ltr">
                            {formatCurrency(amountToCollect)}
                          </td>

                          {/* الإجراءات */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openCourierHandoverModal(item)}
                                disabled={item.shipmentsCount === 0}
                                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs transition-colors cursor-pointer shadow-xs whitespace-nowrap"
                                title="توريد الكاش المحصل بعهدة المندوب"
                              >
                                توريد العهدة
                              </button>

                              <button
                                onClick={() => setCourierForCommissionSettlement(item)}
                                disabled={item.pendingCommissions <= 0}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs transition-colors cursor-pointer shadow-xs whitespace-nowrap"
                                title="صرف وتسوية العمولات المستحقة لهذا المندوب"
                              >
                                صرف وتسوية العمولات المستحقة
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
      {/* التبويب الثاني: تسوية مستحقات التجار وإصدار الكشوف */}
      {/* ==================================================================== */}
      {activeTab === 'MERCHANTS' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <div>
              <h2 className="font-black text-slate-800 text-base">
                التجار ذوو الشحنات المنتهية الجاهزة للتسوية
              </h2>
              <p className="text-xs text-slate-500">
                الشحنات التي تم تسليمها أو استرجاعها ولم يتم إصدار كشف تسوية وصرف مستحقاتها بعد
              </p>
            </div>

            {/* فلتر المتأخرات الصغير للتجار */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <span className="text-slate-500 px-1.5 text-[11px]">تصفية المستحقات:</span>
              <button
                onClick={() => setPendingFilterScope('ALL')}
                className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  pendingFilterScope === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الكل ({allMerchantPendings.length})
              </button>
              <button
                onClick={() => setPendingFilterScope('OVERDUE')}
                className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  pendingFilterScope === 'OVERDUE'
                    ? 'bg-amber-500 text-white shadow-xs font-black'
                    : 'text-amber-800 hover:bg-amber-200/60'
                }`}
              >
                <span>⚠️ متأخرات سابقة</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    pendingFilterScope === 'OVERDUE'
                      ? 'bg-black/20 text-white'
                      : 'bg-amber-200 text-amber-900'
                  }`}
                >
                  {allMerchantPendings.filter((m) => m.hasOverdueShipments).length}
                </span>
              </button>
              <button
                onClick={() => setPendingFilterScope('PERIOD')}
                className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  pendingFilterScope === 'PERIOD'
                    ? 'bg-blue-600 text-white shadow-xs font-black'
                    : 'text-blue-700 hover:bg-blue-200/60'
                }`}
              >
                <span>الفترة المحددة</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    pendingFilterScope === 'PERIOD'
                      ? 'bg-black/20 text-white'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {allMerchantPendings.filter((m) => m.periodShipmentsCount > 0).length}
                </span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw size={26} className="animate-spin mx-auto mb-2 text-brand-orange" />
                <p className="text-sm">جاري مراجعة مستحقات التجار...</p>
              </div>
            ) : merchantPendings.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <CheckCircle size={36} className="mx-auto mb-2 text-emerald-500" />
                <h3 className="text-base font-bold text-slate-700 mb-1">
                  لا توجد مستحقات معلقة مطابقة لهذا الفلتر
                </h3>
                <p className="text-xs text-slate-400">
                  {pendingFilterScope === 'OVERDUE'
                    ? 'ممتاز! لا توجد متأخرات سابقة لم تسوّ للتجار'
                    : 'تم إصدار كشوف التسويات لكافة الشحنات المنتهية السابقة'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-4">البراند والتاجر</th>
                      <th className="py-3.5 px-4">الهاتف والتواصل</th>
                      <th className="py-3.5 px-4">شحنات جاهزة للتسوية</th>
                      <th className="py-3.5 px-4">إجمالي التحصيل (COD)</th>
                      <th className="py-3.5 px-4">رسوم الشحن المخصومة</th>
                      <th className="py-3.5 px-4">صافي المستحق للتحويل</th>
                      <th className="py-3.5 px-4 text-center">إصدار الكشف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {merchantPendings.map((item) => (
                      <tr key={item.merchant.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 text-sm">
                            {item.merchant.brand_name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            المسؤول: {item.merchant.name} {item.merchant.is_vip ? '👑 VIP' : ''}
                          </div>
                          {item.hasOverdueShipments && (
                            <div className="mt-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                <AlertTriangle size={12} className="text-amber-600 shrink-0" />
                                <span>⚠️ متأخرات من أيام سابقة (منذ {formatArabicDate(item.earliestOverdueDate)})</span>
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <a
                            href={buildTelLink(item.merchant.phone)}
                            className="font-mono text-[11px] text-blue-700 hover:underline"
                            dir="ltr"
                          >
                            {item.merchant.phone}
                          </a>
                        </td>

                        <td className="py-3.5 px-4 font-bold text-slate-700">
                          {item.shipmentsCount} شحنة
                        </td>

                        <td className="py-3.5 px-4 font-bold text-slate-900" dir="ltr">
                          {formatCurrency(item.totalCod)}
                        </td>

                        <td className="py-3.5 px-4 font-bold text-amber-700" dir="ltr">
                          -{formatCurrency(item.totalShippingFee)}
                        </td>

                        <td className="py-3.5 px-4 font-black text-sm text-emerald-700" dir="ltr">
                          {formatCurrency(item.netPayout)}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => openNewSettlementModal(item)}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
                          >
                            إصدار كشف تسوية جديد
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* التبويب الثالث: سجل كشوف التسويات السابقة وطباعة كشف الحساب */}
      {/* ==================================================================== */}
      {activeTab === 'ARCHIVE' && (
        <div className="space-y-4">
          {/* شريط البحث والفلترة */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <input
                type="text"
                placeholder="بحث بكود الكشف، اسم التاجر، أو المرجع..."
                value={archiveSearch}
                onChange={(e) => setArchiveSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-right"
              />
              <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-xs text-slate-500 font-bold shrink-0">طريقة الدفع:</span>
              <select
                value={archivePaymentFilter}
                onChange={(e) => setArchivePaymentFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50"
              >
                <option value="ALL">كافة طرق التحويل</option>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw size={26} className="animate-spin mx-auto mb-2 text-brand-orange" />
                <p className="text-sm">جاري تحميل سجل التسويات...</p>
              </div>
            ) : filteredArchive.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Receipt size={36} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-semibold">لا توجد كشوف تسوية مطابقة للبحث</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-4">كود التسوية</th>
                      <th className="py-3.5 px-4">التاجر / البراند</th>
                      <th className="py-3.5 px-4">تاريخ التسوية</th>
                      <th className="py-3.5 px-4">طريقة التحويل</th>
                      <th className="py-3.5 px-4">إجمالي التحصيل</th>
                      <th className="py-3.5 px-4">رسوم الشحن</th>
                      <th className="py-3.5 px-4">الصافي المحول</th>
                      <th className="py-3.5 px-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredArchive.map((st) => (
                      <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-700" dir="ltr">
                          {st.settlement_code}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">
                            {st.merchants?.brand_name || 'تاجر عام'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {st.merchants?.name}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-500 font-mono" dir="ltr">
                          {new Date(st.settled_at).toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="bg-slate-100 font-semibold px-2 py-0.5 rounded text-slate-700">
                            {PAYMENT_METHOD_LABELS[st.payment_method]}
                          </span>
                          {st.transfer_reference && (
                            <span className="block text-[10px] font-mono text-slate-400 mt-0.5">
                              مرجع: {st.transfer_reference}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-bold text-slate-800" dir="ltr">
                          {formatCurrency(Number(st.total_cod_collected))}
                        </td>

                        <td className="py-3.5 px-4 font-bold text-amber-700" dir="ltr">
                          -{formatCurrency(Number(st.total_shipping_deducted))}
                        </td>

                        <td className="py-3.5 px-4 font-black text-sm text-emerald-700" dir="ltr">
                          {formatCurrency(Number(st.net_payout_amount))}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* زر فتح كشف الحساب A4 */}
                            <button
                              onClick={() => setViewingSettlement(st)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-colors cursor-pointer"
                              title="عرض وطباعة كشف الحساب A4"
                            >
                              <Printer size={14} />
                              <span>طباعة الكشف</span>
                            </button>

                            {/* زر إرسال واتساب سريع للتاجر */}
                            {st.merchants?.phone && (
                              <a
                                href={buildWhatsAppLink(
                                  st.merchants.whatsapp || st.merchants.phone,
                                  `أهلاً أ/ ${st.merchants.name}، تم إصدار كشف تسوية مستحقاتكم برقم (${st.settlement_code}) بإجمالي صافي محول: ${formatCurrency(Number(st.net_payout_amount))}. شكراً لتعاملكم مع أمانكو بلس للشحن والتوريد (AMANCO PLUS).`,
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                                title="إرسال ملخص واتساب"
                              >
                                <MessageCircle size={15} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* نافذة توريد عهدة المندوب للخزنة (Courier Handover Modal) */}
      {/* ==================================================================== */}
      {selectedCourierForHandover && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-6 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-brand-navy text-white shrink-0">
              <div>
                <h3 className="font-black text-base">
                  توريد عهدة المندوب: {selectedCourierForHandover.courier.name}
                </h3>
                <p className="text-xs text-slate-300">
                  تأكيد استلام النقدية المحصلة من المندوب وإيداعها في خزنة الشركة
                </p>
              </div>
              <button
                onClick={() => setSelectedCourierForHandover(null)}
                className="p-1.5 text-slate-300 hover:text-white rounded-lg cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {(() => {
              const checkedShipments = selectedCourierForHandover.shipments.filter((s) =>
                selectedHandoverShipmentIds.has(s.id),
              );
              const checkedCash = checkedShipments.reduce(
                (sum, s) => sum + (Number(s.collected_cash) || 0),
                0,
              );
              const checkedCommission = checkedShipments.reduce(
                (sum, s) => sum + getShipmentCommission(s),
                0,
              );
              const netToReceive = Math.max(0, checkedCash - checkedCommission);

              return (
                <>
                  <div className="p-6 overflow-y-auto space-y-4 flex-1">
                    {/* إجمالي الشحنات المحددة للتوريد */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 block mb-1">الشحنات المحددة:</span>
                        <span className="font-black text-sm text-slate-900">
                          {selectedHandoverShipmentIds.size} من إجمالي {selectedCourierForHandover.shipmentsCount}
                        </span>
                      </div>

                      <div className="sm:text-center">
                        <span className="text-slate-500 block mb-1">إجمالي الكاش المحصل:</span>
                        <span className="font-black text-sm text-slate-900" dir="ltr">
                          {formatCurrency(checkedCash)}
                        </span>
                      </div>

                      <div className="sm:text-left">
                        <span className="text-slate-500 block mb-1">عمولة الشحنات المحددة:</span>
                        <span className="font-black text-sm text-amber-700" dir="ltr">
                          {formatCurrency(checkedCommission)}
                        </span>
                      </div>
                    </div>

                    {/* خيارات طريقة التقفيل والتسوية المالية مع المندوب */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
                      <div className="text-xs font-bold text-slate-800">
                        طريقة التقفيل والتسوية المالية مع المندوب:
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* الخيار الأول: توريد الصافي وتسوية العمولة معاً */}
                        <div
                          onClick={() => setHandoverSettlementChoice('SETTLE_BOTH')}
                          className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                            handoverSettlementChoice === 'SETTLE_BOTH'
                              ? 'border-emerald-600 bg-emerald-50/60 shadow-xs'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <input
                                type="radio"
                                name="handoverChoice"
                                checked={handoverSettlementChoice === 'SETTLE_BOTH'}
                                onChange={() => setHandoverSettlementChoice('SETTLE_BOTH')}
                                className="text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="font-bold text-xs text-slate-900">
                                1) توريد الصافي وتسوية العمولة معاً (الموصى به)
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mr-5 leading-relaxed">
                              المندوب يسلّم الخزنة صافي المبلغ (الكاش المحصل ناقص عمولته). سيتم اعتماد استلام الكاش وصرف العمولة معاً في خطوة واحدة.
                            </p>
                          </div>
                          <div className="mt-3 mr-5 pt-2 border-t border-emerald-100 flex items-center justify-between">
                            <span className="text-[11px] text-slate-600 font-bold">المطلوب للخزنة:</span>
                            <span className="text-sm font-black text-emerald-700" dir="ltr">
                              {formatCurrency(netToReceive)}
                            </span>
                          </div>
                        </div>

                        {/* الخيار الثاني: توريد كامل الكاش فقط وتأجيل صرف العمولة */}
                        <div
                          onClick={() => setHandoverSettlementChoice('CASH_ONLY')}
                          className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                            handoverSettlementChoice === 'CASH_ONLY'
                              ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <input
                                type="radio"
                                name="handoverChoice"
                                checked={handoverSettlementChoice === 'CASH_ONLY'}
                                onChange={() => setHandoverSettlementChoice('CASH_ONLY')}
                                className="text-blue-600 focus:ring-blue-500"
                              />
                              <span className="font-bold text-xs text-slate-900">
                                2) توريد كامل الكاش فقط وتأجيل صرف العمولة
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mr-5 leading-relaxed">
                              المندوب يسلّم كامل الكاش المحصل بدون خصم، وتظل عمولته مستحقة له في حسابه لتُصرف لاحقاً.
                            </p>
                          </div>
                          <div className="mt-3 mr-5 pt-2 border-t border-blue-100 flex items-center justify-between">
                            <span className="text-[11px] text-slate-600 font-bold">المطلوب للخزنة:</span>
                            <span className="text-sm font-black text-blue-700" dir="ltr">
                              {formatCurrency(checkedCash)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* جدول شحنات المندوب للتحديد */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3 text-center w-8">
                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    selectedHandoverShipmentIds.size ===
                                    selectedCourierForHandover.shipments.length
                                  ) {
                                    setSelectedHandoverShipmentIds(new Set());
                                  } else {
                                    setSelectedHandoverShipmentIds(
                                      new Set(selectedCourierForHandover.shipments.map((s) => s.id)),
                                    );
                                  }
                                }}
                                className="cursor-pointer"
                              >
                                {selectedHandoverShipmentIds.size ===
                                selectedCourierForHandover.shipments.length ? (
                                  <CheckSquare size={15} className="text-blue-600" />
                                ) : (
                                  <Square size={15} />
                                )}
                              </button>
                            </th>
                            <th className="py-2 px-3">رقم البوليصة</th>
                            <th className="py-2 px-3">المستلم</th>
                            <th className="py-2 px-3">الحالة</th>
                            <th className="py-2 px-3 text-left">المحصل بيد المندوب</th>
                            <th className="py-2 px-3 text-left">عمولة المندوب</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedCourierForHandover.shipments.map((s) => {
                            const isChecked = selectedHandoverShipmentIds.has(s.id);
                            return (
                              <tr key={s.id} className="hover:bg-slate-50">
                                <td className="py-2 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedHandoverShipmentIds((prev) => {
                                        const copy = new Set(prev);
                                        if (copy.has(s.id)) copy.delete(s.id);
                                        else copy.add(s.id);
                                        return copy;
                                      });
                                    }}
                                    className="cursor-pointer"
                                  >
                                    {isChecked ? (
                                      <CheckSquare size={15} className="text-blue-600" />
                                    ) : (
                                      <Square size={15} />
                                    )}
                                  </button>
                                </td>
                                <td className="py-2 px-3 font-mono font-bold text-blue-800" dir="ltr">
                                  {s.awb_number}
                                </td>
                                <td className="py-2 px-3">
                                  <div className="font-medium text-slate-800">{s.recipient_name}</div>
                                  <div className="mt-0.5">
                                    {isDateBeforeToday(s.updated_at || s.created_at) ? (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                        ⚠️ متأخرة ({formatArabicDate(s.updated_at || s.created_at)})
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        اليوم ({formatArabicDate(s.updated_at || s.created_at)})
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2 px-3">
                                  <span className="text-[10px] font-bold">
                                    {SHIPMENT_STATUS_LABELS[s.status]}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-left font-bold text-emerald-700" dir="ltr">
                                  {formatCurrency(Number(s.collected_cash))}
                                </td>
                                <td className="py-2 px-3 text-left text-amber-700 font-bold" dir="ltr">
                                  {formatCurrency(getShipmentCommission(s))}
                                  {Number(s.courier_commission) === 0 && Number(s.zones?.courier_commission) > 0 && (
                                    <span className="text-[9px] text-amber-600 block font-normal">(عمولة المنطقة)</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedCourierForHandover(null)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmHandover}
                      disabled={submittingHandover || selectedHandoverShipmentIds.size === 0}
                      className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50 shadow-sm cursor-pointer ${
                        handoverSettlementChoice === 'SETTLE_BOTH'
                          ? 'bg-emerald-600 hover:bg-emerald-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      <CheckCircle size={15} />
                      <span>
                        {submittingHandover
                          ? 'جاري التوريد...'
                          : handoverSettlementChoice === 'SETTLE_BOTH'
                          ? `تأكيد استلام الصافي (${formatCurrency(netToReceive)}) وتسوية العمولات (${selectedHandoverShipmentIds.size} شحنة)`
                          : `تأكيد استلام كامل الكاش (${formatCurrency(checkedCash)}) وتأجيل العمولات (${selectedHandoverShipmentIds.size} شحنة)`}
                      </span>
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* نافذة صرف وتسوية العمولات المستحقة للمندوب (Courier Commission Settlement Modal) */}
      {/* ==================================================================== */}
      {courierForCommissionSettlement && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-6 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-700 text-white shrink-0">
              <div>
                <h3 className="font-black text-base">
                  صرف وتسوية العمولات المستحقة: {courierForCommissionSettlement.courier.name}
                </h3>
                <p className="text-xs text-emerald-100">
                  صرف العمولات المتبقية للشحنات المنجزة وتصفير مديونية المندوب
                </p>
              </div>
              <button
                onClick={() => setCourierForCommissionSettlement(null)}
                className="p-1.5 text-white/80 hover:text-white rounded-lg cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* بطاقات الملخص */}
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                  <span className="text-xs text-emerald-800 font-bold block mb-1">
                    إجمالي العمولة المستحقة للصرف
                  </span>
                  <span className="text-2xl font-black text-emerald-700" dir="ltr">
                    {formatCurrency(courierForCommissionSettlement.pendingCommissions)}
                  </span>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="text-xs text-slate-600 font-bold block mb-1">
                    عدد الشحنات المنجزة المؤهلة
                  </span>
                  <span className="text-2xl font-black text-slate-800">
                    {courierForCommissionSettlement.commissionShipments.length}
                  </span>
                  <span className="text-xs text-slate-400 mr-1.5">شحنة</span>
                </div>
              </div>

              {/* تنبيه توضيحي */}
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-start gap-2.5">
                <AlertCircle size={18} className="shrink-0 text-blue-600 mt-0.5" />
                <div className="leading-relaxed">
                  عند تأكيد الصرف، سيتم تسجيل صرف العمولات وتحديث حالة الشحنات إلى عمولات مصروفة بالكامل (<span className="font-mono font-bold">is_courier_commission_settled = true</span>) وتنتقل إلى سجل العمولات المصروفة سابقاً.
                </div>
              </div>

              {/* قائمة الشحنات المشمولة */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">رقم البوليصة</th>
                      <th className="py-2.5 px-3">المستلم</th>
                      <th className="py-2.5 px-3">حالة الشحنة</th>
                      <th className="py-2.5 px-3 text-left">الكاش المحصل</th>
                      <th className="py-2.5 px-3 text-left">العمولة المستحقة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {courierForCommissionSettlement.commissionShipments.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-800" dir="ltr">
                          {s.awb_number}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-800">{s.recipient_name}</div>
                          <div className="mt-0.5">
                            {isDateBeforeToday(s.updated_at || s.created_at) ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                ⚠️ متأخرة ({formatArabicDate(s.updated_at || s.created_at)})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                اليوم ({formatArabicDate(s.updated_at || s.created_at)})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-[10px] font-bold">
                            {SHIPMENT_STATUS_LABELS[s.status]}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-left font-bold text-slate-700" dir="ltr">
                          {formatCurrency(Number(s.collected_cash))}
                        </td>
                        <td className="py-2.5 px-3 text-left text-emerald-700 font-bold" dir="ltr">
                          {formatCurrency(getShipmentCommission(s))}
                          {Number(s.courier_commission) === 0 && Number(s.zones?.courier_commission) > 0 && (
                            <span className="text-[9px] text-amber-600 block font-normal">(حسب عمولة المنطقة)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setCourierForCommissionSettlement(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmCommissionSettlement}
                disabled={submittingCommissionSettlement || courierForCommissionSettlement.commissionShipments.length === 0}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-50 shadow-sm cursor-pointer"
              >
                <CheckCircle size={15} />
                <span>
                  {submittingCommissionSettlement
                    ? 'جاري صرف وتسوية العمولات...'
                    : `تأكيد صرف العمولات (${formatCurrency(courierForCommissionSettlement.pendingCommissions)}) وتصفير الحساب`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* نافذة إصدار كشف تسوية تاجر جديد (New Merchant Settlement Modal) */}
      {/* ==================================================================== */}
      {selectedMerchantForSettlement && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-6 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-600 text-white shrink-0">
              <div>
                <h3 className="font-black text-base">
                  إصدار كشف تسوية وصرف مستحقات: {selectedMerchantForSettlement.merchant.brand_name}
                </h3>
                <p className="text-xs text-emerald-100">
                  تصفية حسابات الشحنات المنتهية، خصم مصاريف الشحن، وتوثيق التحويل
                </p>
              </div>
              <button
                onClick={() => setSelectedMerchantForSettlement(null)}
                className="p-1.5 text-white/80 hover:text-white rounded-lg cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmSettlement} className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* ملخص الحسبة للشحنات المحددة */}
              {(() => {
                const checkedShipments = selectedMerchantForSettlement.shipments.filter((s) =>
                  selectedSettlementShipmentIds.has(s.id),
                );
                const curCod = checkedShipments.reduce(
                  (sum, s) => sum + (Number(s.collected_cash) || 0),
                  0,
                );
                const curShipping = checkedShipments.reduce(
                  (sum, s) => sum + (Number(s.shipping_fee) || 0),
                  0,
                );
                const curNet = checkedShipments.reduce(
                  (sum, s) => sum + (Number(s.merchant_net_amount) || 0),
                  0,
                );

                return (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-3 gap-3 text-center text-xs">
                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                      <span className="text-slate-500 block mb-1">إجمالي التحصيل (COD)</span>
                      <span className="font-black text-sm text-slate-900" dir="ltr">
                        {formatCurrency(curCod)}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                      <span className="text-slate-500 block mb-1">رسوم الشحن المخصومة</span>
                      <span className="font-black text-sm text-amber-700" dir="ltr">
                        -{formatCurrency(curShipping)}
                      </span>
                    </div>

                    <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-300">
                      <span className="text-emerald-800 block mb-1 font-bold">
                        صافي المبلغ المستحق للتاجر
                      </span>
                      <span className="font-black text-base text-emerald-800" dir="ltr">
                        {formatCurrency(curNet)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* بيانات طريقة الدفع والتحويل */}
              <div className="grid sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    طريقة صرف المستحقات <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={settlementPaymentMethod}
                    onChange={(e) => setSettlementPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
                  >
                    <option value="INSTAPAY">إنستاباي (InstaPay)</option>
                    <option value="WALLET">محفظة إلكترونية (فودافون كاش...)</option>
                    <option value="CASH">نقدي (استلام من مقر الشركة)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    رقم مرجع التحويل / المعاملة
                  </label>
                  <input
                    type="text"
                    placeholder="رقم عملية التحويل البنكي أو المحفظة..."
                    value={settlementRef}
                    onChange={(e) => setSettlementRef(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ملاحظات التسوية
                  </label>
                  <input
                    type="text"
                    placeholder="أي ملاحظات خاصة بالتسوية..."
                    value={settlementNotes}
                    onChange={(e) => setSettlementNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                  />
                </div>
              </div>

              {/* جدول شحنات التاجر للتحديد */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700">
                    حدد الشحنات المطلوب تضمينها في هذا الكشف ({selectedSettlementShipmentIds.size} محددة):
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        selectedSettlementShipmentIds.size ===
                        selectedMerchantForSettlement.shipments.length
                      ) {
                        setSelectedSettlementShipmentIds(new Set());
                      } else {
                        setSelectedSettlementShipmentIds(
                          new Set(selectedMerchantForSettlement.shipments.map((s) => s.id)),
                        );
                      }
                    }}
                    className="text-xs text-blue-600 hover:underline cursor-pointer"
                  >
                    {selectedSettlementShipmentIds.size ===
                    selectedMerchantForSettlement.shipments.length
                      ? 'إلغاء تحديد الكل'
                      : 'تحديد كافة الشحنات'}
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="py-2 px-3 text-center w-8">#</th>
                        <th className="py-2 px-3">رقم البوليصة</th>
                        <th className="py-2 px-3">المستلم</th>
                        <th className="py-2 px-3">الحالة</th>
                        <th className="py-2 px-3 text-left">المحصل (COD)</th>
                        <th className="py-2 px-3 text-left">سعر الشحن</th>
                        <th className="py-2 px-3 text-left">صافي التاجر</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedMerchantForSettlement.shipments.map((s) => {
                        const isChecked = selectedSettlementShipmentIds.has(s.id);
                        return (
                          <tr key={s.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSettlementShipmentIds((prev) => {
                                    const copy = new Set(prev);
                                    if (copy.has(s.id)) copy.delete(s.id);
                                    else copy.add(s.id);
                                    return copy;
                                  });
                                }}
                                className="cursor-pointer"
                              >
                                {isChecked ? (
                                  <CheckSquare size={15} className="text-emerald-600" />
                                ) : (
                                  <Square size={15} />
                                )}
                              </button>
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-blue-800" dir="ltr">
                              {s.awb_number}
                            </td>
                            <td className="py-2 px-3">
                              <div className="font-medium text-slate-800">{s.recipient_name}</div>
                              <div className="mt-0.5">
                                {isDateBeforeToday(s.updated_at || s.created_at) ? (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                    ⚠️ متأخرة ({formatArabicDate(s.updated_at || s.created_at)})
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    اليوم ({formatArabicDate(s.updated_at || s.created_at)})
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3">
                              <span className="text-[10px] font-bold">
                                {SHIPMENT_STATUS_LABELS[s.status]}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-left font-bold text-slate-900" dir="ltr">
                              {formatCurrency(Number(s.collected_cash))}
                            </td>
                            <td className="py-2 px-3 text-left font-bold text-amber-700" dir="ltr">
                              -{formatCurrency(Number(s.shipping_fee))}
                            </td>
                            <td
                              className={`py-2 px-3 text-left font-bold ${
                                Number(s.merchant_net_amount) >= 0
                                  ? 'text-emerald-700'
                                  : 'text-red-600'
                              }`}
                              dir="ltr"
                            >
                              {formatCurrency(Number(s.merchant_net_amount))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* أزرار الحفظ */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between -mx-6 -mb-6 mt-6">
                <button
                  type="button"
                  onClick={() => setSelectedMerchantForSettlement(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingSettlement || selectedSettlementShipmentIds.size === 0}
                  className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-50 shadow-md cursor-pointer"
                >
                  <Receipt size={16} />
                  <span>
                    {submittingSettlement
                      ? 'جاري الاعتماد...'
                      : `اعتماد كشف التسوية وصرف المستحقات (${selectedSettlementShipmentIds.size} شحنة)`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* نافذة طباعة كشف التسوية الرسمي A4 */}
      {/* ==================================================================== */}
      {viewingSettlement && (
        <PrintSettlementModal
          settlement={viewingSettlement}
          onClose={() => setViewingSettlement(null)}
        />
      )}
    </div>
  );
}
