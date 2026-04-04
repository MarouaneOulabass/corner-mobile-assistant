'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Product, ProductStatus, ProductCondition, ProductType } from '@/types';
import {
  formatPrice,
  conditionLabels,
  statusLabels,
  statusColors,
} from '@/lib/utils';

const BRANDS = ['Samsung', 'Apple', 'Xiaomi', 'Huawei', 'Oppo', 'Realme', 'Tecno', 'Infinix', 'Nokia', 'Autre'];
const PAGE_SIZE = 20;

export default function StockPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // View
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Detail sheet
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const observerRef = useRef<HTMLDivElement | null>(null);

  const fetchProducts = useCallback(
    async (pageNum: number, append = false) => {
      if (!user) return;
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams();
        params.set('page', String(pageNum));
        params.set('limit', String(PAGE_SIZE));
        if (search) params.set('search', search);
        if (statusFilter) params.set('status', statusFilter);
        if (brandFilter) params.set('brand', brandFilter);
        if (conditionFilter) params.set('condition', conditionFilter);
        if (typeFilter) params.set('product_type', typeFilter);
        if (user.role !== 'superadmin') params.set('store_id', user.store_id);

        const res = await fetch(`/api/products?${params.toString()}`, {
          headers: {
            'x-user-store': user.store_id,
            'x-user-role': user.role,
          },
        });
        const data = await res.json();

        if (append) {
          setProducts((prev) => [...prev, ...(data.products || [])]);
        } else {
          setProducts(data.products || []);
        }
        setTotal(data.total || 0);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user, search, statusFilter, brandFilter, conditionFilter, typeFilter]
  );

  // Reset and fetch on filter change
  useEffect(() => {
    setPage(1);
    fetchProducts(1);
  }, [fetchProducts]);

  // Infinite scroll observer
  useEffect(() => {
    const el = observerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && products.length < total) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchProducts(nextPage, true);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [products.length, total, page, loadingMore, fetchProducts]);

  const activeFilterCount = [statusFilter, brandFilter, conditionFilter, typeFilter].filter(Boolean).length;

  return (
    <div className="px-4 pt-4">
      {/* Search bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="IMEI, modèle, marque..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30 focus:border-[#2AA8DC]"
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`relative p-2.5 rounded-xl border ${
            showFilters || activeFilterCount > 0
              ? 'bg-[#2AA8DC] text-white border-[#2AA8DC]'
              : 'bg-white text-gray-500 border-gray-200'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* View toggle */}
        <button
          onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
          className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-500"
        >
          {viewMode === 'list' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-3 mb-3 grid grid-cols-2 gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">Tous les statuts</option>
            {(['in_stock', 'sold', 'in_repair', 'transferred', 'returned'] as ProductStatus[]).map((s) => (
              <option key={s} value={s}>{statusLabels[s]}</option>
            ))}
          </select>

          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">Toutes les marques</option>
            {BRANDS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">Tous les états</option>
            {(['new', 'like_new', 'good', 'fair', 'poor'] as ProductCondition[]).map((c) => (
              <option key={c} value={c}>{conditionLabels[c]}</option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">Tous les types</option>
            {(['phone', 'accessory', 'part'] as ProductType[]).map((t) => (
              <option key={t} value={t}>
                {t === 'phone' ? 'Téléphone' : t === 'accessory' ? 'Accessoire' : 'Pièce'}
              </option>
            ))}
          </select>

          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                setStatusFilter('');
                setBrandFilter('');
                setConditionFilter('');
                setTypeFilter('');
              }}
              className="col-span-2 text-xs text-[#2AA8DC] py-1"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      )}

      {/* Count */}
      <p className="text-xs text-gray-400 mb-2">
        {total} produit{total !== 1 ? 's' : ''}
      </p>

      {/* Loading state */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-3 border-[#2AA8DC] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-sm">Aucun produit trouvé</p>
        </div>
      ) : viewMode === 'list' ? (
        /* List view */
        <div className="space-y-2">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProduct(p)}
              className="w-full bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3 text-left active:bg-gray-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[p.status]}`} />
                  <p className="font-medium text-sm text-gray-900 truncate">
                    {p.brand} {p.model}
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {p.storage && (
                    <span className="text-xs text-gray-400">{p.storage}</span>
                  )}
                  <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                    {conditionLabels[p.condition]}
                  </span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-gray-900">{formatPrice(p.selling_price)}</p>
                <p className="text-[10px] text-gray-400">{statusLabels[p.status]}</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        /* Grid view */
        <div className="grid grid-cols-2 gap-2">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProduct(p)}
              className="bg-white rounded-xl border border-gray-100 p-3 text-left active:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[p.status]}`} />
                <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                  {conditionLabels[p.condition]}
                </span>
              </div>
              <p className="font-medium text-sm text-gray-900 truncate">{p.brand} {p.model}</p>
              {p.storage && <p className="text-xs text-gray-400 mt-0.5">{p.storage}</p>}
              <p className="text-sm font-semibold text-gray-900 mt-2">{formatPrice(p.selling_price)}</p>
            </button>
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={observerRef} className="h-4" />
      {loadingMore && (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 border-2 border-[#2AA8DC] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => router.push('/stock/add')}
        className="fixed bottom-24 right-4 w-14 h-14 bg-[#2AA8DC] text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform z-30"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Detail sheet */}
      {selectedProduct && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setSelectedProduct(null)}
          />
          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 max-h-[80vh] overflow-y-auto animate-slide-up">
            <div className="sticky top-0 bg-white pt-3 pb-2 px-4 border-b border-gray-100">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">
                  {selectedProduct.brand} {selectedProduct.model}
                </h2>
                <button onClick={() => setSelectedProduct(null)} className="p-1 text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              {/* Status & condition */}
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs text-white ${statusColors[selectedProduct.status]}`}>
                  {statusLabels[selectedProduct.status]}
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                  {conditionLabels[selectedProduct.condition]}
                </span>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3">
                {selectedProduct.imei && (
                  <DetailItem label="IMEI" value={selectedProduct.imei} />
                )}
                <DetailItem
                  label="Type"
                  value={selectedProduct.product_type === 'phone' ? 'Téléphone' : selectedProduct.product_type === 'accessory' ? 'Accessoire' : 'Pièce'}
                />
                {selectedProduct.storage && (
                  <DetailItem label="Stockage" value={selectedProduct.storage} />
                )}
                {selectedProduct.color && (
                  <DetailItem label="Couleur" value={selectedProduct.color} />
                )}
                <DetailItem label="Prix d'achat" value={formatPrice(selectedProduct.purchase_price)} />
                <DetailItem label="Prix de vente" value={formatPrice(selectedProduct.selling_price)} />
                {selectedProduct.supplier && (
                  <DetailItem label="Fournisseur" value={selectedProduct.supplier} />
                )}
                {selectedProduct.store?.name && (
                  <DetailItem label="Magasin" value={selectedProduct.store.name} />
                )}
              </div>

              {selectedProduct.notes && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{selectedProduct.notes}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Slide-up animation */}
      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value}</p>
    </div>
  );
}
