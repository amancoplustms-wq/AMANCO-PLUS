-- 1. إنشاء جدول سجل تسويات وتوريدات المناديب (Courier Settlements Log)
CREATE TABLE IF NOT EXISTS public.courier_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_code TEXT UNIQUE NOT NULL, -- مثال: CSL-261015-1001
  courier_id UUID NOT NULL REFERENCES public.couriers(id) ON DELETE RESTRICT,
  settlement_type TEXT NOT NULL, -- 'NET_HANDOVER' (توريد الصافي) | 'CASH_HANDOVER' (توريد كاش فقط) | 'COMMISSION_PAYOUT' (صرف عمولات فقط)
  shipments_count INT NOT NULL DEFAULT 0,
  total_cash_collected NUMERIC(12, 2) NOT NULL DEFAULT 0.00, -- إجمالي كاش الشحنات
  total_commission_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00, -- إجمالي عمولات الشحنات
  net_treasury_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00, -- الصافي المورد للخزنة (أو المنصرف للمندوب)
  shipment_ids JSONB NOT NULL DEFAULT '[]'::jsonb, -- مصفوفة أرقام الشحنات المشمولة في هذه التسوية المجمعة
  notes TEXT,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. تفعيل الأمان (RLS) لجدول تسويات المناديب
ALTER TABLE public.courier_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access courier_settlements" ON public.courier_settlements;
CREATE POLICY "Admin full access courier_settlements" ON public.courier_settlements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. ترحيل ذكي للعمولات التي تمت تصفيتها مسبقاً (الـ 110 ج.م الحالية) لتظهر فوراً في السجل الجديد
DO $$
DECLARE
  r RECORD;
  v_ids JSONB;
  v_cash NUMERIC;
  v_comm NUMERIC;
  v_cnt INT;
BEGIN
  FOR r IN SELECT id, name FROM public.couriers LOOP
    SELECT 
      COUNT(*),
      COALESCE(SUM(collected_cash), 0),
      COALESCE(SUM(courier_commission), 0),
      COALESCE(jsonb_agg(id), '[]'::jsonb)
    INTO v_cnt, v_cash, v_comm, v_ids
    FROM public.shipments
    WHERE courier_id = r.id 
      AND (is_courier_cash_settled = true OR is_courier_commission_settled = true);

    IF v_cnt > 0 AND NOT EXISTS (SELECT 1 FROM public.courier_settlements WHERE courier_id = r.id) THEN
      INSERT INTO public.courier_settlements (
        settlement_code, courier_id, settlement_type, shipments_count,
        total_cash_collected, total_commission_amount, net_treasury_amount, shipment_ids, notes
      ) VALUES (
        'CSL-INIT-' || floor(random() * 9000 + 1000)::text,
        r.id,
        'NET_HANDOVER',
        v_cnt,
        v_cash,
        v_comm,
        v_cash - v_comm,
        v_ids,
        'تسوية مجمعة مسجلة تلقائياً للشحنات المصفاة سابقاً'
      );
    END IF;
  END LOOP;
END $$;