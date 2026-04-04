'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Customer } from '@/types';
import { formatDate, formatPrice } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export default function CustomersPage() {
  useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSales, setCustomerSales] = useState<Record<string, unknown>[]>([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('customers').select('*').order('created_at', { ascending: false }).limit(50);
    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }
    const { data } = await query;
    setCustomers(data || []);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const openCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setAiSummary(null);
    const { data } = await supabase
      .from('sales')
      .select('*, items:sale_items(*, product:products(brand, model))')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });
    setCustomerSales(data || []);
  };

  const generateAiSummary = async () => {
    if (!selectedCustomer) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'customer_summary',
          data: {
            customerName: selectedCustomer.name,
            purchases: customerSales.map((s: Record<string, unknown>) => ({
              model: 'Achat',
              price: s.total,
              date: s.created_at,
            })),
          },
        }),
      });
      const data = await res.json();
      setAiSummary(data.data || 'Analyse indisponible');
    } catch {
      setAiSummary('Analyse indisponible');
    }
    setAiLoading(false);
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Clients</h1>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Rechercher par nom ou téléphone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-sm focus:outline-none focus:border-[#2AA8DC] mb-4"
      />

      {/* Customer List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#2AA8DC] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : customers.length === 0 ? (
        <p className="text-center text-gray-400 py-12">Aucun client trouvé</p>
      ) : (
        <div className="space-y-2">
          {customers.map((c) => (
            <button
              key={c.id}
              onClick={() => openCustomer(c)}
              className="w-full text-left p-4 bg-white rounded-xl border border-gray-100 hover:border-[#2AA8DC]/30 transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{c.name}</p>
                  <p className="text-sm text-gray-500">{c.phone}</p>
                </div>
                <p className="text-xs text-gray-400">{formatDate(c.created_at)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Customer Detail Sheet */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setSelectedCustomer(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-4 py-3 border-b border-gray-100 flex items-center justify-between rounded-t-2xl">
              <h2 className="font-semibold text-gray-900">{selectedCustomer.name}</h2>
              <button onClick={() => setSelectedCustomer(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Info */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Téléphone</span>
                  <span className="text-gray-900">{selectedCustomer.phone}</span>
                </div>
                {selectedCustomer.email && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Email</span>
                    <span className="text-gray-900">{selectedCustomer.email}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Client depuis</span>
                  <span className="text-gray-900">{formatDate(selectedCustomer.created_at)}</span>
                </div>
              </div>

              {/* AI Summary */}
              <div>
                <button
                  onClick={generateAiSummary}
                  disabled={aiLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#2AA8DC]/10 text-[#2AA8DC] text-sm font-medium hover:bg-[#2AA8DC]/20 transition disabled:opacity-50"
                >
                  {aiLoading ? 'IA en cours...' : 'Analyser avec l\'IA'}
                </button>
                {aiSummary && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-xl text-sm text-gray-700 leading-relaxed">
                    {aiSummary}
                  </div>
                )}
              </div>

              {/* Purchase History */}
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Historique d&apos;achats</h3>
                {customerSales.length === 0 ? (
                  <p className="text-sm text-gray-400">Aucun achat</p>
                ) : (
                  <div className="space-y-2">
                    {customerSales.map((sale: Record<string, unknown>) => (
                      <div key={sale.id as string} className="p-3 bg-gray-50 rounded-lg text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">{formatDate(sale.created_at as string)}</span>
                          <span className="font-medium text-gray-900">{formatPrice(sale.total as number)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
