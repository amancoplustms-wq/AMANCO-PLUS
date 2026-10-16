// أمانكو بلس للشحن والتوريد (AMANCO PLUS TMS) - تعريفات TypeScript المطابقة لجداول Supabase

// ---- الأنواع الثابتة (ENUMS) ----

export type Governorate = 'القاهرة' | 'الجيزة' | 'القليوبية';

export type ShipmentType = 'NORMAL' | 'PREPAID' | 'EXCHANGE';

export type ShipmentStatus =
  | 'PICKUP_REQUESTED'
  | 'AT_HUB'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'PARTIAL_DELIVERED'
  | 'EXCHANGED'
  | 'POSTPONED'
  | 'RETURNED';

export type ReturnFeeBearer = 'NONE' | 'CLIENT_PAID' | 'MERCHANT_DEDUCTED';

export type PaymentMethod = 'CASH' | 'INSTAPAY' | 'WALLET';

// ---- خرائط عرض الأنواع بالعربي ----

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  PICKUP_REQUESTED: 'طلب استلام',
  AT_HUB: 'بالمخزن',
  OUT_FOR_DELIVERY: 'خرجت للتسليم',
  DELIVERED: 'تم التسليم',
  PARTIAL_DELIVERED: 'تسليم جزئي',
  EXCHANGED: 'تم الاستبدال',
  POSTPONED: 'مؤجلة',
  RETURNED: 'مرتجع',
};

export const SHIPMENT_TYPE_LABELS: Record<ShipmentType, string> = {
  NORMAL: 'تحصيل عادي (COD)',
  PREPAID: 'مدفوعة مسبقاً',
  EXCHANGE: 'استبدال',
};

export const RETURN_FEE_BEARER_LABELS: Record<ReturnFeeBearer, string> = {
  NONE: 'لا يوجد',
  CLIENT_PAID: 'دفعها العميل نقداً',
  MERCHANT_DEDUCTED: 'خصم من التاجر',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'نقدي',
  INSTAPAY: 'إنستاباي',
  WALLET: 'محفظة إلكترونية',
};

export const GOVERNORATE_LABELS: Record<Governorate, string> = {
  القاهرة: 'القاهرة',
  الجيزة: 'الجيزة',
  القليوبية: 'القليوبية',
};

// ---- واجهات الجداول (Table Interfaces) ----

/** جدول المناطق والتسعير العام وعمولة المندوب */
export interface Zone {
  id: string;
  governorate: Governorate;
  name: string;
  base_shipping_fee: number;
  courier_commission: number;
  is_active: boolean;
  created_at: string;
}

/** جدول التجار المتعاقدين */
export interface Merchant {
  id: string;
  name: string;
  brand_name: string;
  phone: string;
  whatsapp: string | null;
  pickup_address: string;
  governorate: Governorate;
  is_vip: boolean;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

/** جدول قوائم الأسعار المخصصة للتجار VIP */
export interface MerchantVipRate {
  id: string;
  merchant_id: string;
  zone_id: string;
  custom_shipping_fee: number;
  created_at: string;
}

/** جدول مناديب الشحن */
export interface Courier {
  id: string;
  name: string;
  phone: string;
  whatsapp: string | null;
  national_id: string | null;
  default_zone_id: string | null;
  is_active: boolean;
  created_at: string;
}

/** جدول كشوف تسوية حسابات التجار */
export interface MerchantSettlement {
  id: string;
  settlement_code: string;
  merchant_id: string;
  total_cod_collected: number;
  total_shipping_deducted: number;
  net_payout_amount: number;
  payment_method: PaymentMethod;
  transfer_reference: string | null;
  notes: string | null;
  settled_at: string;
}

/** أنواع عمليات تسوية وتوريد عهد المناديب */
export type CourierSettlementType = 'NET_HANDOVER' | 'CASH_HANDOVER' | 'COMMISSION_PAYOUT';

export const COURIER_SETTLEMENT_TYPE_LABELS: Record<CourierSettlementType, string> = {
  NET_HANDOVER: 'توريد الصافي وتقفيل العمولة',
  CASH_HANDOVER: 'توريد كامل الكاش فقط',
  COMMISSION_PAYOUT: 'صرف وتسوية العمولات',
};

/** جدول سجل تسويات وتوريدات عهد وعمولات المناديب */
export interface CourierSettlement {
  id: string;
  settlement_code: string;
  courier_id: string;
  settlement_type: CourierSettlementType;
  shipments_count: number;
  total_cash_collected: number;
  total_commission_amount: number;
  net_treasury_amount: number;
  shipment_ids: string[];
  notes: string | null;
  settled_at: string;
}

/** جدول الشحنات والبوالص (الجدول المركزي) */
export interface Shipment {
  id: string;
  awb_number: string;
  merchant_id: string;
  courier_id: string | null;
  zone_id: string;

  // بيانات المستلم
  recipient_name: string;
  recipient_phone: string;
  recipient_phone_alt: string | null;
  recipient_address: string;

  // تفاصيل الطرد والخصائص الخاصة
  package_description: string;
  pieces_count: number;
  shipment_type: ShipmentType;
  allow_open_package: boolean;
  exchange_instructions: string | null;
  partial_delivery_notes: string | null;

  // الحالة الحالية
  status: ShipmentStatus;

  // الحسابات المالية
  expected_cod: number;
  collected_cash: number;
  shipping_fee: number;
  return_fee_bearer: ReturnFeeBearer;
  courier_commission: number;
  merchant_net_amount: number;

  // حالة التقفيل المالي
  is_courier_cash_settled: boolean;
  is_courier_commission_settled: boolean;
  settlement_id: string | null;

  delivery_notes: string | null;
  created_at: string;
  updated_at: string;
}

/** جدول سجل تتبع حركات الشحنة (Timeline) */
export interface ShipmentEvent {
  id: string;
  shipment_id: string;
  status: ShipmentStatus;
  title: string;
  notes: string | null;
  created_at: string;
}

/** جدول طلبات انضمام التجار الجدد من الموقع التعريفي */
export interface MerchantLead {
  id: string;
  contact_name: string;
  brand_name: string;
  phone: string;
  governorate: Governorate;
  expected_daily_orders: string | null;
  is_contacted: boolean;
  created_at: string;
}

// ---- أنواع دالة التتبع العام (RPC) ----

/** حدث تتبع فردي يعود من دالة track_shipment_by_awb */
export interface TrackingEvent {
  status: ShipmentStatus;
  title: string;
  notes: string | null;
  created_at: string;
}

/** نتيجة دالة track_shipment_by_awb الكاملة */
export interface TrackingResult {
  awb_number: string;
  status: ShipmentStatus;
  recipient_name: string;
  governorate: Governorate;
  zone_name: string;
  shipment_type: ShipmentType;
  allow_open_package: boolean;
  expected_cod: number;
  created_at: string;
  events: TrackingEvent[];
}

// ---- أنواع إنشاء / تحديث السجلات (Insert / Update DTOs) ----

export type ZoneInsert = Omit<Zone, 'id' | 'created_at'>;
export type ZoneUpdate = Partial<ZoneInsert>;

export type MerchantInsert = Omit<Merchant, 'id' | 'created_at'>;
export type MerchantUpdate = Partial<MerchantInsert>;

export type MerchantVipRateInsert = Omit<MerchantVipRate, 'id' | 'created_at'>;

export type CourierInsert = Omit<Courier, 'id' | 'created_at'>;
export type CourierUpdate = Partial<CourierInsert>;

export type ShipmentInsert = Omit<
  Shipment,
  'id' | 'awb_number' | 'created_at' | 'updated_at' | 'is_courier_commission_settled'
> & {
  is_courier_commission_settled?: boolean;
};
export type ShipmentUpdate = Partial<
  Omit<Shipment, 'id' | 'awb_number' | 'created_at'>
>;

export type MerchantLeadInsert = Omit<
  MerchantLead,
  'id' | 'is_contacted' | 'created_at'
>;

export type MerchantSettlementInsert = Omit<MerchantSettlement, 'id' | 'settled_at'> & {
  settled_at?: string;
};

export type CourierSettlementInsert = Omit<CourierSettlement, 'id' | 'settled_at'> & {
  settled_at?: string;
};
