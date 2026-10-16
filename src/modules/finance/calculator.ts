// أمانكو بلس للشحن والتوريد (AMANCO PLUS) - المحرك المالي والتشغيلي
// دوال TypeScript نقية بدون أي تبعية خارجية
// ============================================================================

import type {
  ShipmentStatus,
  ShipmentType,
  ReturnFeeBearer,
} from '@/types/database';

// ---- المدخلات والمخرجات ----

/** المعلومات المطلوبة لتحديد سعر شحن المنطقة */
export interface ShippingFeeInput {
  /** سعر الشحن الأساسي للمنطقة من جدول zones */
  zoneBaseShippingFee: number;
  /** سعر الشحن المخصص للتاجر VIP (إن وجد) من جدول merchant_vip_rates */
  merchantVipFee: number | null;
}

/** المعلومات المطلوبة لحساب الحسبة المالية الكاملة للشحنة */
export interface ShipmentFinancialsInput {
  /** نوع الشحنة: NORMAL, PREPAID, EXCHANGE */
  shipmentType: ShipmentType;
  /** حالة الشحنة الحالية */
  status: ShipmentStatus;
  /** المبلغ المتوقع تحصيله من العميل (COD) */
  expectedCod: number;
  /** سعر الشحن المحسوب (من resolveShippingFee) */
  shippingFee: number;
  /** عمولة المندوب من جدول zones */
  zoneCourierCommission: number;
  /** عمولة المندوب المحفوظة في الشحنة نفسها (الأولوية لها إذا كانت > 0) */
  courierCommissionOverride?: number;
  /** مَن يتحمل سعر الشحن في حالة المرتجع */
  returnFeeBearer: ReturnFeeBearer;
  /** ملاحظات التسليم الجزئي (المبلغ المحصل فعلياً يحتاج تمريره يدوياً) */
  partialCollectedCash?: number;
}

/** نتيجة الحسبة المالية الكاملة */
export interface ShipmentFinancialsResult {
  /** المبلغ المحصل فعلياً بيد المندوب من العميل */
  collectedCash: number;
  /** عمولة المندوب المستحقة */
  courierCommission: number;
  /** صافي مستحقات التاجر من الشحنة (سالب = مديونية على التاجر) */
  merchantNetAmount: number;
}

// ---- الدوال الأساسية ----

/**
 * يحدد سعر الشحن النهائي للمنطقة:
 * - إن كان التاجر لديه سعر VIP مخصص للمنطقة → يُستخدم.
 * - وإلا → يُستخدم السعر الأساسي العام للمنطقة.
 */
export function resolveShippingFee(input: ShippingFeeInput): number {
  if (input.merchantVipFee !== null && input.merchantVipFee !== undefined) {
    return input.merchantVipFee;
  }
  return input.zoneBaseShippingFee;
}

/**
 * يحسب الحسبة المالية الكاملة لشحنة واحدة بناءً على حالتها ونوعها.
 *
 * ---- القواعد المالية ----
 *
 * 1. التسليم الكامل (DELIVERED / EXCHANGED):
 *    - NORMAL:  collectedCash = expectedCod
 *               courierCommission = zoneCourierCommission
 *               merchantNet = expectedCod - shippingFee
 *    - PREPAID: collectedCash = 0 (لا يوجد تحصيل)
 *               courierCommission = zoneCourierCommission
 *               merchantNet = -shippingFee (خصم فقط)
 *
 * 2. التسليم الجزئي (PARTIAL_DELIVERED):
 *    - collectedCash = partialCollectedCash (المبلغ الفعلي من المندوب)
 *    - courierCommission = zoneCourierCommission
 *    - merchantNet = partialCollectedCash - shippingFee
 *
 * 3. المرتجع (RETURNED):
 *    أ) CLIENT_PAID (العميل دفع الشحن):
 *       collectedCash = shippingFee (المندوب حصّل مصاريف الشحن فقط)
 *       courierCommission = zoneCourierCommission
 *       merchantNet = 0 (لا مستحقات ولا خصومات)
 *    ب) MERCHANT_DEDUCTED (الشحن على التاجر):
 *       collectedCash = 0
 *       courierCommission = zoneCourierCommission
 *       merchantNet = -shippingFee (خصم من التاجر)
 *    ج) NONE (مرتجع مجاني):
 *       collectedCash = 0
 *       courierCommission = 0
 *       merchantNet = 0
 *
 * 4. الحالات التشغيلية (PICKUP_REQUESTED, AT_HUB, OUT_FOR_DELIVERY, POSTPONED):
 *    - لا حسابات مالية (كل شيء = 0).
 */
export function calculateShipmentFinancials(
  input: ShipmentFinancialsInput,
): ShipmentFinancialsResult {
  const {
    shipmentType,
    status,
    expectedCod,
    shippingFee,
    zoneCourierCommission,
    courierCommissionOverride,
    returnFeeBearer,
    partialCollectedCash,
  } = input;

  // تحديد عمولة المندوب الفعلية: الأولوية للقيمة المحفوظة في الشحنة إذا كانت > 0
  const effectiveCourierCommission =
    courierCommissionOverride !== undefined && courierCommissionOverride > 0
      ? courierCommissionOverride
      : zoneCourierCommission;

  // الحالات التشغيلية (لا حسابات مالية)
  const operationalStatuses: ShipmentStatus[] = [
    'PICKUP_REQUESTED',
    'AT_HUB',
    'OUT_FOR_DELIVERY',
    'POSTPONED',
  ];

  if (operationalStatuses.includes(status)) {
    return {
      collectedCash: 0,
      courierCommission: 0,
      merchantNetAmount: 0,
    };
  }

  // ---- التسليم الكامل أو الاستبدال ----
  if (status === 'DELIVERED' || status === 'EXCHANGED') {
    if (shipmentType === 'PREPAID') {
      // مدفوعة مسبقاً: لا تحصيل من العميل
      return {
        collectedCash: 0,
        courierCommission: effectiveCourierCommission,
        merchantNetAmount: -shippingFee,
      };
    }
    // NORMAL أو EXCHANGE: تحصيل عادي
    return {
      collectedCash: expectedCod,
      courierCommission: effectiveCourierCommission,
      merchantNetAmount: expectedCod - shippingFee,
    };
  }

  // ---- التسليم الجزئي ----
  if (status === 'PARTIAL_DELIVERED') {
    const collected = partialCollectedCash ?? 0;
    return {
      collectedCash: collected,
      courierCommission: effectiveCourierCommission,
      merchantNetAmount: collected - shippingFee,
    };
  }

  // ---- المرتجع ----
  if (status === 'RETURNED') {
    switch (returnFeeBearer) {
      case 'CLIENT_PAID':
        // العميل دفع مصاريف الشحن نقداً عند الرفض
        return {
          collectedCash: shippingFee,
          courierCommission: effectiveCourierCommission,
          merchantNetAmount: 0,
        };

      case 'MERCHANT_DEDUCTED':
        // الشحن يتحمله التاجر كخصم
        return {
          collectedCash: 0,
          courierCommission: effectiveCourierCommission,
          merchantNetAmount: -shippingFee,
        };

      case 'NONE':
      default:
        // مرتجع مجاني بدون أي رسوم
        return {
          collectedCash: 0,
          courierCommission: 0,
          merchantNetAmount: 0,
        };
    }
  }

  // حالة غير متوقعة (حماية إضافية)
  return {
    collectedCash: 0,
    courierCommission: 0,
    merchantNetAmount: 0,
  };
}

// ---- دوال مساعدة للتواصل ----

/** رقم تواصل إدارة الشركة */
const COMPANY_PHONE = '01274365996';

/**
 * ينشئ رابط WhatsApp للمراسلة السريعة.
 * @param phone - رقم الهاتف (مصري بدون كود الدولة)
 * @param message - نص الرسالة (اختياري)
 */
export function buildWhatsAppLink(
  phone: string = COMPANY_PHONE,
  message?: string,
): string {
  // تطبيع الرقم: إزالة المسافات والشرطات، وإضافة كود مصر 20
  const cleaned = phone.replace(/[\s\-()]/g, '');
  const international = cleaned.startsWith('0')
    ? `2${cleaned}`
    : cleaned.startsWith('+')
      ? cleaned.slice(1)
      : cleaned.startsWith('20')
        ? cleaned
        : `20${cleaned}`;

  const base = `https://wa.me/${international}`;
  if (message) {
    return `${base}?text=${encodeURIComponent(message)}`;
  }
  return base;
}

/**
 * ينشئ رابط اتصال هاتفي مباشر (tel:).
 * @param phone - رقم الهاتف
 */
export function buildTelLink(phone: string = COMPANY_PHONE): string {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  return `tel:${cleaned}`;
}

/**
 * ينسّق مبلغ مالي بالجنيه المصري.
 */
export function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
}

// ============================================================================
// أدوات ودوال الفلترة بالتواريخ وجرد اليومية (Date Filtering & Daily Closing)
// ============================================================================

export type DateFilterType = 'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all';

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

/**
 * يعيد كائن مجال زمني (start, end) بناءً على نوع الفلتر والمدخلات.
 */
export function getDateRange(
  filterType: DateFilterType,
  customStart?: string,
  customEnd?: string,
): DateRange {
  const now = new Date();

  if (filterType === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end };
  }

  if (filterType === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
    const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
    return { start, end };
  }

  if (filterType === 'week') {
    // الأسبوع الحالي يبدأ من السبت
    const day = now.getDay();
    const diffToSaturday = (day + 1) % 7;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - diffToSaturday);
    const start = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end };
  }

  if (filterType === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  if (filterType === 'custom') {
    const start = customStart ? new Date(`${customStart}T00:00:00`) : null;
    const end = customEnd ? new Date(`${customEnd}T23:59:59.999`) : null;
    return { start, end };
  }

  return { start: null, end: null }; // 'all'
}

/**
 * يتحقق إن كان التاريخ يقع ضمن النطاق الزمني المحدد.
 */
export function isDateInRange(
  dateStr: string | null | undefined,
  range: DateRange,
): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  if (range.start && d < range.start) return false;
  if (range.end && d > range.end) return false;
  return true;
}

/**
 * يتحقق إن كان التاريخ يسبق بداية اليوم الحالي (أي متأخر من يوم سابق).
 */
export function isDateBeforeToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return d < startOfToday;
}

/**
 * تنسيق التاريخ بالعربية بصيغة مقروءة وواضحة (مثل: 12 أكتوبر 2026).
 */
export function formatArabicDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * تنسيق التاريخ والوقت بالعربية بصيغة مقروءة ودقيقة.
 */
export function formatArabicDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const dateFormatted = d.toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeFormatted = d.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${dateFormatted} - ${timeFormatted}`;
}

/**
 * توليد كود تسوية مندوب فريد (مثال: CSL-261015-1042)
 */
export function generateCourierSettlementCode(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `CSL-${yy}${mm}${dd}-${rand}`;
}

