'use client';

import React from 'react';
import {
  formatCurrency,
  buildWhatsAppLink,
} from '@/modules/finance/calculator';
import {
  PAYMENT_METHOD_LABELS,
  SHIPMENT_STATUS_LABELS,
  MerchantSettlement,
  Merchant,
  Shipment,
} from '@/types/database';
import { Printer, MessageCircle, X, Receipt } from 'lucide-react';
import BrandLogo from '@/components/public/BrandLogo';
import { printElementById } from '@/lib/printElement';

interface SettlementWithDetails extends MerchantSettlement {
  merchants?: Merchant | null;
  shipments?: (Shipment & { zones?: { name: string; governorate: string } | null })[];
}

interface PrintSettlementModalProps {
  settlement: SettlementWithDetails;
  onClose: () => void;
}

export default function PrintSettlementModal({
  settlement,
  onClose,
}: PrintSettlementModalProps) {
  const merchant = settlement.merchants;
  const shipmentsList = settlement.shipments || [];

  const handlePrint = () => {
    printElementById(
      'settlement-print-container',
      `كشف تسوية تاجر - ${merchant?.brand_name || ''} (${settlement.settlement_code})`
    );
  };

  // رسالة الواتساب الرسمية
  const waMsg = `أهلاً بحضرتك أ/ ${merchant?.name || 'التاجر'}،
تم إصدار كشف تسوية مستحقات شحنات براند (${merchant?.brand_name || ''}) بنجاح.

📄 كود الكشف: ${settlement.settlement_code}
📦 عدد الشحنات: ${shipmentsList.length} شحنة
💰 إجمالي المبالغ المحصلة (COD): ${formatCurrency(Number(settlement.total_cod_collected))}
🚚 رسوم الشحن المخصومة: ${formatCurrency(Number(settlement.total_shipping_deducted))}
💵 صافي المبلغ المحول لحسابكم: ${formatCurrency(Number(settlement.net_payout_amount))}
💳 طريقة التحويل: ${PAYMENT_METHOD_LABELS[settlement.payment_method]} ${
    settlement.transfer_reference ? `(مرجع: ${settlement.transfer_reference})` : ''
  }

شكراً لثقتكم بشركة أمانكو بلس للشحن والتوريد — AMANCO PLUS.`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs p-3 sm:p-6 flex flex-col items-center">
      {/* شريط التحكم العلوي للمعاينة (no-print) */}
      <div className="w-full max-w-4xl bg-white p-4 rounded-2xl shadow-xl border border-slate-200 mb-4 flex flex-wrap items-center justify-between gap-3 sticky top-2 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <Receipt size={22} />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-base">
              كشف تسوية حسابات تاجر: {merchant?.brand_name} ({settlement.settlement_code})
            </h3>
            <p className="text-xs text-slate-500">
              كشف حساب رسمي معتمد جاهز للطباعة على ورق قياسي A4
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* زر إرسال واتساب */}
          {merchant?.phone && (
            <a
              href={buildWhatsAppLink(merchant.whatsapp || merchant.phone, waMsg)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-colors"
            >
              <MessageCircle size={15} />
              <span>إرسال واتساب</span>
            </a>
          )}

          {/* زر الطباعة الفعلي المعزول */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <Printer size={16} />
            <span>طباعة الكشف (A4)</span>
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
      <div id="settlement-print-container" className="w-full max-w-4xl flex flex-col items-center">
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
                  <span>خدمة العملاء: <span dir="ltr" className="font-black text-slate-900">01274365996</span></span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-400">القاهرة • الجيزة • القليوبية</span>
                </div>
              </div>
            </div>

            <div className="text-left" dir="ltr">
              <span className="text-xs bg-slate-100 border border-slate-300 px-3 py-1 rounded-full font-mono font-bold text-slate-800 block text-right">
                {settlement.settlement_code}
              </span>
              <span className="text-xs text-slate-500 block text-right mt-1">
                تاريخ الإصدار: {new Date(settlement.settled_at).toLocaleDateString('ar-EG')}
              </span>
            </div>
          </div>

          {/* 2. بيانات التاجر والعملية المالية */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">بيانات التاجر / المتجر:</p>
              <p className="font-black text-base text-slate-900">{merchant?.brand_name || '-'}</p>
              <p className="text-xs text-slate-600 mt-0.5">المسؤول: {merchant?.name || '-'}</p>
              <p className="text-xs text-slate-600 font-mono" dir="ltr">{merchant?.phone || '-'}</p>
            </div>

            <div className="text-left" dir="ltr">
              <p className="text-xs text-slate-500 mb-0.5 text-right">بيانات التحويل والاعتماد:</p>
              <p className="font-bold text-slate-900 text-right">
                طريقة التحويل: {PAYMENT_METHOD_LABELS[settlement.payment_method]}
              </p>
              {settlement.transfer_reference && (
                <p className="text-xs text-blue-900 font-mono font-bold text-right">
                  الرقم المرجعي: {settlement.transfer_reference}
                </p>
              )}
              <span className="inline-block mt-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded">
                ✓ تمت التسوية والاعتماد
              </span>
            </div>
          </div>

          {/* 3. جدول البوالص المشمولة في كشف التسوية */}
          <div className="border border-slate-300 rounded-xl overflow-hidden mb-6">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900 text-white font-bold">
                <tr>
                  <th className="py-2.5 px-3 text-center w-8">#</th>
                  <th className="py-2.5 px-3">رقم البوليصة</th>
                  <th className="py-2.5 px-3">اسم المستلم</th>
                  <th className="py-2.5 px-3">المنطقة</th>
                  <th className="py-2.5 px-3">الحالة</th>
                  <th className="py-2.5 px-3 text-left">المحصل (COD)</th>
                  <th className="py-2.5 px-3 text-left">رسوم الشحن</th>
                  <th className="py-2.5 px-3 text-left">صافي التاجر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {shipmentsList.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-2 px-3 font-mono font-bold text-blue-800" dir="ltr">
                      {s.awb_number}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-800">{s.recipient_name}</td>
                    <td className="py-2 px-3 text-slate-600">{s.zones?.name || '-'}</td>
                    <td className="py-2 px-3">
                      <span className="text-[11px] font-semibold text-slate-700">
                        {SHIPMENT_STATUS_LABELS[s.status]}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-left font-mono font-bold" dir="ltr">
                      {formatCurrency(Number(s.collected_cash))}
                    </td>
                    <td className="py-2 px-3 text-left font-mono text-slate-600" dir="ltr">
                      -{formatCurrency(Number(s.shipping_fee))}
                    </td>
                    <td
                      className={`py-2 px-3 text-left font-mono font-bold ${
                        Number(s.merchant_net_amount) >= 0 ? 'text-emerald-800' : 'text-red-700'
                      }`}
                      dir="ltr"
                    >
                      {formatCurrency(Number(s.merchant_net_amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 4. ملخص الإجماليات النهائية */}
          <div className="flex justify-end mb-8">
            <div className="w-full sm:w-80 bg-slate-100 border-2 border-slate-900 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-700">
                <span>إجمالي النقدية المحصلة:</span>
                <span className="font-mono font-bold" dir="ltr">
                  {formatCurrency(Number(settlement.total_cod_collected))}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-700">
                <span>إجمالي رسوم الشحن المستقطعة:</span>
                <span className="font-mono font-bold text-red-600" dir="ltr">
                  -{formatCurrency(Number(settlement.total_shipping_deducted))}
                </span>
              </div>

              <div className="border-t-2 border-slate-900 pt-2 flex justify-between items-center text-sm font-black text-slate-950">
                <span>الصافي المحول للتاجر:</span>
                <span className="font-mono text-emerald-800 text-base" dir="ltr">
                  {formatCurrency(Number(settlement.net_payout_amount))}
                </span>
              </div>
            </div>
          </div>

          {/* 5. خانات التوقيع والاعتماد الرسمي */}
          <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-300 text-center text-xs text-slate-600">
            <div>
              <p className="font-bold text-slate-800 mb-8">إعداد وتدقيق الحسابات</p>
              <p className="text-slate-400">..............................</p>
            </div>
            <div>
              <p className="font-bold text-slate-800 mb-8">اعتماد إدارة شركة أمانكو بلس للشحن والتوريد — AMANCO PLUS</p>
              <p className="text-slate-400">..............................</p>
            </div>
            <div>
              <p className="font-bold text-slate-800 mb-8">توقيع واستلام التاجر</p>
              <p className="text-slate-400">..............................</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
