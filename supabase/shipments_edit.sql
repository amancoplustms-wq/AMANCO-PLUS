ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS is_courier_commission_settled BOOLEAN NOT NULL DEFAULT false;