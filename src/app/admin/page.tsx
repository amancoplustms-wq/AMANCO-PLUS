'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  formatCurrency,
} from '@/modules/finance/calculator';
import {
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_TYPE_LABELS,
  ShipmentStatus,
  ShipmentType,
} from '@/types/database';
import {
  Package,
  Truck,
  Users,
  UserPlus,
  RefreshCw,
  Plus,
  ArrowUpRight,
  Clock,
  Warehouse,
  CheckCircle2,
  RotateCcw,
  Banknote,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
} from 'lucide-react';

interface ShipmentWithDetails {
  id: string;
  awb_number: string;
  recipient_name: string;
  recipient_phone: string;
  expected_cod: number;
  collected_cash: number;
  shipment_type: ShipmentType;
  status: ShipmentStatus;
  created_at: string;
  merchants?: { name: string; brand_name: string } | null;
  zones?: { name: string; governorate: string } | null;
  couriers?: { name: string } | null;
}

interface DashboardStats {
  totalShipments: number;
  pickupRequested: number;
  atHub: number;
  outForDelivery: number;
  deliveredTotal: number;
  returnedTotal: number;
  unsettledCourierCash: number;
  unreadLeadsCount: number;
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalShipments: 0,
    pickupRequested: 0,
    atHub: 0,
    outForDelivery: 0,
    deliveredTotal: 0,
    returnedTotal: 0,
    unsettledCourierCash: 0,
    unreadLeadsCount: 0,
  });
  const [recentShipments, setRecentShipments] = useState<ShipmentWithDetails[]>([]);

  const fetchDashboardData = useCallback(async () => {
    try {
      const supabase = createClient();

      // جلب جميع الشحنات وطلبات الانضمام بالتوازي عبر Promise.all لتسريع التحميل
      const [shipmentsRes, leadsRes] = await Promise.all([
        supabase
          .from('shipments')
          .select(`
            id,
            awb_number,
            recipient_name,
            recipient_phone,
            expected_cod,
            collected_cash,
            shipment_type,
            status,
            is_courier_cash_settled,
            created_at,
            merchants:merchant_id (name, brand_name),
            zones:zone_id (name, governorate),
            couriers:courier_id (name)
          `)
          .order('created_at', { ascending: false }),

        supabase
          .from('merchant_leads')
          .select('*', { count: 'exact', head: true })
          .eq('is_contacted', false),
      ]);

      if (shipmentsRes.error) {
        console.error('Error fetching shipments:', shipmentsRes.error);
      }
      if (leadsRes.error) {
        console.error('Error fetching leads count:', leadsRes.error);
      }

      const shipments = (shipmentsRes.data as unknown as ShipmentWithDetails[]) || [];
      const leadsCount = leadsRes.count || 0;

      // احتساب الـ KPIs
      let pickup = 0;
      let hub = 0;
      let outDelivery = 0;
      let delivered = 0;
      let returned = 0;
      let unsettledCash = 0;

      shipments.forEach((s) => {
        if (s.status === 'PICKUP_REQUESTED') pickup++;
        else if (s.status === 'AT_HUB') hub++;
        else if (s.status === 'OUT_FOR_DELIVERY') outDelivery++;
        else if (
          s.status === 'DELIVERED' ||
          s.status === 'PARTIAL_DELIVERED' ||
          s.status === 'EXCHANGED'
        ) {
          delivered++;
        } else if (s.status === 'RETURNED') {
          returned++;
        }

        // الكاش غير المورد للخزنة بيد المندوب
        // (أي شحنة تم تحصيل كاش منها ولم يتم تقفيلها مع المندوب بعد)
        const isSettled = (s as unknown as { is_courier_cash_settled: boolean }).is_courier_cash_settled;
        if (!isSettled && (s.collected_cash || 0) > 0) {
          unsettledCash += Number(s.collected_cash) || 0;
        }
      });

      setStats({
        totalShipments: shipments.length,
        pickupRequested: pickup,
        atHub: hub,
        outForDelivery: outDelivery,
        deliveredTotal: delivered,
        returnedTotal: returned,
        unsettledCourierCash: unsettledCash,
        unreadLeadsCount: leadsCount || 0,
      });

      // أحدث 10 شحنات
      setRecentShipments(shipments.slice(0, 10));
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const getStatusBadgeClass = (status: ShipmentStatus) => {
    switch (status) {
      case 'PICKUP_REQUESTED':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'AT_HUB':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'OUT_FOR_DELIVERY':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'DELIVERED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PARTIAL_DELIVERED':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'EXCHANGED':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'RETURNED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'POSTPONED':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-8">
      {/* ==================================================================== */}
      {/* ترويسة الصفحة مع أزرار الإجراءات السريعة */}
      {/* ==================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-brand-navy">
              لوحة الإحصائيات المركزية
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              نظام حي ومباشر
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            متابعة حركة الشحنات، السيولة النقدية، وطلبات التجار في القاهرة والجيزة والقليوبية
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60"
            title="تحديث البيانات"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin text-brand-orange' : ''} />
            <span>تحديث</span>
          </button>

          <Link
            href="/admin/shipments"
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Plus size={16} />
            <span>إضافة شحنة</span>
          </Link>

          <Link
            href="/admin/merchants"
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-navy hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Users size={16} />
            <span>إضافة تاجر</span>
          </Link>

          <Link
            href="/admin/couriers"
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-orange hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Truck size={16} />
            <span>إضافة مندوب</span>
          </Link>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* بطاقات الإحصائيات الرئيسية (KPI Cards) */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* إجمالي الشحنات */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500">إجمالي الشحنات</span>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Package size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 mb-1">
            {loading ? '...' : stats.totalShipments.toLocaleString('ar-EG')}
          </div>
          <div className="text-xs text-slate-400">كافة الشحنات المسجلة بالنظام</div>
        </div>

        {/* طلبات استلام Pickup */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-amber-700">طلبات الاستلام</span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-600 mb-1">
            {loading ? '...' : stats.pickupRequested.toLocaleString('ar-EG')}
          </div>
          <div className="text-xs text-amber-700/70">بانتظار إرسال مندوب للتاجر</div>
        </div>

        {/* شحنات بالمخزن */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-blue-700">بالمخزن الرئيسي</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Warehouse size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            {loading ? '...' : stats.atHub.toLocaleString('ar-EG')}
          </div>
          <div className="text-xs text-blue-700/70">جاهزة للفرز والتوزيع على المناديب</div>
        </div>

        {/* خارج للتسليم */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group hover:border-indigo-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-indigo-700">خرجت للتسليم</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Truck size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-indigo-600 mb-1">
            {loading ? '...' : stats.outForDelivery.toLocaleString('ar-EG')}
          </div>
          <div className="text-xs text-indigo-700/70">في عهدة المناديب بخطوط السير</div>
        </div>

        {/* تم التسليم بنجاح */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-emerald-700">شحنات ناجحة</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-600 mb-1">
            {loading ? '...' : stats.deliveredTotal.toLocaleString('ar-EG')}
          </div>
          <div className="text-xs text-emerald-700/70">تسليم كلي / جزئي / استبدال</div>
        </div>

        {/* شحنات مرتجعة */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group hover:border-rose-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-rose-700">شحنات مرتجعة</span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <RotateCcw size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-rose-600 mb-1">
            {loading ? '...' : stats.returnedTotal.toLocaleString('ar-EG')}
          </div>
          <div className="text-xs text-rose-700/70">عادت للمخزن أو بانتظار ردها للتاجر</div>
        </div>

        {/* كاش مع المناديب غير مورد */}
        <div className="bg-white p-5 rounded-2xl border border-amber-300 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-amber-900">نقدية بعهدة المناديب</span>
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Banknote size={20} />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700 mb-1" dir="ltr">
            {loading ? '...' : formatCurrency(stats.unsettledCourierCash)}
          </div>
          <div className="text-xs text-amber-800 font-medium">غير موردة للخزنة بعد</div>
        </div>

        {/* طلبات انضمام تجار جديدة */}
        <Link
          href="/admin/leads"
          className="bg-gradient-to-br from-purple-50 to-indigo-50/50 p-5 rounded-2xl border border-purple-200 shadow-xs relative overflow-hidden group hover:border-purple-400 hover:shadow-sm transition-all block"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-purple-700">طلبات انضمام تجار</span>
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <UserPlus size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-purple-700 mb-1">
            {loading ? '...' : stats.unreadLeadsCount.toLocaleString('ar-EG')}
          </div>
          <div className="text-xs text-purple-600 flex items-center gap-1 font-semibold">
            <span>طلبات جديدة بانتظار التواصل</span>
            <ChevronLeft size={14} />
          </div>
        </Link>
      </div>

      {/* ==================================================================== */}
      {/* جدول أحدث 10 شحنات مسجلة */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">أحدث 10 شحنات مسجلة</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              عرض تفاصيل أحدث الشحنات المسجلة في النظام وحالتها اللحظية
            </p>
          </div>

          <Link
            href="/admin/shipments"
            className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            <span>عرض كافة الشحنات</span>
            <ChevronLeft size={15} />
          </Link>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw size={28} className="animate-spin mx-auto mb-3 text-brand-orange" />
            <p className="text-sm">جاري تحميل أحدث الشحنات من قاعدة البيانات...</p>
          </div>
        ) : recentShipments.length === 0 ? (
          <div className="p-12 text-center">
            <Package size={40} className="mx-auto text-slate-300 mb-3" />
            <h3 className="text-base font-bold text-slate-700 mb-1">لا توجد شحنات مسجلة حتى الآن</h3>
            <p className="text-xs text-slate-400 mb-5">
              ابدأ بإضافة أول شحنة أو رفع شيت إكسيل لتظهر البيانات هنا
            </p>
            <Link
              href="/admin/shipments"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} />
              <span>إضافة شحنة جديدة</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50/80 text-slate-600 text-xs font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">رقم البوليصة (AWB)</th>
                  <th className="py-3.5 px-4">التاجر / البراند</th>
                  <th className="py-3.5 px-4">المستلم والمنطقة</th>
                  <th className="py-3.5 px-4">نوع الشحنة</th>
                  <th className="py-3.5 px-4">المبلغ المطلوب (COD)</th>
                  <th className="py-3.5 px-4">الحالة</th>
                  <th className="py-3.5 px-4">المندوب</th>
                  <th className="py-3.5 px-4">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentShipments.map((shipment) => (
                  <tr key={shipment.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* رقم البوليصة */}
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">
                      <span dir="ltr">{shipment.awb_number}</span>
                    </td>

                    {/* التاجر */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">
                        {shipment.merchants?.brand_name || shipment.merchants?.name || 'تاجر عام'}
                      </div>
                    </td>

                    {/* المستلم والمنطقة */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{shipment.recipient_name}</div>
                      <div className="text-xs text-slate-400">
                        {shipment.zones ? `${shipment.zones.governorate} - ${shipment.zones.name}` : '-'}
                      </div>
                    </td>

                    {/* نوع الشحنة */}
                    <td className="py-3 px-4">
                      <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded whitespace-nowrap inline-flex items-center">
                        {SHIPMENT_TYPE_LABELS[shipment.shipment_type]}
                      </span>
                    </td>

                    {/* المبلغ COD */}
                    <td className="py-3 px-4 font-bold text-slate-900" dir="ltr">
                      {formatCurrency(Number(shipment.expected_cod) || 0)}
                    </td>

                    {/* الحالة */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full border ${getStatusBadgeClass(
                          shipment.status,
                        )}`}
                      >
                        {SHIPMENT_STATUS_LABELS[shipment.status]}
                      </span>
                    </td>

                    {/* المندوب */}
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {shipment.couriers?.name || (
                        <span className="text-slate-400">غير مسندة</span>
                      )}
                    </td>

                    {/* التاريخ */}
                    <td className="py-3 px-4 text-xs text-slate-400 whitespace-nowrap" dir="ltr">
                      {new Date(shipment.created_at).toLocaleDateString('ar-EG', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
