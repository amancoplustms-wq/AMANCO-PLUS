-- فهارس تسريع البحث والفلترة لجدول الشحنات والتسويات (Performance Indexes)
CREATE INDEX IF NOT EXISTS idx_shipments_awb_number ON public.shipments (awb_number);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON public.shipments (status);
CREATE INDEX IF NOT EXISTS idx_shipments_merchant_id ON public.shipments (merchant_id);
CREATE INDEX IF NOT EXISTS idx_shipments_courier_id ON public.shipments (courier_id);
CREATE INDEX IF NOT EXISTS idx_shipments_zone_id ON public.shipments (zone_id);
CREATE INDEX IF NOT EXISTS idx_shipments_settlement_id ON public.shipments (settlement_id);
CREATE INDEX IF NOT EXISTS idx_shipments_cash_settled ON public.shipments (is_courier_cash_settled);
CREATE INDEX IF NOT EXISTS idx_shipments_comm_settled ON public.shipments (is_courier_commission_settled);
CREATE INDEX IF NOT EXISTS idx_shipments_created_at ON public.shipments (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment_id ON public.shipment_events (shipment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_merchant_settlements_merchant_id ON public.merchant_settlements (merchant_id, settled_at DESC);
CREATE INDEX IF NOT EXISTS idx_courier_settlements_courier_id ON public.courier_settlements (courier_id, settled_at DESC);