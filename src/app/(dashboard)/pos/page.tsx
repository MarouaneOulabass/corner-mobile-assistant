'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Product, CartItem, PaymentMethod, Customer } from '@/types';
import { formatPrice, conditionLabels } from '@/lib/utils';

const OFFLINE_QUEUE_KEY = 'corner_offline_sales';

export default function POSPage() {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>('flat');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [splitCash, setSplitCash] = useState(0);
  const [splitCard, setSplitCard] = useState(0);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [existingCustomer, setExistingCustomer] = useState<Customer | null>(null);
  const [showCustomer, setShowCustomer] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<Record<string, unknown> | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [loading, setLoading] = useState(false);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOffline(!navigator.onLine);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync offline queue when back online
  useEffect(() => {
    if (!isOffline) {
      syncOfflineQueue();
    }
  }, [isOffline]);

  const syncOfflineQueue = async () => {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    if (queue.length === 0) return;

    for (const sale of queue) {
      try {
        await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sale),
        });
      } catch {
        return; // still offline
      }
    }
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  };

  // Search products
  const searchProducts = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    const isIMEI = /^\d{10,15}$/.test(query);
    let queryBuilder = supabase
      .from('products')
      .select('*')
      .eq('status', 'in_stock')
      .limit(10);

    if (user?.role !== 'superadmin') {
      queryBuilder = queryBuilder.eq('store_id', user?.store_id);
    }

    if (isIMEI) {
      queryBuilder = queryBuilder.ilike('imei', `%${query}%`);
    } else {
      queryBuilder = queryBuilder.or(`model.ilike.%${query}%,brand.ilike.%${query}%`);
    }

    const { data } = await queryBuilder;
    setSearchResults(data || []);
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => searchProducts(search), 300);
    return () => clearTimeout(timer);
  }, [search, searchProducts]);

  // Customer search
  const searchCustomer = async (phone: string) => {
    setCustomerPhone(phone);
    if (phone.length >= 8) {
      const { data } = await supabase.from('customers').select('*').eq('phone', phone).single();
      setExistingCustomer(data || null);
    } else {
      setExistingCustomer(null);
    }
  };

  // Cart operations
  const addToCart = (product: Product) => {
    const exists = cart.find(item => item.product.id === product.id);
    if (exists) return;
    setCart([...cart, {
      product,
      quantity: 1,
      unit_price: product.selling_price,
      original_price: product.selling_price,
    }]);
    setSearch('');
    setSearchResults([]);
    setShowSearch(false);
  };

  const updatePrice = (index: number, price: number) => {
    const updated = [...cart];
    updated[index].unit_price = price;
    setCart(updated);
  };

  const updateQuantity = (index: number, qty: number) => {
    if (qty < 1) return;
    const updated = [...cart];
    updated[index].quantity = qty;
    setCart(updated);
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const discountAmount = discountType === 'percentage' ? (subtotal * discount) / 100 : discount;
  const total = Math.max(0, subtotal - discountAmount);
  const hasPriceBelowCost = cart.some(item => item.unit_price < item.product.purchase_price);

  // Confirm sale
  const confirmSale = async () => {
    if (cart.length === 0) return;
    setLoading(true);

    const saleData = {
      items: cart.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        original_price: item.original_price,
      })),
      customer_phone: customerPhone || undefined,
      customer_name: customerName || undefined,
      customer_id: existingCustomer?.id,
      discount_amount: discountAmount,
      discount_type: discount > 0 ? discountType : undefined,
      payment_method: paymentMethod,
      payment_details: paymentMethod === 'mixte' ? { cash: splitCash, card: splitCard } : undefined,
    };

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData),
      });

      if (res.ok) {
        const data = await res.json();
        setLastSale(data);
        setShowReceipt(true);
        resetPOS();
      } else {
        throw new Error('Sale failed');
      }
    } catch {
      // Save to offline queue
      const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
      queue.push(saleData);
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
      setIsOffline(true);
      setShowReceipt(true);
      setLastSale({ offline: true, total, items: cart });
      resetPOS();
    }

    setLoading(false);
  };

  const resetPOS = () => {
    setCart([]);
    setDiscount(0);
    setDiscountType('flat');
    setPaymentMethod('cash');
    setCustomerPhone('');
    setCustomerName('');
    setExistingCustomer(null);
    setShowCustomer(false);
  };

  // Receipt view
  if (showReceipt && lastSale) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white p-4">
        <div className="max-w-sm mx-auto pt-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto bg-[#5BBF3E] rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold">
              {(lastSale as Record<string, unknown>).offline ? 'Vente enregistrée (hors ligne)' : 'Vente confirmée !'}
            </h2>
            <p className="text-2xl font-bold text-[#5BBF3E] mt-2">{formatPrice(total)}</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => { setShowReceipt(false); setLastSale(null); }}
              className="w-full py-3 bg-[#2AA8DC] rounded-xl font-semibold text-center"
            >
              Nouvelle vente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-white">
      {/* Offline badge */}
      {isOffline && (
        <div className="bg-orange-500 text-center py-1 text-xs font-medium">
          Hors ligne — Les ventes seront synchronisées
        </div>
      )}

      {/* Price below cost warning */}
      {hasPriceBelowCost && (
        <div className="bg-yellow-500/20 text-yellow-300 text-center py-2 text-xs font-medium px-4">
          Attention : un ou plusieurs articles sont en dessous du prix d&apos;achat
        </div>
      )}

      {/* Search bar */}
      <div className="p-4 pb-2">
        <div className="relative">
          <input
            type="text"
            placeholder="Rechercher IMEI, modèle, marque..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowSearch(true); }}
            onFocus={() => setShowSearch(true)}
            className="w-full px-4 py-3 pl-10 rounded-xl bg-white/10 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-[#2AA8DC]"
          />
          <svg className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Search results dropdown */}
        {showSearch && searchResults.length > 0 && (
          <div className="mt-1 bg-[#1E293B] rounded-xl border border-white/10 max-h-60 overflow-y-auto">
            {searchResults.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="w-full text-left p-3 hover:bg-white/5 border-b border-white/5 last:border-0"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">{p.brand} {p.model}</p>
                    <p className="text-xs text-gray-400">
                      {p.storage && `${p.storage} — `}
                      {conditionLabels[p.condition]}
                      {p.imei && ` — ${p.imei}`}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-[#5BBF3E]">{formatPrice(p.selling_price)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cart */}
      <div className="flex-1 px-4 space-y-2 pb-4 max-h-[40vh] overflow-y-auto">
        {cart.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            <p className="text-sm">Scannez ou recherchez un article</p>
          </div>
        ) : (
          cart.map((item, i) => (
            <div key={item.product.id} className="bg-[#1E293B] rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {item.product.brand} {item.product.model}
                  </p>
                  <p className="text-xs text-gray-400">
                    {item.product.storage && `${item.product.storage} — `}
                    {conditionLabels[item.product.condition]}
                  </p>
                </div>
                <button onClick={() => removeFromCart(i)} className="text-gray-500 hover:text-red-400 p-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-3 mt-2">
                {item.product.product_type !== 'phone' && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQuantity(i, item.quantity - 1)} className="w-7 h-7 rounded bg-white/10 flex items-center justify-center text-sm">-</button>
                    <span className="w-8 text-center text-sm">{item.quantity}</span>
                    <button onClick={() => updateQuantity(i, item.quantity + 1)} className="w-7 h-7 rounded bg-white/10 flex items-center justify-center text-sm">+</button>
                  </div>
                )}
                <div className="flex-1 flex justify-end">
                  <input
                    type="number"
                    value={item.unit_price}
                    onChange={(e) => updatePrice(i, Number(e.target.value))}
                    className="w-28 px-3 py-1.5 rounded-lg bg-white/10 text-right text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-[#2AA8DC]"
                  />
                  <span className="text-xs text-gray-400 ml-1 self-center">MAD</span>
                </div>
              </div>
              {item.unit_price < item.product.purchase_price && (
                <p className="text-xs text-yellow-400 mt-1">En dessous du prix d&apos;achat</p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Bottom section */}
      <div className="sticky bottom-16 bg-[#0F172A] border-t border-white/10 p-4 space-y-3">
        {/* Discount */}
        {cart.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as 'flat' | 'percentage')}
              className="px-3 py-2 rounded-lg bg-white/10 text-sm text-white"
            >
              <option value="flat">MAD</option>
              <option value="percentage">%</option>
            </select>
            <input
              type="number"
              placeholder="Remise"
              value={discount || ''}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="flex-1 px-3 py-2 rounded-lg bg-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-[#2AA8DC]"
            />
          </div>
        )}

        {/* Customer */}
        {cart.length > 0 && (
          <div>
            <button
              onClick={() => setShowCustomer(!showCustomer)}
              className="text-sm text-[#2AA8DC] mb-2"
            >
              {showCustomer ? '▾ Client' : '▸ Ajouter un client (optionnel)'}
            </button>
            {showCustomer && (
              <div className="space-y-2">
                <input
                  type="tel"
                  placeholder="Téléphone du client"
                  value={customerPhone}
                  onChange={(e) => searchCustomer(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-[#2AA8DC]"
                />
                {existingCustomer ? (
                  <p className="text-xs text-[#5BBF3E]">Client trouvé : {existingCustomer.name}</p>
                ) : customerPhone.length >= 8 ? (
                  <input
                    type="text"
                    placeholder="Nom du nouveau client"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-[#2AA8DC]"
                  />
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* Payment method */}
        {cart.length > 0 && (
          <div className="flex gap-2">
            {(['cash', 'card', 'virement', 'mixte'] as PaymentMethod[]).map((method) => (
              <button
                key={method}
                onClick={() => setPaymentMethod(method)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
                  paymentMethod === method
                    ? 'bg-[#2AA8DC] text-white'
                    : 'bg-white/10 text-gray-300'
                }`}
              >
                {method === 'cash' ? 'Espèces' : method === 'card' ? 'Carte' : method === 'virement' ? 'Virement' : 'Mixte'}
              </button>
            ))}
          </div>
        )}

        {paymentMethod === 'mixte' && cart.length > 0 && (
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Espèces"
              value={splitCash || ''}
              onChange={(e) => setSplitCash(Number(e.target.value))}
              className="flex-1 px-3 py-2 rounded-lg bg-white/10 text-sm"
            />
            <input
              type="number"
              placeholder="Carte"
              value={splitCard || ''}
              onChange={(e) => setSplitCard(Number(e.target.value))}
              className="flex-1 px-3 py-2 rounded-lg bg-white/10 text-sm"
            />
          </div>
        )}

        {/* Total and confirm */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <p className="text-xs text-gray-400">Total</p>
            <p className="text-2xl font-bold text-[#5BBF3E]">{formatPrice(total)}</p>
            {discountAmount > 0 && (
              <p className="text-xs text-gray-400">Remise: -{formatPrice(discountAmount)}</p>
            )}
          </div>
          <button
            onClick={confirmSale}
            disabled={cart.length === 0 || loading}
            className="px-6 py-3 bg-[#5BBF3E] hover:bg-[#5BBF3E]/90 rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'En cours...' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}
