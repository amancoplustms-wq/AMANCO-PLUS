'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  formatCurrency,
  formatArabicDateTime,
  buildWhatsAppLink,
} from '@/modules/finance/calculator';
import {
  COURIER_SETTLEMENT_TYPE_LABELS,
  SHIPMENT_STATUS_LABELS,
  CourierSettlement,
  Courier,
  Shipment,
  Merchant,
  Zone,
} from '@/types/database';
import {
  Printer,
  MessageCircle,
  X,
  Truck,
  Package,
} from 'lucide-react';
import BrandLogo from '@/components/public/BrandLogo';
import { printElementById } from '@/lib/printElement';

interface ShipmentWithDetails extends Shipment {
  merchants?: Merchant | null;
  zones?: Zone | null;
}

interface ExtendedCourierSettlement extends CourierSettlement {
  couriers?: Courier | null;
}

interface CourierSettlementDetailsModalProps {
  settlement: ExtendedCourierSettlement | null;
  courierData?: Courier | null;
  onClose: () => void;
}

export default function CourierSettlementDetailsModal({
  settlement,
  courierData,
  onClose,
}: CourierSettlementDetailsModalProps) {
  const [shipments, setShipments] = useState<ShipmentWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [propCourier, setPropCourier] = useState<Courier | null>(null);

  useEffect(() => {
    if (!settlement) return;

    if (!courierData && settlement.courier_id) {
      const supabase = createClient();
      supabase
        .from('couriers')
        .select('*')
        .eq('id', settlement.courier_id)
        .single()
        .then(({ data }) => {
          if (data) setPropCourier(data);
        });
    }

    if (settlement.shipment_ids && settlement.shipment_ids.length > 0) {
      setLoading(true);
      const supabase = createClient();
      supabase
        .from('shipments')
        .select(`
          *,
          merchants:merchant_id (*),
          zones:zone_id (*)
        `)
        .in('id', settlement.shipment_ids)
        .then(({ data, error }) => {
          if (error) {
            console.error('Error fetching settlement shipments:', error);
          } else {
            setShipments(data || []);
          }
          setLoading(false);
        });
    } else {
      setShipments([]);
    }
  }, [settlement, courierData]);

  if (!settlement) return null;

  const currentCourier = courierData || propCourier || settlement.couriers;

  const handlePrint = () => {
    printElementById(
      'courier-settlement-print-container',
      `إيصال تسوية مندوب - ${currentCourier?.name || 'المندوب'} (${settlement.settlement_code})`
    );
  };

  // نص رسالة الواتساب الرسمية الموجهة للمندوب
  const waMsg = `أهلاً بك يا كابتن ${currentCourier?.name || 'المندوب'}،
تفاصيل تسوية الشحنات والعمولات لدى شركة أمانكو بلس للشحن والتوريد:

📄 كود التسوية: ${settlement.settlement_code}
📌 نوع العملية: ${COURIER_SETTLEMENT_TYPE_LABELS[settlement.settlement_type] || settlement.settlement_type}
📦 عدد الشحنات: ${settlement.shipments_count} شحنة
💰 إجمالي الكاش المحصل: ${formatCurrency(Number(settlement.total_cash_collected))}
💵 إجمالي العمولة: ${formatCurrency(Number(settlement.total_commission_amount))}
🏦 الصافي المالي: ${formatCurrency(Number(settlement.net_treasury_amount))}
📅 التاريخ والوقت: ${formatArabicDateTime(settlement.settled_at)}
${settlement.notes ? `📝 ملاحظات: ${settlement.notes}\n` : ''}
شكراً لجهودكم المتميزة مع شركة أمانكو بلس للشحن والتوريد — AMANCO PLUS.`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs p-3 sm:p-6 flex flex-col items-center">
      {/* شريط التحكم العلوي للمعاينة (no-print) */}
      <div className="w-full max-w-4xl bg-white p-4 rounded-2xl shadow-xl border border-slate-200 mb-4 flex flex-wrap items-center justify-between gap-3 sticky top-2 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 text-brand-orange flex items-center justify-center font-bold">
            <Truck size={22} />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-base">
              تفاصيل تسوية مندوب: {currentCourier?.name || 'مندوب'} ({settlement.settlement_code})
            </h3>
            <p className="text-xs text-slate-500">
              إيصال وكشف تسوية رسمي معتمد جاهز للطباعة على ورق قياسي A4
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* زر إرسال واتساب للمندوب */}
          {currentCourier?.phone && (
            <a
              href={buildWhatsAppLink(currentCourier.whatsapp || currentCourier.phone, waMsg)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-colors"
            >
              <MessageCircle size={15} />
              <span>إرسال واتساب</span>
            </a>
          )}

          {/* زر الطباعة الفعلي المعزول عبر Iframe */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <Printer size={16} />
            <span>طباعة الإيصال (A4)</span>
          </button>

          {/* إغلاق */}
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* كشف الحساب الفعلي المطبوع A4 المعزول */}
      {/* ==================================================================== */}
      <div id="courier-settlement-print-container" className="w-full max-w-4xl flex flex-col items-center">
        <div
          className="a4-print-page w-[210mm] max-w-full bg-white shadow-2xl p-6 sm:p-10 rounded-2xl border border-slate-300 text-black text-sm"
          style={{
            printColorAdjust: 'exact',
            WebkitPrintColorAdjust: 'exact',
          }}
          dir="rtl"
        >
          {/* 1. الترويسة والشعار */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-5 mb-5">
            <div className="flex items-center gap-3">
              <BrandLogo size="md" variant="light" showText={false} />
              <div className="flex flex-col items-start justify-center text-right">
                {/* السطر الأول: شركة أمانكو بلس بارز وكبير */}
                <span className="text-xl font-black text-slate-900 whitespace-nowrap leading-tight">
                  شركة أمانكو <span className="text-[#f97316]">بلس</span>
                </span>

                {/* السطر الثاني: AMANCO PLUS • للشحن والتوريد • خدمة العملاء */}
                <div className="text-xs font-bold text-slate-500 whitespace-nowrap flex items-center mt-1 leading-tight gap-1.5">
                  <span className="font-sans font-extrabold uppercase tracking-wider text-slate-800 text-[11px]">
                    AMANCO <span className="text-[#f97316]">PLUS</span>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-700 font-bold">للشحن والتوريد</span>
                  <span className="text-slate-300">•</span>
                  <span>خدمة العملاء والعمليات: <span dir="ltr" className="font-black text-slate-900">01274365996</span></span>
                </div>
              </div>
            </div>

            <div className="text-left">
              <span className="inline-block px-3 py-1 bg-slate-900 text-white font-bold text-xs rounded-lg mb-1">
                {COURIER_SETTLEMENT_TYPE_LABELS[settlement.settlement_type] || settlement.settlement_type}
              </span>
              <p className="text-xs text-slate-500 font-mono font-bold" dir="ltr">
                {settlement.settlement_code}
              </p>
            </div>
          </div>

          {/* 2. بيانات المندوب وتاريخ التسوية */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">بيانات المندوب:</p>
              <p className="font-black text-base text-slate-900">
                {currentCourier?.name || 'مندوب غير محدد'}
              </p>
              <p className="text-xs text-slate-600 font-mono mt-0.5" dir="ltr">
                {currentCourier?.phone || '-'}
              </p>
              {currentCourier?.national_id && (
                <p className="text-xs text-slate-500 font-mono">
                  الرقم القومي: {currentCourier.national_id}
                </p>
              )}
            </div>

            <div className="text-left" dir="ltr">
              <p className="text-xs text-slate-500 mb-0.5 text-right">تاريخ وتوقيت التسوية:</p>
              <p className="font-bold text-slate-900 text-right">
                {formatArabicDateTime(settlement.settled_at)}
              </p>
              <span className="inline-block mt-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded">
                ✓ قيد مالي معتمد ومغلق
              </span>
            </div>
          </div>

          {/* 3. بطاقات الأرقام المالية */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="border-2 border-slate-900 rounded-xl p-3 bg-slate-50 text-center">
              <p className="text-xs font-bold text-slate-600 mb-1">إجمالي الكاش المحصل</p>
              <p className="text-lg font-black font-mono text-slate-900" dir="ltr">
                {formatCurrency(Number(settlement.total_cash_collected))}
              </p>
            </div>

            <div className="border-2 border-slate-900 rounded-xl p-3 bg-slate-50 text-center">
              <p className="text-xs font-bold text-slate-600 mb-1">إجمالي العمولات المستحقة</p>
              <p className="text-lg font-black font-mono text-emerald-800" dir="ltr">
                {formatCurrency(Number(settlement.total_commission_amount))}
              </p>
            </div>

            <div
              className={`border-2 rounded-xl p-3 text-center ${
                settlement.settlement_type === 'COMMISSION_PAYOUT'
                  ? 'border-emerald-600 bg-emerald-50'
                  : 'border-slate-900 bg-slate-900 text-white'
              }`}
            >
              <p
                className={`text-xs font-bold mb-1 ${
                  settlement.settlement_type === 'COMMISSION_PAYOUT'
                    ? 'text-emerald-900'
                    : 'text-slate-300'
                }`}
              >
                {settlement.settlement_type === 'COMMISSION_PAYOUT'
                  ? 'الصافي المنصرف للمندوب'
                  : 'الصافي المورد للخزنة'}
              </p>
              <p
                className={`text-lg font-black font-mono ${
                  settlement.settlement_type === 'COMMISSION_PAYOUT'
                    ? 'text-emerald-950'
                    : 'text-brand-orange-light'
                }`}
                dir="ltr"
              >
                {formatCurrency(Number(settlement.net_treasury_amount))}
              </p>
            </div>
          </div>

          {/* 4. جدول الشحنات التفصيلي المشمول بالتسوية */}
          <div className="mb-6">
            <h4 className="font-black text-slate-900 text-sm mb-3 flex items-center gap-2">
              <Package size={17} className="text-brand-orange" />
              <span>بيان الشحنات المشمولة في هذه التسوية ({shipments.length} شحنة)</span>
            </h4>

            {loading ? (
              <div className="text-center py-8 text-slate-400 font-bold">
                جاري جلب تفاصيل الشحنات...
              </div>
            ) : shipments.length === 0 ? (
              <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl">
                لا توجد شحنات مسجلة في هذه التسوية
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-300 rounded-xl">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold">
                      <th className="py-2.5 px-3 w-8 text-center">#</th>
                      <th className="py-2.5 px-3">رقم البوليصة</th>
                      <th className="py-2.5 px-3">المستلم والهاتف</th>
                      <th className="py-2.5 px-3">المنطقة</th>
                      <th className="py-2.5 px-3">التاجر (البراند)</th>
                      <th className="py-2.5 px-3">حالة الشحنة</th>
                      <th className="py-2.5 px-3 text-left">الكاش المحصل</th>
                      <th className="py-2.5 px-3 text-left">عمولة المندوب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {shipments.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 text-center text-slate-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900" dir="ltr">
                          {s.awb_number}
                        </td>
                        <td className="py-2 px-3">
                          <p className="font-bold text-slate-900">{s.recipient_name}</p>
                          <p className="text-[11px] text-slate-500 font-mono" dir="ltr">
                            {s.recipient_phone}
                          </p>
                        </td>
                        <td className="py-2 px-3 text-slate-700">
                          {s.zones?.name || '-'}
                        </td>
                        <td className="py-2 px-3 text-slate-800 font-medium">
                          {s.merchants?.brand_name || '-'}
                        </td>
                        <td className="py-2 px-3">
                          <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800">
                            {SHIPMENT_STATUS_LABELS[s.status] || s.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-left font-mono font-bold text-slate-900" dir="ltr">
                          {formatCurrency(Number(s.collected_cash))}
                        </td>
                        <td className="py-2 px-3 text-left font-mono font-bold text-emerald-800" dir="ltr">
                          {formatCurrency(Number(s.courier_commission))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 5. ملاحظات إن وجدت */}
          {settlement.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-6 text-xs text-amber-900">
              <span className="font-bold block mb-1">ملاحظات العملية:</span>
              <p className="whitespace-pre-line">{settlement.notes}</p>
            </div>
          )}

          {/* 6. خانات التوقيع والاعتماد */}
          <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-300 text-center text-xs text-slate-600">
            <div>
              <p className="font-bold text-slate-800 mb-10">توقيع المندوب بالاستلام / التوريد</p>
              <p className="text-slate-400">....................................................</p>
            </div>
            <div>
              <p className="font-bold text-slate-800 mb-10">مسؤول الخزنة والاعتماد (شركة أمانكو بلس للشحن والتوريد — AMANCO PLUS)</p>
              <p className="text-slate-400">....................................................</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
