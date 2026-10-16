'use client';

import React, { useState } from 'react';
import A4Waybill, { WaybillShipmentData } from './A4Waybill';
import { printElementById } from '@/lib/printElement';
import { Printer, LayoutGrid, Rows, X, FileText, FileCheck } from 'lucide-react';

interface PrintShipmentsModalProps {
  shipments: WaybillShipmentData[];
  onClose: () => void;
}

export default function PrintShipmentsModal({
  shipments,
  onClose,
}: PrintShipmentsModalProps) {
  // اختيار ذكي للوضع الافتراضي: إذا شحنة واحدة → بوليصة واحدة، وإلا → بوليصتين
  const [layoutMode, setLayoutMode] = useState<'single' | 'half' | 'quarter'>(
    shipments.length === 1 ? 'single' : 'half',
  );

  const handlePrint = () => {
    printElementById('waybills-print-container', `بوالص أمانكو بلس للشحن والتوريد — AMANCO PLUS (${shipments.length} شحنة)`);
  };

  // تقسيم الشحنات إلى صفحات طبقاً لحجم التخطيط
  const pageSize = layoutMode === 'single' ? 1 : layoutMode === 'half' ? 2 : 4;
  const pages: WaybillShipmentData[][] = [];
  for (let i = 0; i < shipments.length; i += pageSize) {
    pages.push(shipments.slice(i, i + pageSize));
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs p-2 sm:p-6 flex flex-col items-center">
      {/* شريط التحكم العلوي للمعاينة (no-print) */}
      <div className="w-full max-w-5xl bg-white p-4 rounded-2xl shadow-xl border border-slate-200 mb-4 flex flex-wrap items-center justify-between gap-3 sticky top-2 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
            <FileText size={20} />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-base">
              معاينة طباعة بوالص الشحن ({shipments.length} بوليصة في {pages.length} صفحة A4)
            </h3>
            <p className="text-xs text-slate-500">
              اختر التنسيق المناسب للورق القياسي A4 ثم اضغط طباعة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* تبديل وضع التخطيط */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setLayoutMode('single')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                layoutMode === 'single'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCheck size={15} />
              <span>بوليصة واحدة (1 في الورقة)</span>
            </button>

            <button
              onClick={() => setLayoutMode('half')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                layoutMode === 'half'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Rows size={15} />
              <span>بوليصتان في A4</span>
            </button>

            <button
              onClick={() => setLayoutMode('quarter')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                layoutMode === 'quarter'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid size={15} />
              <span>4 بوالص في A4</span>
            </button>
          </div>

          {/* زر الطباعة الفعلي المعزول عبر Iframe */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <Printer size={16} />
            <span>طباعة الآن (A4)</span>
          </button>

          {/* زر الإغلاق */}
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            title="إغلاق المعاينة"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* حاوية صفحات البوالص للمعاينة والطباعة المعزولة */}
      {/* ==================================================================== */}
      <div id="waybills-print-container" className="w-full max-w-5xl flex flex-col items-center">
        {pages.map((pageShipments, pageIdx) => {
          const isLastPage = pageIdx === pages.length - 1;
          return (
            <div
              key={`page-${pageIdx}`}
              className={`a4-print-page w-[210mm] max-w-full bg-white shadow-2xl p-[6mm] mx-auto box-border border border-slate-300 rounded-xl mb-6 last:mb-0 ${
                isLastPage ? 'last-page' : ''
              }`}
              style={{
                height: '296mm',
                maxHeight: '296mm',
              }}
            >
              {layoutMode === 'single' && (
                <div className="h-full flex flex-col justify-start">
                  {/* النصف العلوي: بوليصة واحدة فقط بارتفاع قياسي 138mm */}
                  <div className="h-[138mm] max-h-[138mm]">
                    <A4Waybill shipment={pageShipments[0]} mode="single" />
                  </div>

                  {/* خط القص المنقط الفاصل أسفل البوليصة مباشرة */}
                  <div className="my-4 border-b-2 border-dashed border-slate-400 relative flex items-center justify-center">
                    <span className="bg-white px-3 text-[11px] text-slate-500 font-bold -mb-3">
                      ✂️ خط قص البوليصة (Cut Line)
                    </span>
                  </div>

                  {/* باقي مساحة الورقة فارغ للتسهيل على التاجر أو السائق */}
                  <div className="flex-1" />
                </div>
              )}

              {layoutMode === 'half' && (
                <div className="h-full flex flex-col justify-between">
                  {/* البوليصة الأولى بارتفاع 136mm */}
                  <div className="h-[136mm] max-h-[136mm]">
                    <A4Waybill shipment={pageShipments[0]} mode="half" />
                  </div>

                  {/* خط القص المنقط الفاصل بارتفاع 8mm */}
                  <div className="h-[8mm] border-b-2 border-dashed border-slate-400 relative flex items-center justify-center">
                    <span className="bg-white px-3 text-[11px] text-slate-500 font-bold -mb-3">
                      ✂️ خط قص الورقة (Cut Line)
                    </span>
                  </div>

                  {/* البوليصة الثانية إذا وُجدت بارتفاع 136mm */}
                  {pageShipments.length > 1 ? (
                    <div className="h-[136mm] max-h-[136mm]">
                      <A4Waybill shipment={pageShipments[1]} mode="half" />
                    </div>
                  ) : (
                    <div className="h-[136mm] max-h-[136mm] border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-slate-300 text-xs font-bold no-print">
                      مساحة نصف صفحة فارغة
                    </div>
                  )}
                </div>
              )}

              {layoutMode === 'quarter' && (
                <div className="h-full grid grid-cols-2 grid-rows-2 gap-2.5">
                  {pageShipments.map((s) => (
                    <div key={s.id} className="h-[138mm] max-h-[138mm] min-h-0 min-w-0">
                      <A4Waybill shipment={s} mode="quarter" />
                    </div>
                  ))}
                  {Array.from({ length: 4 - pageShipments.length }).map((_, emptyIdx) => (
                    <div
                      key={`empty-${emptyIdx}`}
                      className="h-[138mm] max-h-[138mm] border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-slate-300 text-xs font-bold no-print"
                    >
                      مساحة بوليصة فارغة
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
