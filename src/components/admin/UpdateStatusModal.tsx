'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  calculateShipmentFinancials,
  formatCurrency,
} from '@/modules/finance/calculator';
import {
  SHIPMENT_STATUS_LABELS,
  Shipment,
  ShipmentStatus,
  ReturnFeeBearer,
  Courier,
  ShipmentEvent,
} from '@/types/database';
import {
  CheckCircle,
  Truck,
  RotateCcw,
  Clock,
  Warehouse,
  AlertCircle,
  X,
  History,
  Send,
  Banknote,
  DollarSign,
  Package,
  Lock,
} from 'lucide-react';

interface UpdateStatusModalProps {
  shipment: Shipment;
  couriers: Courier[];
  onClose: () => void;
  onSuccess: () => void;
}

const STATUS_OPTIONS: { status: ShipmentStatus; label: string; icon: any; color: string }[] = [
  { status: 'PICKUP_REQUESTED', label: 'طلب استلام من التاجر', icon: Clock, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { status: 'AT_HUB', label: 'بالمخزن الرئيسي (Hub)', icon: Warehouse, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { status: 'OUT_FOR_DELIVERY', label: 'خرجت للتسليم (مع المندوب)', icon: Truck, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { status: 'DELIVERED', label: 'تم التسليم بالكامل', icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { status: 'PARTIAL_DELIVERED', label: 'تسليم جزئي (استلام جزء)', icon: Package, color: 'text-teal-600 bg-teal-50 border-teal-200' },
  { status: 'EXCHANGED', label: 'تم الاستبدال بنجاح', icon: RotateCcw, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { status: 'POSTPONED', label: 'مؤجلة (بناءً على طلب العميل)', icon: Clock, color: 'text-slate-600 bg-slate-50 border-slate-200' },
  { status: 'RETURNED', label: 'شحنة مرتجعة (فشل التسليم)', icon: RotateCcw, color: 'text-rose-600 bg-rose-50 border-rose-200' },
];

export default function UpdateStatusModal({
  shipment,
  couriers,
  onClose,
  onSuccess,
}: UpdateStatusModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<ShipmentStatus>(shipment.status);
  const [assignedCourierId, setAssignedCourierId] = useState<string>(
    shipment.courier_id || '',
  );

  // الحسابات المالية التفاعلية
  const [partialCollectedCash, setPartialCollectedCash] = useState<number>(
    shipment.collected_cash > 0 ? Number(shipment.collected_cash) : 0,
  );
  const [partialNotes, setPartialNotes] = useState<string>(
    shipment.partial_delivery_notes || '',
  );
  const [returnFeeBearer, setReturnFeeBearer] = useState<ReturnFeeBearer>(
    shipment.return_fee_bearer || 'CLIENT_PAID',
  );

  // بيانات حدث التتبع Timeline
  const [eventTitle, setEventTitle] = useState('');
  const [eventNotes, setEventNotes] = useState('');

  // السجل التاريخي
  const [timelineEvents, setTimelineEvents] = useState<ShipmentEvent[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(true);

  // هل الشحنة مغلقة مالياً بصدور كشف تسوية للتاجر؟
  const isFinanciallyLocked = Boolean(shipment.settlement_id);

  // عمولة المندوب المستحقة (قابلة للتعديل)
  const [courierCommissionInput, setCourierCommissionInput] = useState<number>(
    Number(shipment.courier_commission) > 0
      ? Number(shipment.courier_commission)
      : 0,
  );

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // جلب سجل تتبع الشحنة وعمولة المنطقة إذا كانت عمولة الشحنة = 0
  useEffect(() => {
    async function initData() {
      const supabase = createClient();

      const timelinePromise = supabase
        .from('shipment_events')
        .select('*')
        .eq('shipment_id', shipment.id)
        .order('created_at', { ascending: false });

      const zonePromise =
        Number(shipment.courier_commission) === 0 && shipment.zone_id
          ? supabase
              .from('zones')
              .select('courier_commission')
              .eq('id', shipment.zone_id)
              .single()
          : Promise.resolve({ data: null, error: null });

      const [timelineRes, zoneRes] = await Promise.all([timelinePromise, zonePromise]);

      if (timelineRes?.data) {
        setTimelineEvents(timelineRes.data);
      }
      setLoadingTimeline(false);

      if (zoneRes?.data?.courier_commission && Number(zoneRes.data.courier_commission) > 0) {
        setCourierCommissionInput(Number(zoneRes.data.courier_commission));
      }
    }
    initData();
  }, [shipment.id, shipment.zone_id, shipment.courier_commission]);

  // تحديث العنوان التلقائي للحدث عند تغيير الحالة
  useEffect(() => {
    switch (selectedStatus) {
      case 'PICKUP_REQUESTED':
        setEventTitle('طلب استلام الشحنة من مقر التاجر');
        break;
      case 'AT_HUB':
        setEventTitle('تم استلام الشحنة وتخزينها في المخزن الرئيسي');
        break;
      case 'OUT_FOR_DELIVERY':
        setEventTitle('خرجت الشحنة للتسليم مع مندوب التوزيع');
        break;
      case 'DELIVERED':
        setEventTitle('تم تسليم الشحنة للعميل وتحصيل المبلغ بنجاح');
        break;
      case 'PARTIAL_DELIVERED':
        setEventTitle('تم تسليم جزء من الشحنة وتحصيل القيمة الجزئية');
        break;
      case 'EXCHANGED':
        setEventTitle('تم استبدال الطرد بنجاح واستلام المرتجع');
        break;
      case 'POSTPONED':
        setEventTitle('تم تأجيل موعد التسليم بناءً على طلب العميل');
        break;
      case 'RETURNED':
        setEventTitle('تعذر تسليم الشحنة وتم تسجيلها كمرتجع');
        break;
      default:
        setEventTitle(`تم تغيير الحالة إلى ${SHIPMENT_STATUS_LABELS[selectedStatus]}`);
    }
  }, [selectedStatus]);

  // احتساب الحسبة المالية اللحظية عبر المحرك المالي
  const calculated = calculateShipmentFinancials({
    shipmentType: shipment.shipment_type,
    status: selectedStatus,
    expectedCod: Number(shipment.expected_cod),
    shippingFee: Number(shipment.shipping_fee),
    zoneCourierCommission: Number(shipment.courier_commission),
    courierCommissionOverride: courierCommissionInput,
    returnFeeBearer: returnFeeBearer,
    partialCollectedCash: partialCollectedCash,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isFinanciallyLocked) {
      setErrorMessage('هذه الشحنة تمت تسويتها مالياً مع التاجر ولا يمكن تعديل حالتها أو مبالغها الحساسة');
      return;
    }

    if (selectedStatus === 'PARTIAL_DELIVERED') {
      if (partialCollectedCash <= 0) {
        setErrorMessage('في التسليم الجزئي يجب إدخال المبلغ المحصل فعلياً');
        return;
      }
      if (!partialNotes.trim()) {
        setErrorMessage('يرجى توضيح تفاصيل التسليم الجزئي وما تم إرجاعه');
        return;
      }
    }

    if (selectedStatus === 'OUT_FOR_DELIVERY' && !assignedCourierId) {
      setErrorMessage('عند تحويل الشحنة إلى "خرجت للتسليم" يجب اختيار المندوب المسندة له');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();

      // 1. تحديث جدول الشحنات
      const { error: shipmentErr } = await supabase
        .from('shipments')
        .update({
          status: selectedStatus,
          courier_id: assignedCourierId || null,
          collected_cash: calculated.collectedCash,
          courier_commission: calculated.courierCommission,
          merchant_net_amount: calculated.merchantNetAmount,
          return_fee_bearer:
            selectedStatus === 'RETURNED' ? returnFeeBearer : 'NONE',
          partial_delivery_notes:
            selectedStatus === 'PARTIAL_DELIVERED' ? partialNotes.trim() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', shipment.id);

      if (shipmentErr) throw shipmentErr;

      // 2. إدراج حدث جديد في جدول shipment_events
      const { error: eventErr } = await supabase
        .from('shipment_events')
        .insert({
          shipment_id: shipment.id,
          status: selectedStatus,
          title: eventTitle.trim() || SHIPMENT_STATUS_LABELS[selectedStatus],
          notes: eventNotes.trim() || null,
        });

      if (eventErr) throw eventErr;

      onSuccess();
    } catch (err: unknown) {
      setErrorMessage(`حدث خطأ أثناء تحديث الحالة: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-6 flex flex-col max-h-[90vh]">
        {/* ترويسة المودال */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-brand-navy text-white shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-amber-400 text-sm" dir="ltr">
                {shipment.awb_number}
              </span>
              <span className="text-xs text-slate-300">• المستلم: {shipment.recipient_name}</span>
              {isFinanciallyLocked && (
                <span className="bg-purple-900/80 border border-purple-400/50 text-purple-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Lock size={10} />
                  <span>مغلقة مالياً</span>
                </span>
              )}
            </div>
            <h3 className="font-black text-base mt-0.5">
              تحديث مسار الحالة والتقفيل المالي الذكي
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* جسم المودال */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* تنبيه الإغلاق المالي الصارم */}
          {isFinanciallyLocked && (
            <div className="p-4 rounded-xl bg-purple-50 border-2 border-purple-300 text-purple-900 text-xs flex items-start gap-3 animate-in fade-in">
              <Lock size={20} className="text-purple-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-black text-sm text-purple-900 mb-0.5">
                  🔒 هذه الشحنة مغلقة مالياً بالكامل (تمت التسوية للتاجر)
                </div>
                <p className="text-purple-800 leading-relaxed">
                  تم إدراج هذه الشحنة في كشف تسوية وصرف مستحقاتها رسمياً للتاجر. لا يمكن تعديل حالتها التشغيلية أو بياناتها المالية الحساسة حفاظاً على سلامة الحسابات ومطابقتها التامة مع الخزنة.
                </p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. اختيار الحالة الجديدة */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              اختر الحالة الجديدة للشحنة:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STATUS_OPTIONS.map((opt) => {
                const isSelected = selectedStatus === opt.status;
                const Icon = opt.icon;

                return (
                  <button
                    key={opt.status}
                    type="button"
                    disabled={isFinanciallyLocked}
                    onClick={() => setSelectedStatus(opt.status)}
                    className={`p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between ${
                      isFinanciallyLocked
                        ? 'opacity-60 cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500'
                        : isSelected
                        ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-xs ring-2 ring-blue-500/30 cursor-pointer'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Icon
                        size={17}
                        className={isSelected ? 'text-blue-600' : 'text-slate-400'}
                      />
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                      )}
                    </div>
                    <span className="text-xs font-bold leading-snug">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. تخصيص المندوب المسؤول */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              المندوب المسؤول عن الشحنة
            </label>
            <select
              disabled={isFinanciallyLocked}
              value={assignedCourierId}
              onChange={(e) => setAssignedCourierId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-blue-500/20 bg-white disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="">بدون مندوب معين</option>
              {couriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone})
                </option>
              ))}
            </select>
          </div>

          {/* عمولة المندوب المستحقة (قابلة للتعديل) */}
          <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200">
            <label className="block text-xs font-bold text-amber-900 mb-1">
              عمولة المندوب المستحقة عن الشحنة (ج.م)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="1"
                min="0"
                disabled={isFinanciallyLocked}
                value={courierCommissionInput}
                onChange={(e) =>
                  setCourierCommissionInput(parseFloat(e.target.value) || 0)
                }
                className="w-32 px-3 py-1.5 rounded-lg border border-amber-300 text-xs font-black text-amber-900 bg-white disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <span className="text-[11px] text-amber-700">
                القيمة المحفوظة في الشحنة: {Number(shipment.courier_commission)} ج.م
              </span>
            </div>
            <span className="text-[10px] text-amber-600 mt-1 block">
              تعديل هذا الحقل يغير العمولة فوراً في المعاينة المالية بالأسفل
            </span>
          </div>

          {/* 3. الشروط المالية الخاصة (تسليم جزئي / مرتجع) */}
          {selectedStatus === 'PARTIAL_DELIVERED' && (
            <div className="bg-teal-50/70 p-4 rounded-xl border border-teal-200 space-y-3">
              <span className="text-xs font-bold text-teal-900 block">
                تفاصيل التسليم الجزئي (Partial Delivery)
              </span>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-teal-800 mb-1">
                    المبلغ المحصل فعلياً من العميل (ج.م) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    disabled={isFinanciallyLocked}
                    value={partialCollectedCash}
                    onChange={(e) =>
                      setPartialCollectedCash(parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-teal-300 text-xs font-black text-teal-900 bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                    required
                  />
                  <span className="text-[10px] text-teal-700">
                    أصل المبلغ المطلوب كان: {shipment.expected_cod} ج.م
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-teal-800 mb-1">
                    ملاحظات الطرد المستلم والمرتجع <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: استلم قطعتين ورفض قطعة واحدة مقاس كبير"
                    disabled={isFinanciallyLocked}
                    value={partialNotes}
                    onChange={(e) => setPartialNotes(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-teal-300 text-xs bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {selectedStatus === 'RETURNED' && (
            <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-200 space-y-3">
              <span className="text-xs font-bold text-rose-900 block">
                سياسة الشحن للمرتجع (Return Shipping Fee Bearer)
              </span>

              <div className="space-y-2">
                <label className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-rose-200 cursor-pointer">
                  <input
                    type="radio"
                    name="returnBearer"
                    value="CLIENT_PAID"
                    disabled={isFinanciallyLocked}
                    checked={returnFeeBearer === 'CLIENT_PAID'}
                    onChange={() => setReturnFeeBearer('CLIENT_PAID')}
                    className="text-rose-600 disabled:opacity-60"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 block">
                      دفعها العميل نقداً عند المعاينة والرفض ({shipment.shipping_fee} ج.م)
                    </span>
                    <span className="text-[10px] text-slate-500">
                      المندوب يحصّل قيمة الشحن فقط، ولا يخصم شيء من التاجر
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-rose-200 cursor-pointer">
                  <input
                    type="radio"
                    name="returnBearer"
                    value="MERCHANT_DEDUCTED"
                    disabled={isFinanciallyLocked}
                    checked={returnFeeBearer === 'MERCHANT_DEDUCTED'}
                    onChange={() => setReturnFeeBearer('MERCHANT_DEDUCTED')}
                    className="text-rose-600 disabled:opacity-60"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 block">
                      خصم مصاريف الشحن من حساب التاجر (-{shipment.shipping_fee} ج.م)
                    </span>
                    <span className="text-[10px] text-slate-500">
                      العميل لم يدفع شيئاً، ويتم تحميل التكلفة لمديونية التاجر
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-rose-200 cursor-pointer">
                  <input
                    type="radio"
                    name="returnBearer"
                    value="NONE"
                    disabled={isFinanciallyLocked}
                    checked={returnFeeBearer === 'NONE'}
                    onChange={() => setReturnFeeBearer('NONE')}
                    className="text-rose-600 disabled:opacity-60"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 block">
                      مرتجع مجاني بالكامل (0 ج.م)
                    </span>
                    <span className="text-[10px] text-slate-500">
                      إعفاء كامل بدون أي خصومات أو تحصيلات
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* 4. المعاينة المالية الفورية */}
          <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200 text-xs">
            <span className="font-bold text-slate-700 block mb-2">
              ملخص الأثر المالي للحالة المختارة:
            </span>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">النقدية المحصلة بيد المندوب</span>
                <span className="font-black text-slate-900" dir="ltr">
                  {formatCurrency(calculated.collectedCash)}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">عمولة المندوب المستحقة</span>
                <span className="font-black text-amber-700" dir="ltr">
                  {formatCurrency(calculated.courierCommission)}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">صافي مستحقات التاجر</span>
                <span
                  className={`font-black ${
                    calculated.merchantNetAmount >= 0 ? 'text-emerald-700' : 'text-red-600'
                  }`}
                  dir="ltr"
                >
                  {formatCurrency(calculated.merchantNetAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* 5. تسجيل حدث التتبع (Shipment Event) */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-brand-navy block">
              نص الحدث المسجل في سجل التتبع المباشر (Timeline):
            </span>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                عنوان الحدث (يظهر للمستلم في صفحة التتبع)
              </label>
              <input
                type="text"
                disabled={isFinanciallyLocked}
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                ملاحظات إضافية على الحركة (اختياري)
              </label>
              <input
                type="text"
                placeholder="مثال: تم الاتفاق على موعد تسليم غداً الساعة 4 عصراً"
                disabled={isFinanciallyLocked}
                value={eventNotes}
                onChange={(e) => setEventNotes(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* 6. السجل التاريخي الكامل للشحنة */}
          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <History size={16} className="text-slate-500" />
              <span className="text-xs font-bold text-slate-700">
                سجل الحركات السابق ({timelineEvents.length} حدث):
              </span>
            </div>

            {loadingTimeline ? (
              <p className="text-xs text-slate-400">جاري تحميل السجل التاريخي...</p>
            ) : timelineEvents.length === 0 ? (
              <p className="text-xs text-slate-400">لا توجد أحداث سابقة مسجلة</p>
            ) : (
              <div className="space-y-2 border-r-2 border-blue-200 pr-3 mr-1 text-xs">
                {timelineEvents.map((ev) => (
                  <div key={ev.id} className="relative">
                    <span className="w-2 h-2 rounded-full bg-blue-600 absolute -right-[17px] top-1.5" />
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{ev.title}</span>
                      <span className="text-[10px] text-slate-400" dir="ltr">
                        {new Date(ev.created_at).toLocaleDateString('ar-EG', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {ev.notes && <p className="text-[11px] text-slate-500 mt-0.5">{ev.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* أسفل المودال */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors cursor-pointer"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || isFinanciallyLocked}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md ${
              isFinanciallyLocked
                ? 'bg-slate-400 text-white cursor-not-allowed opacity-75'
                : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:opacity-50'
            }`}
          >
            {isFinanciallyLocked ? (
              <>
                <Lock size={16} />
                <span>مغلقة مالياً 🔒</span>
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                <span>{submitting ? 'جاري الحفظ...' : 'اعتماد تحديث الحالة والماليات'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
