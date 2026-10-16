'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  resolveShippingFee,
  formatCurrency,
} from '@/modules/finance/calculator';
import type {
  Merchant,
  Zone,
  Courier,
  Shipment,
  ShipmentType,
  ShipmentStatus,
  ShipmentInsert,
  ShipmentUpdate,
} from '@/types/database';
import {
  Package,
  X,
  AlertCircle,
  Calculator,
  User,
  MapPin,
  Truck,
  CheckCircle,
  HelpCircle,
  Crown,
  Lock,
} from 'lucide-react';

interface ShipmentFormModalProps {
  shipmentToEdit?: Shipment | null;
  merchants: Merchant[];
  zones: Zone[];
  couriers: Courier[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function ShipmentFormModal({
  shipmentToEdit,
  merchants,
  zones,
  couriers,
  onClose,
  onSuccess,
}: ShipmentFormModalProps) {
  const isEditing = Boolean(shipmentToEdit);
  const isFinanciallyLocked = Boolean(shipmentToEdit?.settlement_id);

  // Form Fields
  const [merchantId, setMerchantId] = useState(
    shipmentToEdit?.merchant_id || merchants[0]?.id || '',
  );
  const [zoneId, setZoneId] = useState(
    shipmentToEdit?.zone_id || zones[0]?.id || '',
  );
  const [courierId, setCourierId] = useState(shipmentToEdit?.courier_id || '');

  // المستلم
  const [recipientName, setRecipientName] = useState(
    shipmentToEdit?.recipient_name || '',
  );
  const [recipientPhone, setRecipientPhone] = useState(
    shipmentToEdit?.recipient_phone || '',
  );
  const [recipientPhoneAlt, setRecipientPhoneAlt] = useState(
    shipmentToEdit?.recipient_phone_alt || '',
  );
  const [recipientAddress, setRecipientAddress] = useState(
    shipmentToEdit?.recipient_address || '',
  );

  // تفاصيل الطرد
  const [packageDesc, setPackageDesc] = useState(
    shipmentToEdit?.package_description || 'ملابس / منتجات عامة',
  );
  const [piecesCount, setPiecesCount] = useState<number>(
    shipmentToEdit?.pieces_count || 1,
  );
  const [shipmentType, setShipmentType] = useState<ShipmentType>(
    shipmentToEdit?.shipment_type || 'NORMAL',
  );
  const [expectedCod, setExpectedCod] = useState<number>(
    shipmentToEdit ? Number(shipmentToEdit.expected_cod) : 0,
  );
  const [allowOpenPackage, setAllowOpenPackage] = useState<boolean>(
    shipmentToEdit ? shipmentToEdit.allow_open_package : true,
  );
  const [exchangeInstructions, setExchangeInstructions] = useState(
    shipmentToEdit?.exchange_instructions || '',
  );
  const [deliveryNotes, setDeliveryNotes] = useState(
    shipmentToEdit?.delivery_notes || '',
  );

  // الحالة الابتدائية
  const [initialStatus, setInitialStatus] = useState<ShipmentStatus>(
    shipmentToEdit?.status || 'PICKUP_REQUESTED',
  );

  // الحسابات المالية (الشحن وعمولة المندوب)
  const [shippingFee, setShippingFee] = useState<number>(
    shipmentToEdit ? Number(shipmentToEdit.shipping_fee) : 0,
  );
  const [courierCommission, setCourierCommission] = useState<number>(
    shipmentToEdit ? Number(shipmentToEdit.courier_commission) : 0,
  );
  const [isVipApplied, setIsVipApplied] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // احتساب سعر الشحن وعمولة المندوب تلقائياً عند تغيير التاجر أو المنطقة
  useEffect(() => {
    if (isEditing && shippingFee > 0) return; // عند التعديل نُبقي السعر المسجل مسبقاً إلا إذا تم تغييره

    const selectedZone = zones.find((z) => z.id === zoneId);
    if (!selectedZone) return;

    setCourierCommission(Number(selectedZone.courier_commission));

    async function checkVipAndSetFee() {
      if (!merchantId || !zoneId) return;

      const supabase = createClient();
      const { data: vipData } = await supabase
        .from('merchant_vip_rates')
        .select('custom_shipping_fee')
        .eq('merchant_id', merchantId)
        .eq('zone_id', zoneId)
        .maybeSingle();

      const vipFee = vipData ? Number(vipData.custom_shipping_fee) : null;
      setIsVipApplied(vipFee !== null);

      const fee = resolveShippingFee({
        zoneBaseShippingFee: Number(selectedZone?.base_shipping_fee || 0),
        merchantVipFee: vipFee,
      });

      setShippingFee(fee);
    }

    checkVipAndSetFee();
  }, [merchantId, zoneId, zones, isEditing]);

  // عند اختيار PREPAID، تصفير COD
  useEffect(() => {
    if (shipmentType === 'PREPAID') {
      setExpectedCod(0);
    }
  }, [shipmentType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isFinanciallyLocked) {
      setErrorMessage(
        'هذه الشحنة تمت تسويتها مالياً مع التاجر ومغلقة في الخزنة، ولا يمكن تعديل بياناتها أو مبالغها.'
      );
      return;
    }

    if (!recipientName.trim() || !recipientPhone.trim() || !recipientAddress.trim()) {
      setErrorMessage('يرجى إكمال بيانات المستلم الأساسية (الاسم، الهاتف، العنوان)');
      return;
    }
    if (!merchantId) {
      setErrorMessage('يرجى اختيار التاجر');
      return;
    }
    if (!zoneId) {
      setErrorMessage('يرجى اختيار المنطقة');
      return;
    }
    if (shipmentType !== 'PREPAID' && expectedCod <= 0) {
      setErrorMessage('مبلغ التحصيل (COD) يجب أن يكون أكبر من صفر للشحنات العادية والاستبدال');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();

      if (isEditing && shipmentToEdit) {
        const updatePayload: ShipmentUpdate = {
          merchant_id: merchantId,
          zone_id: zoneId,
          courier_id: courierId || null,
          recipient_name: recipientName.trim(),
          recipient_phone: recipientPhone.trim(),
          recipient_phone_alt: recipientPhoneAlt.trim() || null,
          recipient_address: recipientAddress.trim(),
          package_description: packageDesc.trim(),
          pieces_count: piecesCount,
          shipment_type: shipmentType,
          expected_cod: expectedCod,
          shipping_fee: shippingFee,
          courier_commission: courierCommission,
          allow_open_package: allowOpenPackage,
          exchange_instructions:
            shipmentType === 'EXCHANGE' ? exchangeInstructions.trim() : null,
          delivery_notes: deliveryNotes.trim() || null,
        };

        const { error } = await supabase
          .from('shipments')
          .update(updatePayload)
          .eq('id', shipmentToEdit.id);

        if (error) throw error;
      } else {
        const insertPayload: ShipmentInsert = {
          merchant_id: merchantId,
          zone_id: zoneId,
          courier_id: courierId || null,
          recipient_name: recipientName.trim(),
          recipient_phone: recipientPhone.trim(),
          recipient_phone_alt: recipientPhoneAlt.trim() || null,
          recipient_address: recipientAddress.trim(),
          package_description: packageDesc.trim(),
          pieces_count: piecesCount,
          shipment_type: shipmentType,
          status: initialStatus,
          expected_cod: expectedCod,
          collected_cash: 0,
          shipping_fee: shippingFee,
          return_fee_bearer: 'NONE',
          courier_commission: courierCommission,
          merchant_net_amount: 0,
          is_courier_cash_settled: false,
          is_courier_commission_settled: false,
          settlement_id: null,
          allow_open_package: allowOpenPackage,
          exchange_instructions:
            shipmentType === 'EXCHANGE' ? exchangeInstructions.trim() : null,
          partial_delivery_notes: null,
          delivery_notes: deliveryNotes.trim() || null,
        };

        const { error } = await supabase.from('shipments').insert(insertPayload);
        if (error) throw error;
      }

      onSuccess();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'حدث خطأ أثناء حفظ الشحنة');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedMerchant = merchants.find((m) => m.id === merchantId);
  const estimatedMerchantNet =
    shipmentType === 'PREPAID' ? -shippingFee : expectedCod - shippingFee;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-6">
        {/* رأس المودال */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-brand-navy text-white">
          <div className="flex items-center gap-2.5">
            <Package size={22} className="text-brand-orange" />
            <div>
              <h3 className="font-black text-base">
                {isEditing ? `تعديل الشحنة (${shipmentToEdit?.awb_number})` : 'تسجيل شحنة وبوليصة جديدة'}
              </h3>
              <p className="text-xs text-slate-300">
                تسجيل بيانات المستلم، احتساب أسعار الشحن آلياً، وتوليد البوليصة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* نموذج الإدخال */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isFinanciallyLocked && (
            <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs flex items-start gap-3 shadow-xs">
              <Lock size={18} className="text-purple-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-sm">🔒 هذه الشحنة مغلقة مالياً (تمت تسويتها مع التاجر)</span>
                <span className="text-[11px] text-purple-700 block mt-1">
                  هذه الشحنة مدرجة ضمن كشف تسوية تاجر مسدد أو معتمد، ومقيدة في قيود الخزنة. لا يمكن تعديل بياناتها أو مبالغها الحساسة لحماية النزاهة المحاسبية.
                </span>
              </div>
            </div>
          )}

          <fieldset disabled={isFinanciallyLocked} className="space-y-5 border-none p-0 m-0">
          {/* 1. التاجر والمنطقة والمندوب */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-brand-navy block">
              1. بيانات الشحن والتسعير
            </span>

            <div className="grid sm:grid-cols-2 gap-3">
              {/* اختيار التاجر */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  التاجر المتعاقد <span className="text-red-500">*</span>
                </label>
                <select
                  value={merchantId}
                  onChange={(e) => setMerchantId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-blue-500/20 bg-white"
                  required
                >
                  {merchants.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.brand_name} ({m.name}) {m.is_vip ? '👑 VIP' : ''}
                    </option>
                  ))}
                </select>
                {selectedMerchant?.is_vip && (
                  <span className="text-[10px] text-amber-700 font-bold flex items-center gap-1 mt-1">
                    <Crown size={12} className="text-amber-500" />
                    تاجر VIP - تطبق أسعاره المخصصة تلقائياً
                  </span>
                )}
              </div>

              {/* اختيار المنطقة */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  منطقة التوزيع <span className="text-red-500">*</span>
                </label>
                <select
                  value={zoneId}
                  onChange={(e) => setZoneId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-blue-500/20 bg-white"
                  required
                >
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.governorate} - {z.name} (أساسي: {z.base_shipping_fee} ج.م)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* الحسبة المالية المحسوبة آلياً */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/80">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                  <span>سعر الشحن للتاجر (ج.م)</span>
                  {isVipApplied && (
                    <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.2 rounded font-bold">
                      سعر VIP
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={shippingFee}
                  onChange={(e) => setShippingFee(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-blue-700 bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  عمولة المندوب (ج.م)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={courierCommission}
                  onChange={(e) => setCourierCommission(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-amber-700 bg-white"
                  required
                />
              </div>
            </div>

            {/* إسناد المندوب (اختياري) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                إسناد لمندوب (اختياري)
              </label>
              <select
                value={courierId}
                onChange={(e) => setCourierId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 bg-white"
              >
                <option value="">بدون إسناد (سيتم التوزيع لاحقاً من المخزن)</option>
                {couriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. بيانات المستلم والعنوان */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-brand-navy block">
              2. بيانات المستلم والعنوان
            </span>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم المستلم <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="الاسم ثلاثي"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رقم الهاتف الأساسي <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 bg-white text-right"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رقم هاتف بديل (اختياري)
                </label>
                <input
                  type="tel"
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                  value={recipientPhoneAlt}
                  onChange={(e) => setRecipientPhoneAlt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 bg-white text-right"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                العنوان التفصيلي <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2}
                placeholder="الشارع، رقم العمارة، رقم الشقة، علامة مميزة..."
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 bg-white"
                required
              />
            </div>
          </div>

          {/* 3. تفاصيل الطرد والـ COD */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-brand-navy block">
              3. تفاصيل الطرد ومبلغ التحصيل
            </span>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  نوع الشحنة <span className="text-red-500">*</span>
                </label>
                <select
                  value={shipmentType}
                  onChange={(e) => setShipmentType(e.target.value as ShipmentType)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-blue-500/20 bg-white"
                >
                  <option value="NORMAL">تحصيل عادي (COD)</option>
                  <option value="PREPAID">مدفوعة مسبقاً (0 ج.م)</option>
                  <option value="EXCHANGE">استبدال (طرد مقابل طرد)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  المبلغ المطلوب تحصيله COD (ج.م) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  disabled={shipmentType === 'PREPAID'}
                  value={expectedCod}
                  onChange={(e) => setExpectedCod(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-black text-slate-900 bg-white disabled:bg-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  عدد القطع
                </label>
                <input
                  type="number"
                  min="1"
                  value={piecesCount}
                  onChange={(e) => setPiecesCount(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                  required
                />
              </div>
            </div>

            {/* في حالة الاستبدال: تعليمات الاستبدال */}
            {shipmentType === 'EXCHANGE' && (
              <div>
                <label className="block text-xs font-bold text-amber-900 mb-1">
                  تعليمات الاستبدال (ما الذي يستلمه المندوب من العميل؟) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="مثال: استلام قميص كحلي مقاس L والتسليم مقاس XL"
                  value={exchangeInstructions}
                  onChange={(e) => setExchangeInstructions(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-amber-300 text-xs bg-amber-50/50"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                وصف المحتوى
              </label>
              <input
                type="text"
                placeholder="وصف مختصر لمحتويات الطرد..."
                value={packageDesc}
                onChange={(e) => setPackageDesc(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
              />
            </div>

            {/* خيار المعاينة والفتح */}
            <div className="pt-1">
              <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-xl border border-slate-300 bg-white">
                <input
                  type="checkbox"
                  checked={allowOpenPackage}
                  onChange={(e) => setAllowOpenPackage(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    {allowOpenPackage
                      ? '✓ مسموح للعميل بفتح ومعاينة الشحنة قبل الاستلام'
                      : '✕ غير مسموح بفتح الشحنة إطلاقاً قبل الاستلام ودفع الـ COD'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ستظهر هذه العبارة بخط بارز جداً على بوليصة الشحن A4
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* 4. الحالة الابتدائية عند الإنشاء فقط */}
          {!isEditing && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                الحالة الابتدائية للشحنة:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`p-3 rounded-xl border cursor-pointer flex items-center gap-2.5 transition-all ${
                    initialStatus === 'PICKUP_REQUESTED'
                      ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="initialStatus"
                    value="PICKUP_REQUESTED"
                    checked={initialStatus === 'PICKUP_REQUESTED'}
                    onChange={() => setInitialStatus('PICKUP_REQUESTED')}
                    className="text-brand-orange"
                  />
                  <div className="text-xs">
                    <span className="block font-bold">طلب استلام (Pickup)</span>
                    <span className="text-[10px] text-slate-500">إرسال مندوب لاستلامها من التاجر</span>
                  </div>
                </label>

                <label
                  className={`p-3 rounded-xl border cursor-pointer flex items-center gap-2.5 transition-all ${
                    initialStatus === 'AT_HUB'
                      ? 'bg-blue-50 border-blue-300 text-blue-900 font-bold'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="initialStatus"
                    value="AT_HUB"
                    checked={initialStatus === 'AT_HUB'}
                    onChange={() => setInitialStatus('AT_HUB')}
                    className="text-blue-600"
                  />
                  <div className="text-xs">
                    <span className="block font-bold">بالمخزن الرئيسي (Hub)</span>
                    <span className="text-[10px] text-slate-500">استلام مباشر أو تم التوريد للمخزن</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* ملخص الحسبة الصافية التقديرية */}
          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 flex items-center justify-between text-xs text-emerald-900 font-bold">
            <span>صافي مستحقات التاجر المتوقعة عند التسليم:</span>
            <span className="text-sm font-black" dir="ltr">
              {formatCurrency(estimatedMerchantNet)}
            </span>
          </div>
          </fieldset>

          {/* أزرار الحفظ والإلغاء */}
          <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting || isFinanciallyLocked}
              className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5 ${
                isFinanciallyLocked
                  ? 'bg-slate-400 text-white cursor-not-allowed opacity-75'
                  : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer disabled:opacity-60'
              }`}
            >
              {isFinanciallyLocked ? (
                <>
                  <Lock size={15} />
                  <span>مغلقة مالياً 🔒</span>
                </>
              ) : submitting ? (
                'جاري الحفظ...'
              ) : isEditing ? (
                'تعديل بيانات الشحنة'
              ) : (
                'تسجيل الشحنة وإصدار البوليصة'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
