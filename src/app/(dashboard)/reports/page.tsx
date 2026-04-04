'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice, formatDate } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface SalesReport {
  revenue: number;
  margin: number;
  avgBasket: number;
  transactionCount: number;
}

interface BestSeller {
  model: string;
  brand: string;
  count: number;
  revenue: number;
}

interface PaymentBreakdown {
  method: string;
  total: number;
  count: number;
}

interface SellerPerformance {
  name: string;
  salesCount: number;
  revenue: number;
  margin: number;
  avgDiscount: number;
}

interface TrendPoint {
  date: string;
  revenue: number;
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [storeFilter, setStoreFilter] = useState<string>('');
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [report, setReport] = useState<SalesReport>({ revenue: 0, margin: 0, avgBasket: 0, transactionCount: 0 });
  const [bestSellers, setBestSellers] = useState<BestSeller[]>([]);
  const [payments, setPayments] = useState<PaymentBreakdown[]>([]);
  const [sellers, setSellers] = useState<SellerPerformance[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInsight, setAiInsight] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'superadmin') {
      supabase.from('stores').select('id, name').then(({ data }) => {
        if (data) setStores(data);
      });
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, startDate, endDate, storeFilter]);

  async function fetchReport() {
    setLoading(true);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const activeStoreId = storeFilter || (user!.role !== 'superadmin' ? user!.store_id : '');

    // Fetch sales with items and seller
    let salesQuery = supabase
      .from('sales')
      .select('id, total, discount_amount, payment_method, seller_id, created_at, seller:users(name), items:sale_items(unit_price, quantity, original_price, product:products(purchase_price, brand, model))')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    if (activeStoreId) {
      salesQuery = salesQuery.eq('store_id', activeStoreId);
    }

    const { data: sales } = await salesQuery;

    if (!sales || sales.length === 0) {
      setReport({ revenue: 0, margin: 0, avgBasket: 0, transactionCount: 0 });
      setBestSellers([]);
      setPayments([]);
      setSellers([]);
      setTrend([]);
      setLoading(false);
      return;
    }

    let revenue = 0;
    let margin = 0;
    const modelCounts: Record<string, { brand: string; count: number; revenue: number }> = {};
    const paymentTotals: Record<string, { total: number; count: number }> = {};
    const sellerMap: Record<string, { name: string; salesCount: number; revenue: number; margin: number; totalDiscount: number }> = {};
    const dailyRevenue: Record<string, number> = {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const sale of sales as any[]) {
      revenue += sale.total;

      // Payment method
      const pm = sale.payment_method || 'cash';
      if (!paymentTotals[pm]) paymentTotals[pm] = { total: 0, count: 0 };
      paymentTotals[pm].total += sale.total;
      paymentTotals[pm].count += 1;

      // Daily trend
      const dayKey = sale.created_at.slice(0, 10);
      dailyRevenue[dayKey] = (dailyRevenue[dayKey] || 0) + sale.total;

      // Seller
      const sellerId = sale.seller_id;
      const sellerName = sale.seller?.name || 'Inconnu';
      if (!sellerMap[sellerId]) {
        sellerMap[sellerId] = { name: sellerName, salesCount: 0, revenue: 0, margin: 0, totalDiscount: 0 };
      }
      sellerMap[sellerId].salesCount += 1;
      sellerMap[sellerId].revenue += sale.total;
      sellerMap[sellerId].totalDiscount += sale.discount_amount || 0;

      // Items
      if (sale.items) {
        for (const item of sale.items) {
          const itemRevenue = item.unit_price * item.quantity;
          const cost = item.product?.purchase_price ? item.product.purchase_price * item.quantity : 0;
          const itemMargin = itemRevenue - cost;
          margin += itemMargin;

          sellerMap[sellerId].margin += itemMargin;

          const modelKey = `${item.product?.brand || ''} ${item.product?.model || ''}`.trim() || 'Inconnu';
          if (!modelCounts[modelKey]) {
            modelCounts[modelKey] = { brand: item.product?.brand || '', count: 0, revenue: 0 };
          }
          modelCounts[modelKey].count += item.quantity;
          modelCounts[modelKey].revenue += itemRevenue;
        }
      }
    }

    const transactionCount = sales.length;
    const avgBasket = transactionCount > 0 ? revenue / transactionCount : 0;

    setReport({ revenue, margin, avgBasket, transactionCount });

    // Best sellers - top 10
    const bestSellersArr = Object.entries(modelCounts)
      .map(([model, d]) => ({ model, brand: d.brand, count: d.count, revenue: d.revenue }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    setBestSellers(bestSellersArr);

    // Payment breakdown
    const paymentMethodLabels: Record<string, string> = {
      cash: 'Espèces',
      card: 'Carte',
      virement: 'Virement',
      mixte: 'Mixte',
    };
    const paymentArr = Object.entries(paymentTotals)
      .map(([method, d]) => ({ method: paymentMethodLabels[method] || method, total: d.total, count: d.count }))
      .sort((a, b) => b.total - a.total);
    setPayments(paymentArr);

    // Seller performance
    const sellersArr = Object.values(sellerMap)
      .map((s) => ({
        name: s.name,
        salesCount: s.salesCount,
        revenue: s.revenue,
        margin: s.margin,
        avgDiscount: s.salesCount > 0 ? s.totalDiscount / s.salesCount : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
    setSellers(sellersArr);

    // Trend
    const trendArr = Object.entries(dailyRevenue)
      .map(([date, rev]) => ({ date: formatDate(date), revenue: rev }))
      .sort((a, b) => a.date.localeCompare(b.date));
    setTrend(trendArr);

    setLoading(false);
  }

  async function analyzeWithAI() {
    setAiLoading(true);
    setAiInsight('');
    try {
      const salesData = {
        period: { start: startDate, end: endDate },
        ...report,
        bestSellers: bestSellers.slice(0, 5),
        payments,
        sellers,
      };
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'sales_insight', data: salesData }),
      });
      const result = await res.json();
      if (result.data) {
        setAiInsight(result.data);
      } else {
        setAiInsight(result.error || 'Analyse indisponible');
      }
    } catch {
      setAiInsight('Erreur lors de l\'analyse');
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Rapports</h1>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Date début</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30 focus:border-[#2AA8DC]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Date fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30 focus:border-[#2AA8DC]"
            />
          </div>
        </div>
        {user?.role === 'superadmin' && stores.length > 0 && (
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Magasin</label>
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30 focus:border-[#2AA8DC]"
            >
              <option value="">Tous les magasins</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <span className="text-xs font-medium text-gray-500">Chiffre d&apos;affaires</span>
              <p className="text-lg font-bold text-gray-900 mt-1">{formatPrice(report.revenue)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <span className="text-xs font-medium text-gray-500">Marge</span>
              <p className="text-lg font-bold text-[#5BBF3E] mt-1">{formatPrice(report.margin)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <span className="text-xs font-medium text-gray-500">Panier moyen</span>
              <p className="text-lg font-bold text-gray-900 mt-1">{formatPrice(report.avgBasket)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <span className="text-xs font-medium text-gray-500">Transactions</span>
              <p className="text-lg font-bold text-gray-900 mt-1">{report.transactionCount}</p>
            </div>
          </div>

          {/* Revenue Trend Chart */}
          {trend.length > 1 && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Tendance du chiffre d&apos;affaires</h2>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                      width={40}
                    />
                    <Tooltip
                      formatter={(value) => [formatPrice(Number(value)), 'CA']}
                      labelStyle={{ fontSize: 12 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#2AA8DC"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Best Selling Models */}
          {bestSellers.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700">Modèles les plus vendus</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500">
                      <th className="text-left px-4 py-2 font-medium">Modèle</th>
                      <th className="text-right px-4 py-2 font-medium">Qté</th>
                      <th className="text-right px-4 py-2 font-medium">CA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bestSellers.map((item, idx) => (
                      <tr key={idx} className="border-t border-gray-50">
                        <td className="px-4 py-2.5 text-gray-900">{item.model}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{item.count}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700 whitespace-nowrap">{formatPrice(item.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Payment Methods */}
          {payments.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Répartition par mode de paiement</h2>
              <div className="space-y-2">
                {payments.map((p) => {
                  const pct = report.revenue > 0 ? (p.total / report.revenue) * 100 : 0;
                  return (
                    <div key={p.method}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700">{p.method} <span className="text-gray-400">({p.count})</span></span>
                        <span className="font-medium text-gray-900">{formatPrice(p.total)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#2AA8DC] rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Seller Performance */}
          {sellers.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700">Performance vendeurs</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500">
                      <th className="text-left px-4 py-2 font-medium">Vendeur</th>
                      <th className="text-right px-4 py-2 font-medium">Ventes</th>
                      <th className="text-right px-4 py-2 font-medium">CA</th>
                      <th className="text-right px-4 py-2 font-medium">Marge</th>
                      <th className="text-right px-4 py-2 font-medium">Remise moy.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sellers.map((s, idx) => (
                      <tr key={idx} className="border-t border-gray-50">
                        <td className="px-4 py-2.5 text-gray-900 whitespace-nowrap">{s.name}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{s.salesCount}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700 whitespace-nowrap">{formatPrice(s.revenue)}</td>
                        <td className="px-4 py-2.5 text-right text-[#5BBF3E] whitespace-nowrap">{formatPrice(s.margin)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700 whitespace-nowrap">{formatPrice(s.avgDiscount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AI Analysis */}
          <div className="space-y-3">
            <button
              onClick={analyzeWithAI}
              disabled={aiLoading || report.transactionCount === 0}
              className="w-full bg-[#2AA8DC] text-white font-medium py-3 rounded-xl disabled:opacity-50 active:bg-[#2AA8DC]/90 transition-colors flex items-center justify-center gap-2"
            >
              {aiLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analyse en cours...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Analyser avec l&apos;IA
                </>
              )}
            </button>

            {aiInsight && (
              <div className="bg-[#2AA8DC]/5 border border-[#2AA8DC]/20 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-[#2AA8DC] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{aiInsight}</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
