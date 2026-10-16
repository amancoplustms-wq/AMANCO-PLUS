-- ============================================================================
-- AMANCO PLUS TMS (أمانكو بلس للشحن) - SUPABASE COMPLETE SCHEMA
-- ============================================================================

-- 1. تفعيل الإضافات المطلوبة
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. إنشاء الأنواع الثابتة (ENUMS)
CREATE TYPE governorate_enum AS ENUM ('القاهرة', 'الجيزة', 'القليوبية');

CREATE TYPE shipment_type_enum AS ENUM (
  'NORMAL',    -- تحصيل نقدي عادي (COD)
  'PREPAID',   -- مدفوعة مسبقاً بدون تحصيل من المستلم
  'EXCHANGE'   -- شحنة استبدال (تسليم طرد مقابل استلام طرد آخر)
);

CREATE TYPE shipment_status_enum AS ENUM (
  'PICKUP_REQUESTED',  -- طلب استلام من مقر التاجر
  'AT_HUB',            -- تم الاستلام بالمخزن الرئيسي
  'OUT_FOR_DELIVERY',  -- خرجت للتسليم مع المندوب
  'DELIVERED',         -- تم التسليم الكامل
  'PARTIAL_DELIVERED', -- تسليم جزئي (استلام جزء وإرجاع الباقي)
  'EXCHANGED',         -- تم التسليم والاستبدال
  'POSTPONED',         -- مؤجلة
  'RETURNED'           -- مرتجع / مرفوضة
);

CREATE TYPE return_fee_bearer_enum AS ENUM (
  'NONE',              -- لا يوجد (الشحنة ليست مرتجعاً أو مرتجع مجاني)
  'CLIENT_PAID',       -- تم تحصيل الشحن من العميل نقداً عند الرفض
  'MERCHANT_DEDUCTED'  -- يُحمل سعر الشحن خصماً على حساب التاجر
);

CREATE TYPE payment_method_enum AS ENUM (
  'CASH',      -- نقدي
  'INSTAPAY',  -- إنستاباي
  'WALLET'     -- محفظة إلكترونية (فودافون كاش وغيرها)
);

-- ============================================================================
-- 3. الجداول الأساسية (TABLES)
-- ============================================================================

-- أ) جدول المناطق والتسعير العام وعمولة المندوب
CREATE TABLE public.zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  governorate governorate_enum NOT NULL,
  name TEXT NOT NULL, -- مثال: مدينة نصر، المهندسين، شبرا الخيمة
  base_shipping_fee NUMERIC(10, 2) NOT NULL DEFAULT 50.00, -- سعر الشحن العام
  courier_commission NUMERIC(10, 2) NOT NULL DEFAULT 20.00, -- عمولة المندوب المتغيرة حسب المنطقة
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ب) جدول التجار المتعاقدين
CREATE TABLE public.merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp TEXT,
  pickup_address TEXT NOT NULL,
  governorate governorate_enum NOT NULL DEFAULT 'القاهرة',
  is_vip BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ج) جدول قوائم الأسعار المخصصة للتجار (VIP Custom Rates)
CREATE TABLE public.merchant_vip_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  custom_shipping_fee NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, zone_id)
);

-- د) جدول مناديب الشحن
CREATE TABLE public.couriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp TEXT,
  national_id TEXT,
  default_zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- هـ) جدول كشوف تسوية حسابات التجار
CREATE TABLE public.merchant_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_code TEXT UNIQUE NOT NULL, -- مثال: STL-1001
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE RESTRICT,
  total_cod_collected NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_shipping_deducted NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_payout_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_method payment_method_enum NOT NULL DEFAULT 'CASH',
  transfer_reference TEXT, -- رقم عملية إنستاباي أو المحفظة
  notes TEXT,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- و) جدول الشحنات والبوالص (الجدول المركزي)
CREATE TABLE public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  awb_number TEXT UNIQUE NOT NULL, -- رقم البوليصة مثال: AMC-100001
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE RESTRICT,
  courier_id UUID REFERENCES public.couriers(id) ON DELETE SET NULL,
  zone_id UUID NOT NULL REFERENCES public.zones(id) ON DELETE RESTRICT,
  
  -- بيانات المستلم
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  recipient_phone_alt TEXT,
  recipient_address TEXT NOT NULL,
  
  -- تفاصيل الطرد والخصائص الخاصة
  package_description TEXT NOT NULL,
  pieces_count INT NOT NULL DEFAULT 1,
  shipment_type shipment_type_enum NOT NULL DEFAULT 'NORMAL',
  allow_open_package BOOLEAN NOT NULL DEFAULT true, -- مسموح / غير مسموح بفتح الشحنة
  exchange_instructions TEXT, -- تفاصيل الطرد المرتجع في حالة الاستبدال
  partial_delivery_notes TEXT, -- تفاصيل الجزء المستلم والمرتجع في التسليم الجزئي
  
  -- الحالة الحالية
  status shipment_status_enum NOT NULL DEFAULT 'PICKUP_REQUESTED',
  
  -- الحسابات المالية للشحنة
  expected_cod NUMERIC(10, 2) NOT NULL DEFAULT 0.00, -- المبلغ المطلوب تحصيله من العميل
  collected_cash NUMERIC(10, 2) NOT NULL DEFAULT 0.00, -- المبلغ المحصل فعلياً بيد المندوب
  shipping_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00, -- سعر الشحن المحسوب (عام أو VIP)
  return_fee_bearer return_fee_bearer_enum NOT NULL DEFAULT 'NONE',
  courier_commission NUMERIC(10, 2) NOT NULL DEFAULT 0.00, -- عمولة المندوب المستحقة
  merchant_net_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00, -- صافي مستحقات التاجر من الشحنة
  
  -- حالة التقفيل المالي
  is_courier_cash_settled BOOLEAN NOT NULL DEFAULT false, -- هل المندوب ورد الكاش للخزنة؟
  settlement_id UUID REFERENCES public.merchant_settlements(id) ON DELETE SET NULL, -- هل تحاسب عليها التاجر؟
  
  delivery_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ز) جدول سجل تتبع حركات الشحنة (Timeline)
CREATE TABLE public.shipment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  status shipment_status_enum NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ح) جدول طلبات انضمام التجار الجدد من الموقع التعريفي
CREATE TABLE public.merchant_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  governorate governorate_enum NOT NULL DEFAULT 'القاهرة',
  expected_daily_orders TEXT,
  is_contacted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. توليد رقم البوليصة (AWB) تلقائياً + تسجيل أول حدث تتبع
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS awb_seq START 100101;

CREATE OR REPLACE FUNCTION public.handle_new_shipment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.awb_number IS NULL OR NEW.awb_number = '' THEN
    NEW.awb_number := 'AMC-' || nextval('awb_seq')::TEXT;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_awb
BEFORE INSERT ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.handle_new_shipment();

CREATE OR REPLACE FUNCTION public.log_initial_shipment_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.shipment_events (shipment_id, status, title, notes)
  VALUES (NEW.id, NEW.status, 'تم تسجيل الشحنة بالنظام', 'بانتظار الاستلام والفرز');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_initial_event
AFTER INSERT ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.log_initial_shipment_event();

-- ============================================================================
-- 5. دالة التتبع العام للزوار برقم البوليصة (آمنة بدون كشف بيانات التاجر السرية)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.track_shipment_by_awb(p_awb TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'awb_number', s.awb_number,
    'status', s.status,
    'recipient_name', s.recipient_name,
    'governorate', z.governorate,
    'zone_name', z.name,
    'shipment_type', s.shipment_type,
    'allow_open_package', s.allow_open_package,
    'expected_cod', s.expected_cod,
    'created_at', s.created_at,
    'events', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'status', e.status,
          'title', e.title,
          'notes', e.notes,
          'created_at', e.created_at
        ) ORDER BY e.created_at DESC
      )
      FROM public.shipment_events e
      WHERE e.shipment_id = s.id
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM public.shipments s
  JOIN public.zones z ON z.id = s.zone_id
  WHERE UPPER(TRIM(s.awb_number)) = UPPER(TRIM(p_awb));

  RETURN v_result;
END;
$$;

-- ============================================================================
-- 6. سياسات الأمان (Row Level Security - RLS)
-- ============================================================================
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_vip_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_leads ENABLE ROW LEVEL SECURITY;

-- السماح للزوار (anon) بقراءة المناطق الفعالة وتقديم طلب تعاقد تاجر جديد فقط
CREATE POLICY "Public can view active zones" ON public.zones
  FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "Public can submit merchant leads" ON public.merchant_leads
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- السماح للمدير العام المسجل دخوله (authenticated) بكامل الصلاحيات على جميع الجداول
CREATE POLICY "Admin full access zones" ON public.zones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access merchants" ON public.merchants FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access vip_rates" ON public.merchant_vip_rates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access couriers" ON public.couriers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access settlements" ON public.merchant_settlements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access shipments" ON public.shipments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access events" ON public.shipment_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access leads" ON public.merchant_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 7. بيانات أولية لمحافظات التغطية (القاهرة، الجيزة، القليوبية)ٍ
-- ============================================================================
INSERT INTO public.zones (governorate, name, base_shipping_fee, courier_commission) VALUES
  ('القاهرة', 'مدينة نصر ومصر الجديدة', 55.00, 20.00),
  ('القاهرة', 'وسط البلد والعباسية', 50.00, 20.00),
  ('القاهرة', 'المعادي والمقطم', 60.00, 25.00),
  ('القاهرة', 'التجمع الخامس والقاهرة الجديدة', 65.00, 25.00),
  ('القاهرة', 'حلوان و15 مايو', 70.00, 30.00),
  ('الجيزة', 'الدقي والمهندسين والعجوزة', 55.00, 20.00),
  ('الجيزة', 'الهرم وفيصل', 60.00, 22.00),
  ('الجيزة', '6 أكتوبر والشيخ زايد', 70.00, 30.00),
  ('القليوبية', 'شبرا الخيمة', 60.00, 25.00),
  ('القليوبية', 'العبور والخانكة', 70.00, 30.00),
  ('القليوبية', 'بنها وقليوب', 75.00, 30.00);