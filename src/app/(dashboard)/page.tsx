'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice } from '@/lib/utils';
import { repairStatusLabels, repairStatusColors } from '@/lib/utils';

interface DashboardData {
  salesToday: number;
  transactionCount: number;
  marginToday: number;
  marginPercent: number;
  inStockCount: number;
  soldThisWeek: number;
  repairsByStatus: Record<string, number>;
  topSeller: { name: string; total: number } | null;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData>({
    salesToday: 0,
    transactionCount: 0,
    marginToday: 0,
    marginPercent: 0,
    inStockCount: 0,
    soldThisWeek: 0,
    repairsByStatus: {},
    topSeller: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function fetchDashboard() {
    setLoading(true);
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const startOfWeek = weekAgo.toISOString();

    const storeId = user!.store_id;

    // Fetch today's sales
    let salesQuery = supabase
      .from('sales')
      .select('id, total, discount_amount, seller_id, seller:users(name), items:sale_items(unit_price, quantity, product:products(purchase_price))')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    if (user!.role !== 'superadmin') {
      salesQuery = salesQuery.eq('store_id', storeId);
    }

    const { data: sales } = await salesQuery;

    let salesToday = 0;
    let marginToday = 0;
    const sellerTotals: Record<string, { name: string; total: number }> = {};

    if (sales) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const sale of sales as any[]) {
        salesToday += sale.total;

        // Calculate margin from items
        if (sale.items) {
          for (const item of sale.items) {
            const revenue = item.unit_price * item.quantity;
            const cost = item.product?.purchase_price ? item.product.purchase_price * item.quantity : 0;
            marginToday += revenue - cost;
          }
        }

        // Track seller totals
        const sellerName = sale.seller?.name || 'Inconnu';
        if (!sellerTotals[sale.seller_id]) {
          sellerTotals[sale.seller_id] = { name: sellerName, total: 0 };
        }
        sellerTotals[sale.seller_id].total += sale.total;
      }
    }

    const transactionCount = sales?.length || 0;
    const marginPercent = salesToday > 0 ? (marginToday / salesToday) * 100 : 0;

    // Top seller
    let topSeller: { name: string; total: number } | null = null;
    const sellerEntries = Object.values(sellerTotals);
    if (sellerEntries.length > 0) {
      topSeller = sellerEntries.reduce((best, s) => (s.total > best.total ? s : best));
    }

    // Stock count
    let stockQuery = supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'in_stock');

    if (user!.role !== 'superadmin') {
      stockQuery = stockQuery.eq('store_id', storeId);
    }

    const { count: inStockCount } = await stockQuery;

    // Sold this week
    let soldQuery = supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sold')
      .gte('updated_at', startOfWeek);

    if (user!.role !== 'superadmin') {
      soldQuery = soldQuery.eq('store_id', storeId);
    }

    const { count: soldThisWeek } = await soldQuery;

    // Open repairs by status
    let repairsQuery = supabase
      .from('repairs')
      .select('status')
      .not('status', 'in', '("delivered","cancelled")');

    if (user!.role !== 'superadmin') {
      repairsQuery = repairsQuery.eq('store_id', storeId);
    }

    const { data: repairs } = await repairsQuery;
    const repairsByStatus: Record<string, number> = {};
    if (repairs) {
      for (const r of repairs) {
        repairsByStatus[r.status] = (repairsByStatus[r.status] || 0) + 1;
      }
    }

    setData({
      salesToday,
      transactionCount,
      marginToday,
      marginPercent,
      inStockCount: inStockCount || 0,
      soldThisWeek: soldThisWeek || 0,
      repairsByStatus,
      topSeller,
    });
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-5 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
            <div className="h-8 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  const greeting = getGreeting();
  const totalOpenRepairs = Object.values(data.repairsByStatus).reduce((a, b) => a + b, 0);

  return (
    <div className="p-4 space-y-4">
      {/* Welcome */}
      <div className="mb-2">
        <h1 className="text-xl font-bold text-gray-900">
          {greeting}, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-sm text-gray-500">
          {new Date().toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Sales Today */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-500">Ventes aujourd&apos;hui</span>
          <span className="text-xs bg-[#2AA8DC]/10 text-[#2AA8DC] px-2 py-0.5 rounded-full font-medium">
            {data.transactionCount} transaction{data.transactionCount !== 1 ? 's' : ''}
          </span>
        </div>
        <p className="text-2xl font-bold text-gray-900">{formatPrice(data.salesToday)}</p>
      </div>

      {/* Margin */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <span className="text-sm font-medium text-gray-500">Marge du jour</span>
        <div className="flex items-end gap-3 mt-1">
          <p className="text-2xl font-bold text-[#5BBF3E]">{formatPrice(data.marginToday)}</p>
          <span className="text-sm font-medium text-[#5BBF3E] mb-1">
            {data.marginPercent.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Stock Summary */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <span className="text-sm font-medium text-gray-500 mb-3 block">Stock</span>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-bold text-gray-900">{data.inStockCount}</p>
            <p className="text-xs text-gray-500">En stock</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{data.soldThisWeek}</p>
            <p className="text-xs text-gray-500">Vendus cette semaine</p>
          </div>
        </div>
      </div>

      {/* Open Repairs */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-500">Réparations en cours</span>
          <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-medium">
            {totalOpenRepairs}
          </span>
        </div>
        {totalOpenRepairs === 0 ? (
          <p className="text-sm text-gray-400">Aucune réparation en cours</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.repairsByStatus).map(([status, count]) => (
              <div
                key={status}
                className="flex items-center gap-1.5 text-xs bg-gray-50 rounded-full px-3 py-1.5"
              >
                <span className={`w-2 h-2 rounded-full ${repairStatusColors[status] || 'bg-gray-400'}`} />
                <span className="text-gray-700">{repairStatusLabels[status] || status}</span>
                <span className="font-semibold text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Seller */}
      {data.topSeller && (
        <div className="bg-gradient-to-r from-[#2AA8DC] to-[#2AA8DC]/80 rounded-xl p-5 shadow-sm">
          <span className="text-sm font-medium text-white/80">Meilleur vendeur du jour</span>
          <div className="flex items-center justify-between mt-2">
            <p className="text-lg font-bold text-white">{data.topSeller.name}</p>
            <p className="text-lg font-bold text-white">{formatPrice(data.topSeller.total)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bonjour';
  if (hour < 18) return 'Bon après-midi';
  return 'Bonsoir';
}
