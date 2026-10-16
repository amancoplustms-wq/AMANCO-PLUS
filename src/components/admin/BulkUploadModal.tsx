'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/client';
import {
  resolveShippingFee,
  formatCurrency,
} from '@/modules/finance/calculator';
import type {
  Merchant,
  Zone,
  ShipmentInsert,
  ShipmentType,
  ShipmentStatus,
} from '@/types/database';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle,
  AlertCircle,
  X,
  FileCheck,
  RefreshCw,
} from 'lucide-react';

interface BulkUploadModalProps {
  merchants: Merchant[];
  zones: Zone[];
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedRow {
  recipient_name: string;
  recipient_phone: string;
  recipient_phone_alt?: string;
  governorate?: string;
  zone_name?: string;
  matched_zone_id: string;
  recipient_address: string;
  package_description: string;
  pieces_count: number;
  shipment_type: ShipmentType;
  expected_cod: number;
  allow_open_package: boolean;
  notes?: string;
  exchange_instructions?: string;
  calculated_fee: number;
  courier_commission: number;
  isValid: boolean;
  validationError?: string;
}

export default function BulkUploadModal({
  merchants,
  zones,
  onClose,
  onSuccess,
}: BulkUploadModalProps) {
  const [selectedMerchantId, setSelectedMerchantId] = useState(
    merchants[0]?.id || '',
  );
  const [defaultZoneId, setDefaultZoneId] = useState(zones[0]?.id || '');
  const [initialStatus, setInitialStatus] = useState<ShipmentStatus>(
    'PICKUP_REQUESTED',
  );

  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. تحميل قالب إكسيل قياسي جاهز
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'اسم المستلم': 'محمد خالد عبد الله',
        'الهاتف': '01012345678',
        'الهاتف البديل': '01123456789',
        'المحافظة': 'القاهرة',
        'اسم المنطقة': 'مدينة نصر ومصر الجديدة',
        'العنوان التفصيلي': '15 شارع عباس العقاد - الدور الرابع - شقة 12',
        'وصف المحتوى': 'ملابس أطفال - قطعتين',
        'عدد القطع': 2,
        'مبلغ التحصيل (COD)': 450,
        'نوع الشحنة (تحصيل عادي / مدفوع مسبقاً / استبدال)': 'تحصيل عادي',
        'مسموح بالفتح (نعم / لا)': 'نعم',
        'تعليمات الاستبدال / ملاحظات': 'التسليم من 2 لـ 6 مساءً',
      },
      {
        'اسم المستلم': 'سارة أحمد محمود',
        'الهاتف': '01234567890',
        'الهاتف البديل': '',
        'المحافظة': 'الجيزة',
        'اسم المنطقة': 'الدقي والمهندسين والعجوزة',
        'العنوان التفصيلي': 'شارع مصدق بجوار بنك مصر',
        'وصف المحتوى': 'أحذية رياضية',
        'عدد القطع': 1,
        'مبلغ التحصيل (COD)': 620,
        'نوع الشحنة (تحصيل عادي / مدفوع مسبقاً / استبدال)': 'تحصيل عادي',
        'مسموح بالفتح (نعم / لا)': 'لا',
        'تعليمات الاستبدال / ملاحظات': 'يرجى الاتصال قبل الوصول بنصف ساعة',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'شحنات أمانكو بلس');

    // ضبط اتساع الأعمدة
    worksheet['!cols'] = [
      { wch: 22 }, // اسم المستلم
      { wch: 14 }, // الهاتف
      { wch: 14 }, // الهاتف البديل
      { wch: 12 }, // المحافظة
      { wch: 26 }, // اسم المنطقة
      { wch: 40 }, // العنوان
      { wch: 24 }, // الوصف
      { wch: 10 }, // القطع
      { wch: 18 }, // COD
      { wch: 30 }, // نوع الشحنة
      { wch: 16 }, // مسموح بالفتح
      { wch: 30 }, // ملاحظات
    ];

    XLSX.writeFile(workbook, 'قالب_رفع_شحنات_أمانكو_بلس.xlsx');
  };

  // 2. قراءة ملف الإكسيل واستخراج الشحنات
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessingFile(true);
    setErrorMessage(null);

    try {
      // جلب أسعار VIP للتاجر المحدد لاحتسابها تلقائياً لكل صف
      const supabase = createClient();
      const { data: vipData } = await supabase
        .from('merchant_vip_rates')
        .select('zone_id, custom_shipping_fee')
        .eq('merchant_id', selectedMerchantId);

      const vipMap: Record<string, number> = {};
      (vipData || []).forEach((v) => {
        vipMap[v.zone_id] = Number(v.custom_shipping_fee);
      });

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
        defval: '',
      });

      if (rawRows.length === 0) {
        setErrorMessage('الملف المرفوع فارغ أو لا يحتوي على صفوف بيانات.');
        setParsedRows([]);
        return;
      }

      const rows: ParsedRow[] = rawRows.map((r, index) => {
        // قراءة الأعمدة بالعربي أو الإنجليزي
        const recipient_name = String(
          r['اسم المستلم'] || r['المستلم'] || r['name'] || r['Recipient'] || '',
        ).trim();
        const recipient_phone = String(
          r['الهاتف'] || r['رقم الهاتف'] || r['phone'] || r['Phone'] || '',
        ).trim();
        const recipient_phone_alt = String(
          r['الهاتف البديل'] || r['alt_phone'] || '',
        ).trim();
        const zone_name_raw = String(
          r['اسم المنطقة'] || r['المنطقة'] || r['zone'] || '',
        ).trim();
        const recipient_address = String(
          r['العنوان التفصيلي'] || r['العنوان'] || r['address'] || '',
        ).trim();
        const package_description =
          String(r['وصف المحتوى'] || r['الوصف'] || r['description'] || '').trim() ||
          'طرد بضاعة عامة';
        const pieces_count = parseInt(r['عدد القطع'] || r['pieces'] || '1') || 1;
        const cod_val = parseFloat(r['مبلغ التحصيل (COD)'] || r['COD'] || r['cod'] || '0') || 0;

        // مطابقة المنطقة بالاسم أو استخدام المنطقة الافتراضية
        let matchedZone = zones.find(
          (z) =>
            zone_name_raw &&
            (z.name.toLowerCase().includes(zone_name_raw.toLowerCase()) ||
              zone_name_raw.toLowerCase().includes(z.name.toLowerCase())),
        );
        if (!matchedZone) {
          matchedZone = zones.find((z) => z.id === defaultZoneId) || zones[0];
        }

        // نوع الشحنة
        const typeRaw = String(
          r['نوع الشحنة (تحصيل عادي / مدفوع مسبقاً / استبدال)'] ||
            r['نوع الشحنة'] ||
            r['type'] ||
            '',
        ).toLowerCase();

        let shipment_type: ShipmentType = 'NORMAL';
        if (typeRaw.includes('مسبق') || typeRaw.includes('prepaid')) {
          shipment_type = 'PREPAID';
        } else if (typeRaw.includes('استبدال') || typeRaw.includes('exchange')) {
          shipment_type = 'EXCHANGE';
        }

        // مسموح بالفتح
        const openRaw = String(
          r['مسموح بالفتح (نعم / لا)'] || r['مسموح بالفتح'] || r['open'] || '',
        ).toLowerCase();
        const allow_open_package =
          openRaw.includes('نعم') ||
          openRaw.includes('yes') ||
          openRaw.includes('true') ||
          openRaw === '';

        const notes = String(
          r['تعليمات الاستبدال / ملاحظات'] || r['ملاحظات'] || r['notes'] || '',
        ).trim();

        // حساب سعر الشحن مع مراعاة VIP
        const vipFee = vipMap[matchedZone.id] ?? null;
        const fee = resolveShippingFee({
          zoneBaseShippingFee: Number(matchedZone.base_shipping_fee),
          merchantVipFee: vipFee,
        });

        // التحقق من صحة الحقول الإلزامية
        let isValid = true;
        let validationError = '';

        if (!recipient_name) {
          isValid = false;
          validationError = 'اسم المستلم مفقود';
        } else if (!recipient_phone) {
          isValid = false;
          validationError = 'رقم الهاتف مفقود';
        } else if (!recipient_address) {
          isValid = false;
          validationError = 'العنوان مفقود';
        }

        return {
          recipient_name,
          recipient_phone,
          recipient_phone_alt,
          zone_name: matchedZone.name,
          matched_zone_id: matchedZone.id,
          recipient_address,
          package_description,
          pieces_count,
          shipment_type,
          expected_cod: shipment_type === 'PREPAID' ? 0 : cod_val,
          allow_open_package,
          notes,
          exchange_instructions: shipment_type === 'EXCHANGE' ? notes : '',
          calculated_fee: fee,
          courier_commission: Number(matchedZone.courier_commission),
          isValid,
          validationError,
        };
      });

      setParsedRows(rows);
    } catch (err: unknown) {
      setErrorMessage(`حدث خطأ أثناء معالجة ملف الإكسيل: ${(err as Error).message}`);
    } finally {
      setIsProcessingFile(false);
    }
  };

  // 3. اعتماد وحفظ جميع الشحنات الصالحة في Supabase
  const handleSaveAll = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      alert('لا توجد شحنات صالحة للحفظ');
      return;
    }

    setSavingBatch(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();

      const inserts: ShipmentInsert[] = validRows.map((r) => ({
        merchant_id: selectedMerchantId,
        zone_id: r.matched_zone_id,
        courier_id: null,
        recipient_name: r.recipient_name,
        recipient_phone: r.recipient_phone,
        recipient_phone_alt: r.recipient_phone_alt || null,
        recipient_address: r.recipient_address,
        package_description: r.package_description,
        pieces_count: r.pieces_count,
        shipment_type: r.shipment_type,
        status: initialStatus,
        expected_cod: r.expected_cod,
        collected_cash: 0,
        shipping_fee: r.calculated_fee,
        return_fee_bearer: 'NONE',
        courier_commission: r.courier_commission,
        merchant_net_amount: 0,
        is_courier_cash_settled: false,
        is_courier_commission_settled: false,
        settlement_id: null,
        allow_open_package: r.allow_open_package,
        exchange_instructions: r.exchange_instructions || null,
        partial_delivery_notes: null,
        delivery_notes: r.notes || null,
      }));

      // إدراج الدفعة في جدول shipments
      const { error } = await supabase.from('shipments').insert(inserts);

      if (error) throw error;

      onSuccess();
    } catch (err: unknown) {
      setErrorMessage(`حدث خطأ أثناء حفظ الشحنات المجمعة: ${(err as Error).message}`);
    } finally {
      setSavingBatch(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.length - validCount;
  const totalBatchCod = parsedRows
    .filter((r) => r.isValid)
    .reduce((acc, r) => acc + r.expected_cod, 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-6 flex flex-col max-h-[90vh]">
        {/* رأس المودال */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-600 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet size={24} className="text-emerald-200" />
            <div>
              <h3 className="font-black text-base">
                رفع شحنات مجمعة عبر شيت Excel / CSV
              </h3>
              <p className="text-xs text-emerald-100">
                استيراد مئات الشحنات دفعة واحدة، حساب أسعار الشحن تلقائياً، وإصدار البوالص
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* جسم المودال */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* الخطوة 1: تحديد التاجر والمنطقة الافتراضية وتحميل القالب */}
          <div className="grid sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                التاجر الراسل <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedMerchantId}
                onChange={(e) => setSelectedMerchantId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 bg-white"
              >
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.brand_name} ({m.name}) {m.is_vip ? '👑 VIP' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                المنطقة الافتراضية (في حال عدم تحديدها)
              </label>
              <select
                value={defaultZoneId}
                onChange={(e) => setDefaultZoneId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 bg-white"
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.governorate} - {z.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                حالة الشحنات عند الإدراج
              </label>
              <select
                value={initialStatus}
                onChange={(e) => setInitialStatus(e.target.value as ShipmentStatus)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 bg-white"
              >
                <option value="PICKUP_REQUESTED">طلب استلام من مقر التاجر (Pickup)</option>
                <option value="AT_HUB">مستلمة بالفعل بالمخزن (Hub)</option>
              </select>
            </div>
          </div>

          {/* الخطوة 2: زر تنزيل القالب + منطقة سحب وإفلات الملف */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-300 w-full sm:w-auto shrink-0 cursor-pointer"
            >
              <Download size={16} className="text-emerald-600" />
              <span>تحميل قالب Excel الجاهز</span>
            </button>

            <label className="flex-1 w-full border-2 border-dashed border-emerald-400 bg-emerald-50/40 hover:bg-emerald-50 rounded-xl p-4 flex items-center justify-center gap-3 cursor-pointer transition-all">
              <Upload size={20} className="text-emerald-600" />
              <div className="text-xs text-center sm:text-right">
                <span className="font-bold text-emerald-900 block">
                  {fileName ? `الملف المختار: ${fileName}` : 'اضغط لاختيار ملف Excel (.xlsx) أو اسحبه هنا'}
                </span>
                <span className="text-[11px] text-slate-500">
                  سيقوم النظام بقراءة الأعمدة آلياً وعرض المعاينة قبل الحفظ
                </span>
              </div>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* الخطوة 3: جدول المعاينة للشحنات المستخرجة */}
          {isProcessingFile ? (
            <div className="py-12 text-center text-slate-400">
              <RefreshCw size={28} className="animate-spin mx-auto mb-2 text-emerald-600" />
              <p className="text-xs">جاري فحص وتدقيق صفوف الشيت واحتساب الأسعار...</p>
            </div>
          ) : parsedRows.length > 0 ? (
            <div className="space-y-3">
              {/* ملخص التحليل */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 p-3 rounded-xl text-xs font-bold">
                <div className="flex items-center gap-3">
                  <span className="text-slate-700">
                    إجمالي الصفوف: <span className="font-black">{parsedRows.length}</span>
                  </span>
                  <span className="text-emerald-700">
                    صالحة للاعتماد: <span className="font-black">{validCount}</span>
                  </span>
                  {invalidCount > 0 && (
                    <span className="text-red-600">
                      بيانات ناقصة: <span className="font-black">{invalidCount}</span>
                    </span>
                  )}
                </div>

                <div className="text-emerald-800">
                  إجمالي مبالغ التحصيل (COD):{' '}
                  <span className="font-black text-sm" dir="ltr">
                    {formatCurrency(totalBatchCod)}
                  </span>
                </div>
              </div>

              {/* الجدول */}
              <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-64">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">المستلم والهاتف</th>
                      <th className="py-2.5 px-3">المنطقة والعنوان</th>
                      <th className="py-2.5 px-3">نوع الشحنة</th>
                      <th className="py-2.5 px-3">مبلغ التحصيل (COD)</th>
                      <th className="py-2.5 px-3">سعر الشحن</th>
                      <th className="py-2.5 px-3">المعاينة</th>
                      <th className="py-2.5 px-3">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((r, i) => (
                      <tr
                        key={i}
                        className={`hover:bg-slate-50 ${
                          !r.isValid ? 'bg-red-50/40 text-red-900' : ''
                        }`}
                      >
                        <td className="py-2 px-3 font-mono text-slate-400">{i + 1}</td>
                        <td className="py-2 px-3">
                          <div className="font-bold">{r.recipient_name || '-'}</div>
                          <div className="text-[11px] text-slate-500 font-mono" dir="ltr">
                            {r.recipient_phone || '-'}
                          </div>
                        </td>
                        <td className="py-2 px-3 max-w-xs truncate">
                          <div className="font-semibold text-blue-700">{r.zone_name}</div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {r.recipient_address || '-'}
                          </div>
                        </td>
                        <td className="py-2 px-3 font-medium">{r.shipment_type}</td>
                        <td className="py-2 px-3 font-bold text-slate-900" dir="ltr">
                          {formatCurrency(r.expected_cod)}
                        </td>
                        <td className="py-2 px-3 font-bold text-blue-700" dir="ltr">
                          {formatCurrency(r.calculated_fee)}
                        </td>
                        <td className="py-2 px-3">
                          {r.allow_open_package ? (
                            <span className="text-[10px] text-emerald-700 font-bold">✓ مسموح</span>
                          ) : (
                            <span className="text-[10px] text-red-600 font-bold">✕ غير مسموح</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {r.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                              <CheckCircle size={13} />
                              جاهزة
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-red-600 font-bold">
                              <AlertCircle size={13} />
                              {r.validationError}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>

        {/* أسفل المودال: أزرار الاعتماد */}
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
            onClick={handleSaveAll}
            disabled={savingBatch || validCount === 0}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-50 shadow-md cursor-pointer"
          >
            <FileCheck size={16} />
            <span>
              {savingBatch
                ? 'جاري إدراج الشحنات...'
                : `اعتماد وحفظ (${validCount}) شحنة وإصدار البوالص`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
