'use client';

import React from 'react';
import Barcode from 'react-barcode';
import { Phone } from 'lucide-react';
import BrandLogo from '@/components/public/BrandLogo';
import {
  SHIPMENT_TYPE_LABELS,
  ShipmentType,
} from '@/types/database';

export interface WaybillShipmentData {
  id: string;
  awb_number: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_phone_alt?: string | null;
  recipient_address: string;
  package_description: string;
  pieces_count: number;
  shipment_type: ShipmentType;
  allow_open_package: boolean;
  exchange_instructions?: string | null;
  expected_cod: number;
  created_at: string;
  delivery_notes?: string | null;
  merchants?: { name: string; brand_name: string; phone?: string } | null;
  zones?: { name: string; governorate: string } | null;
}

interface A4WaybillProps {
  shipment: WaybillShipmentData;
  mode: 'single' | 'half' | 'quarter';
}

export default function A4Waybill({ shipment, mode }: A4WaybillProps) {
  const isQuarter = mode === 'quarter';
  const isSingle = mode === 'single';

  const brandName = shipment.merchants?.brand_name || shipment.merchants?.name || 'أمانكو بلس';
  const zoneName = shipment.zones?.name || 'عام';
  const govName = shipment.zones?.governorate || 'القاهرة';

  // الارتفاع الدقيق لكل وضع لمنع أي تداخل أو تكرار للصفحات
  const heightClass = isSingle
    ? 'h-[138mm] max-h-[138mm]'
    : isQuarter
    ? 'h-[138mm] max-h-[138mm]'
    : 'h-[136mm] max-h-[136mm]';

  return (
    <div
      className={`border-2 border-slate-900 bg-white text-slate-900 font-sans box-border overflow-hidden flex flex-col ${
        isQuarter ? 'rounded-md' : 'rounded-lg'
      } ${heightClass}`}
      style={{
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
      }}
      dir="rtl"
    >
      {/* ==================================================================== */}
      {/* الصف 1: الهيدر العلوي (قسمان فقط: اللوجو يميناً | الباركود يساراً مع حماية كاملة من القص) */}
      {/* ==================================================================== */}
      <div className={`border-b-2 border-slate-900 flex items-center justify-between bg-white shrink-0 ${
        isQuarter ? 'px-2.5 py-1.5 gap-2' : 'px-3 py-1.5 sm:py-2 gap-3'
      }`}>
        {/* اليمين: اللوجو واسم الشركة في سطرين متناسقين بمحاذاة اليمين */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
          <BrandLogo size={isQuarter ? 'sm' : 'md'} showText={false} className="shrink-0" />
          <div className="flex flex-col items-start justify-center text-right min-w-0">
            {/* السطر الأول: أمانكو بلس بارز وكبير */}
            <span className={`font-black text-slate-900 whitespace-nowrap leading-tight ${
              isQuarter ? 'text-[12.5px]' : 'text-lg sm:text-xl'
            }`}>
              أمانكو <span className="text-[#f97316]">بلس</span>
            </span>

            {/* السطر الثاني: في وضع 4 بوالص نجعله مختصراً ذكياً لمنع أي ضغط على الباركود */}
            {isQuarter ? (
              <div className="font-bold text-slate-500 whitespace-nowrap flex items-center gap-1 mt-0.5 leading-tight text-[8px]">
                <span className="font-sans font-extrabold uppercase tracking-wider text-slate-800 text-[7.5px]">
                  AMANCO <span className="text-[#f97316]">PLUS</span>
                </span>
                <span className="text-slate-300">•</span>
                <span>خدمة العملاء: <span dir="ltr" className="font-black text-slate-900">01274365996</span></span>
              </div>
            ) : (
              <div className="font-bold text-slate-500 whitespace-nowrap flex items-center gap-1.5 mt-0.5 leading-tight text-xs">
                <span className="font-sans font-extrabold uppercase tracking-wider text-slate-800 text-[11px]">
                  AMANCO <span className="text-[#f97316]">PLUS</span>
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-700">للشحن والتوريد</span>
                <span className="text-slate-300">•</span>
                <span>خدمة العملاء: <span dir="ltr" className="font-black text-slate-900">01274365996</span></span>
              </div>
            )}
          </div>
        </div>

        {/* اليسار: الباركود ورقم البوليصة وتاريخ الإصدار أسفله مع مساحة أمان وحماية من التآكل */}
        <div className="text-center flex flex-col items-center justify-center shrink-0 pl-1 pr-0.5">
          <div dir="ltr" className="flex justify-center items-center max-w-[115px] sm:max-w-[130px] [&>svg]:max-w-full [&>svg]:h-auto">
            <Barcode
              value={shipment.awb_number}
              width={isQuarter ? 0.8 : 1.35}
              height={isQuarter ? 20 : 24}
              displayValue={false}
              margin={2}
              background="transparent"
            />
          </div>
          <span className={`font-mono font-black text-slate-900 leading-tight tracking-wider mt-0.5 ${
            isQuarter ? 'text-[9.5px]' : 'text-xs sm:text-sm'
          }`} dir="ltr">
            {shipment.awb_number}
          </span>
          <span className={`font-mono text-slate-500 font-bold leading-tight ${
            isQuarter ? 'text-[7.5px]' : 'text-[10px]'
          }`} dir="ltr">
            {new Date(shipment.created_at).toLocaleDateString('ar-EG')}
          </span>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* الصف 2: شريط منطقة التوزيع والراسل (مقسم لخانتين بعرض كامل) */}
      {/* ==================================================================== */}
      <div className="border-b-2 border-slate-900 grid grid-cols-12 items-stretch shrink-0 bg-white">
        {/* الخانة اليمنى (60%): منطقة التوزيع والفرز بدون truncate وتلتف في سطرين */}
        <div className={`col-span-7 bg-slate-100 px-2 sm:px-2.5 border-l-2 border-slate-900 flex flex-col justify-center ${
          isQuarter ? 'py-1' : 'py-2 sm:py-2.5'
        }`}>
          <span className={`text-slate-500 font-bold block leading-none ${
            isQuarter ? 'text-[8px]' : 'text-[9.5px]'
          }`}>
            منطقة التوزيع والفرز:
          </span>
          <span className={`font-black text-slate-900 leading-tight block mt-0.5 break-words ${
            isQuarter ? 'text-[11.5px]' : 'text-sm sm:text-base'
          }`}>
            {govName} - {zoneName}
          </span>
        </div>

        {/* الخانة اليسرى (40%): الراسل (التاجر) ورقم هاتفه */}
        <div className={`col-span-5 px-2 sm:px-2.5 flex flex-col justify-center bg-white ${
          isQuarter ? 'py-1' : 'py-2 sm:py-2.5'
        }`}>
          <span className={`text-slate-500 font-bold block leading-none ${
            isQuarter ? 'text-[8px]' : 'text-[9.5px]'
          }`}>
            الراسل (التاجر):
          </span>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 mt-0.5">
            <span className={`font-black text-slate-900 leading-tight break-words ${
              isQuarter ? 'text-[10.5px]' : 'text-xs sm:text-sm'
            }`}>
              {brandName}
            </span>
            {shipment.merchants?.phone && (
              <span className={`font-mono text-slate-700 font-bold shrink-0 ${
                isQuarter ? 'text-[9px]' : 'text-xs'
              }`} dir="ltr">
                {shipment.merchants.phone}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* الصف 3: قسم بيانات المستلم والعنوان التفصيلي (تم تقليص الفراغ الزائد) */}
      {/* ==================================================================== */}
      <div className="p-2 sm:p-2.5 border-b-2 border-slate-900 bg-white flex-1 flex flex-col justify-start">
        {/* 1) صف اسم المستلم وأرقام التواصل في الأعلى */}
        <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-1.5 shrink-0">
          <div className="min-w-0 flex-1">
            <span className={`text-slate-500 font-bold block leading-none ${
              isQuarter ? 'text-[8px]' : 'text-[9.5px]'
            }`}>
              اسم المستلم:
            </span>
            <span className={`font-black text-slate-900 block leading-tight mt-0.5 break-words ${
              isQuarter ? 'text-[12.5px]' : 'text-base sm:text-lg'
            }`}>
              {shipment.recipient_name}
            </span>
          </div>

          {/* صندوق أرقام التواصل الاحترافي */}
          <div className="shrink-0 bg-slate-50 border border-slate-300 rounded-lg px-2 sm:px-2.5 py-1 text-right flex flex-col justify-center min-w-[125px] sm:min-w-[145px]">
            {/* عنوان القسم مع الأيقونة واتجاه RTL صحيح تماماً */}
            <div className="flex items-center gap-1 text-slate-500 font-bold leading-none mb-1">
              <Phone size={isQuarter ? 9.5 : 11} className="text-blue-700 shrink-0" />
              <span className={isQuarter ? 'text-[8px]' : 'text-[9.5px]'}>
                أرقام التواصل:
              </span>
            </div>

            {/* الرقم الأساسي بخط Mono بارز وواضح */}
            <span className={`font-mono font-black text-slate-900 block leading-tight tracking-wide ${
              isQuarter ? 'text-[11px]' : 'text-xs sm:text-sm'
            }`} dir="ltr">
              {shipment.recipient_phone}
            </span>

            {/* الرقم البديل مع تمييز واضح كسطر منفصل (إن وجد) */}
            {shipment.recipient_phone_alt && (
              <div className="flex items-center justify-between gap-1 mt-1 pt-1 border-t border-slate-200">
                <span className={`text-slate-400 font-bold leading-none ${
                  isQuarter ? 'text-[7.5px]' : 'text-[8.5px]'
                }`}>
                  بديل:
                </span>
                <span className={`font-mono font-bold text-slate-600 block leading-tight ${
                  isQuarter ? 'text-[9.5px]' : 'text-xs'
                }`} dir="ltr">
                  {shipment.recipient_phone_alt}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 2) صندوق العنوان التفصيلي: متناسق ومضغوط بدون فراغ عائم ضخم */}
        <div className="pt-1.5 flex flex-col items-start justify-start text-right">
          <span className={`text-slate-500 font-bold block leading-none ${
            isQuarter ? 'text-[8px]' : 'text-[9.5px]'
          }`}>
            العنوان التفصيلي:
          </span>
          <p className={`font-bold text-slate-800 leading-snug break-words mt-1 ${
            isQuarter ? 'text-[10.5px] line-clamp-2' : 'text-xs sm:text-sm line-clamp-2 sm:line-clamp-3'
          }`}>
            {shipment.recipient_address}
          </p>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* الصف 4: تفاصيل الطرد والملاحظات (مقسم لصفوف واضحة بحدود جدول متصلة ومريحة) */}
      {/* ==================================================================== */}
      <div className="border-b-2 border-slate-900 flex flex-col shrink-0 bg-white">
        {/* 1) الصف الأول (مقسوم لخانتين متساويتين grid-cols-2 بعرض البوليصة) */}
        <div className="grid grid-cols-2 items-center border-b border-slate-300 divide-x-2 divide-x-reverse divide-slate-900 bg-slate-100/70">
          {/* الخانة اليمنى: نوع الشحنة */}
          <div className={`px-2.5 flex items-center justify-start gap-2 ${
            isQuarter ? 'py-1' : 'py-1.5 sm:py-2'
          }`}>
            <span className={`text-slate-600 font-bold shrink-0 ${isQuarter ? 'text-[8.5px]' : 'text-xs'}`}>
              نوع الشحنة:
            </span>
            <span className={`font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300 whitespace-nowrap inline-flex items-center ${
              isQuarter ? 'text-[9px]' : 'text-xs'
            }`}>
              {SHIPMENT_TYPE_LABELS[shipment.shipment_type]}
            </span>
          </div>

          {/* الخانة اليسرى: عدد القطع */}
          <div className={`px-2.5 flex items-center justify-start gap-2 ${
            isQuarter ? 'py-1' : 'py-1.5 sm:py-2'
          }`}>
            <span className={`text-slate-600 font-bold shrink-0 ${isQuarter ? 'text-[8.5px]' : 'text-xs'}`}>
              عدد القطع:
            </span>
            <span className={`font-black text-slate-900 whitespace-nowrap ${
              isQuarter ? 'text-[9.5px]' : 'text-xs'
            }`}>
              {shipment.pieces_count} قطعة
            </span>
          </div>
        </div>

        {/* 2) الصف الثاني (بعرض البوليصة بالكامل 100%): محتوى الطرد */}
        <div className={`px-2.5 border-b border-slate-300 flex items-center gap-1.5 bg-white ${
          isQuarter ? 'py-1' : 'py-1.5 sm:py-2'
        }`}>
          <span className={`text-slate-600 font-bold shrink-0 ${isQuarter ? 'text-[8.5px]' : 'text-xs'}`}>
            محتوى الطرد:
          </span>
          <span className={`font-bold text-slate-900 leading-tight break-words line-clamp-1 ${
            isQuarter ? 'text-[9.5px]' : 'text-xs sm:text-sm'
          }`}>
            {shipment.package_description || 'بضاعة عامة'}
          </span>
        </div>

        {/* 3) الصف الثالث (بعرض البوليصة بالكامل 100% - خلفية كهرمانية): ملاحظات التسليم */}
        <div className={`px-2.5 bg-amber-50 text-amber-950 font-bold flex items-center gap-1.5 ${
          isQuarter ? 'py-1 text-[8.5px]' : 'py-1.5 sm:py-2 text-xs'
        }`}>
          <span className="shrink-0 text-amber-800">⚠️ ملاحظات التسليم:</span>
          <span className="leading-tight break-words line-clamp-1 text-slate-900">
            {shipment.shipment_type === 'EXCHANGE' && shipment.exchange_instructions
              ? `استبدال: ${shipment.exchange_instructions}`
              : shipment.delivery_notes || 'تسليم قياسي - يرجى الاتصال بالمستلم قبل الوصول'}
          </span>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* الصف 5: الفوتر المالي المدمج (متصل مباشرة بالصف الرابع بدون فجوة) */}
      {/* ==================================================================== */}
      <div className="shrink-0 flex flex-col bg-white">
        {/* شريط حالة المعاينة الملون والعريض المتصل بالجدول */}
        <div
          className={`w-full text-center font-black uppercase tracking-wide border-b-2 border-slate-900 whitespace-nowrap inline-flex items-center justify-center ${
            isQuarter ? 'text-[9.5px] py-0.5' : 'text-xs sm:text-sm py-1'
          } ${
            shipment.allow_open_package
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {shipment.allow_open_package ? '✓ مسموح بفتح ومعاينة الشحنة' : '✕ غير مسموح بفتح الشحنة قبل الاستلام'}
        </div>

        {/* قسم التحصيل والتوقيع */}
        <div className="grid grid-cols-12 items-stretch bg-white">
          {/* يميناً (65%): صندوق المبلغ المطلوب تحصيله بارز جداً */}
          <div className={`col-span-8 bg-slate-950 text-white flex flex-col justify-center text-center ${
            isQuarter ? 'p-1.5' : 'p-2.5 sm:p-3'
          }`}>
            <span className={`font-bold text-slate-300 block whitespace-nowrap ${
              isQuarter ? 'text-[8.5px]' : 'text-xs sm:text-sm'
            }`}>
              {shipment.shipment_type === 'PREPAID'
                ? 'شحنة مدفوعة مسبقاً'
                : 'المبلغ المطلوب تحصيله من العميل (COD)'}
            </span>
            <span className={`font-black font-mono tracking-tight block whitespace-nowrap mt-0.5 ${
              isQuarter ? 'text-[16px]' : 'text-2xl sm:text-3xl'
            }`} dir="ltr">
              {shipment.shipment_type === 'PREPAID'
                ? '0.00 EGP'
                : `${Number(shipment.expected_cod).toLocaleString('ar-EG')} ج.م`}
            </span>
          </div>

          {/* يساراً (35%): صندوق توقيع المستلم وموقع التتبع */}
          <div className={`col-span-4 border-r-2 border-slate-900 flex flex-col justify-between text-slate-800 bg-slate-50 ${
            isQuarter ? 'p-1' : 'p-2 sm:p-2.5'
          }`}>
            <div>
              <span className={`font-bold text-slate-600 block leading-none ${
                isQuarter ? 'text-[8px]' : 'text-[10px]'
              }`}>
                توقيع المستلم:
              </span>
              <div className={`border-b border-dashed border-slate-400 ${
                isQuarter ? 'mt-2' : 'mt-4 sm:mt-5'
              }`} />
            </div>
            <div className={`font-bold text-slate-600 text-center font-mono leading-none ${
              isQuarter ? 'text-[8px]' : 'text-[10px]'
            }`} dir="ltr">
              amanco-plus.com
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
