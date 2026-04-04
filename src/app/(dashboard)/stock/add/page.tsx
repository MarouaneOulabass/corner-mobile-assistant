'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ProductType, ProductCondition } from '@/types';
import { validateIMEI, conditionLabels, formatPrice } from '@/lib/utils';

const BRANDS = ['Samsung', 'Apple', 'Xiaomi', 'Huawei', 'Oppo', 'Realme', 'Tecno', 'Infinix', 'Nokia', 'Autre'];
const STORAGES = ['16 Go', '32 Go', '64 Go', '128 Go', '256 Go', '512 Go', '1 To'];

export default function AddProductPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    product_type: 'phone' as ProductType,
    brand: '',
    model: '',
    storage: '',
    color: '',
    condition: 'good' as ProductCondition,
    purchase_price: '',
    selling_price: '',
    imei: '',
    supplier: '',
    notes: '',
    purchase_date: new Date().toISOString().split('T')[0],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [imeiChecking, setImeiChecking] = useState(false);
  const [imeiDuplicate, setImeiDuplicate] = useState(false);
  const [priceSuggestion, setPriceSuggestion] = useState<number | null>(null);
  const [suggestingPrice, setSuggestingPrice] = useState(false);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
    if (field === 'imei') {
      setImeiDuplicate(false);
      setPriceSuggestion(null);
    }
  };

  // IMEI validation on blur
  const handleImeiBlur = async () => {
    const imei = form.imei.trim();
    if (!imei) return;

    // Luhn check
    if (!validateIMEI(imei)) {
      setErrors((prev) => ({ ...prev, imei: 'IMEI invalide (vérification Luhn échouée)' }));
      return;
    }

    // Duplicate check
    setImeiChecking(true);
    try {
      const res = await fetch(`/api/products?search=${imei}`, {
        headers: {
          'x-user-store': user?.store_id || '',
          'x-user-role': 'superadmin', // check across all stores
        },
      });
      const data = await res.json();
      const duplicate = (data.products || []).some(
        (p: { imei?: string }) => p.imei === imei
      );
      if (duplicate) {
        setImeiDuplicate(true);
        setErrors((prev) => ({ ...prev, imei: 'Un produit avec cet IMEI existe déjà' }));
      }
    } catch {
      // ignore
    } finally {
      setImeiChecking(false);
    }
  };

  // Price suggestion via AI
  const handlePriceSuggestion = async () => {
    if (!form.brand || !form.model) return;
    setSuggestingPrice(true);
    setPriceSuggestion(null);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'price_suggestion',
          data: {
            brand: form.brand,
            model: form.model,
            storage: form.storage,
            condition: form.condition,
          },
        }),
      });
      const data = await res.json();
      if (data.price) {
        setPriceSuggestion(data.price);
      }
    } catch {
      // ignore
    } finally {
      setSuggestingPrice(false);
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.brand) errs.brand = 'Marque requise';
    if (!form.model) errs.model = 'Modèle requis';
    if (!form.purchase_price || Number(form.purchase_price) <= 0) errs.purchase_price = 'Prix d\'achat requis';
    if (!form.selling_price || Number(form.selling_price) <= 0) errs.selling_price = 'Prix de vente requis';
    if (form.product_type === 'phone' && form.imei && !validateIMEI(form.imei)) {
      errs.imei = 'IMEI invalide';
    }
    if (imeiDuplicate) errs.imei = 'IMEI déjà utilisé';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !user) return;
    setSubmitting(true);
    try {
      const body = {
        ...form,
        purchase_price: Number(form.purchase_price),
        selling_price: Number(form.selling_price),
        store_id: user.store_id,
        imei: form.imei || undefined,
        storage: form.storage || undefined,
        color: form.color || undefined,
        supplier: form.supplier || undefined,
        notes: form.notes || undefined,
        purchase_date: form.purchase_date || undefined,
      };

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
          'x-user-store': user.store_id,
          'x-user-role': user.role,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        router.push('/stock');
      } else {
        const data = await res.json();
        setErrors({ _form: data.error || 'Erreur lors de la création' });
      }
    } catch {
      setErrors({ _form: 'Erreur de connexion' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 pt-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-1 text-gray-500">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">Ajouter un produit</h1>
      </div>

      {errors._form && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {errors._form}
        </div>
      )}

      <div className="space-y-4">
        {/* Product type */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Type de produit</label>
          <div className="flex gap-2">
            {([
              { value: 'phone', label: 'Téléphone' },
              { value: 'accessory', label: 'Accessoire' },
              { value: 'part', label: 'Pièce' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateField('product_type', opt.value)}
                className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium border transition-colors ${
                  form.product_type === opt.value
                    ? 'bg-[#2AA8DC] text-white border-[#2AA8DC]'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* IMEI */}
        {form.product_type === 'phone' && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">IMEI</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                maxLength={15}
                placeholder="Entrer ou scanner l'IMEI"
                value={form.imei}
                onChange={(e) => updateField('imei', e.target.value.replace(/\D/g, ''))}
                onBlur={handleImeiBlur}
                className={`w-full px-3 py-2.5 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30 ${
                  errors.imei ? 'border-red-400' : 'border-gray-200'
                }`}
              />
              {imeiChecking && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-[#2AA8DC] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            {errors.imei && <p className="text-xs text-red-500 mt-1">{errors.imei}</p>}
          </div>
        )}

        {/* Brand */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Marque *</label>
          <select
            value={form.brand}
            onChange={(e) => updateField('brand', e.target.value)}
            className={`w-full px-3 py-2.5 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30 ${
              errors.brand ? 'border-red-400' : 'border-gray-200'
            }`}
          >
            <option value="">Sélectionner une marque</option>
            {BRANDS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          {errors.brand && <p className="text-xs text-red-500 mt-1">{errors.brand}</p>}
        </div>

        {/* Model */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Modèle *</label>
          <input
            type="text"
            placeholder="Ex: Galaxy A54, iPhone 15..."
            value={form.model}
            onChange={(e) => updateField('model', e.target.value)}
            className={`w-full px-3 py-2.5 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30 ${
              errors.model ? 'border-red-400' : 'border-gray-200'
            }`}
          />
          {errors.model && <p className="text-xs text-red-500 mt-1">{errors.model}</p>}
        </div>

        {/* Storage */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Stockage</label>
          <select
            value={form.storage}
            onChange={(e) => updateField('storage', e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30"
          >
            <option value="">Non spécifié</option>
            {STORAGES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Color */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Couleur</label>
          <input
            type="text"
            placeholder="Ex: Noir, Bleu..."
            value={form.color}
            onChange={(e) => updateField('color', e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30"
          />
        </div>

        {/* Condition */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">État *</label>
          <div className="flex flex-wrap gap-2">
            {(['new', 'like_new', 'good', 'fair', 'poor'] as ProductCondition[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => updateField('condition', c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  form.condition === c
                    ? 'bg-[#2AA8DC] text-white border-[#2AA8DC]'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {conditionLabels[c]}
              </button>
            ))}
          </div>
        </div>

        {/* Purchase price */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Prix d&apos;achat (MAD) *</label>
          <input
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={form.purchase_price}
            onChange={(e) => updateField('purchase_price', e.target.value)}
            className={`w-full px-3 py-2.5 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30 ${
              errors.purchase_price ? 'border-red-400' : 'border-gray-200'
            }`}
          />
          {errors.purchase_price && <p className="text-xs text-red-500 mt-1">{errors.purchase_price}</p>}
        </div>

        {/* Selling price */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Prix de vente (MAD) *</label>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={form.selling_price}
              onChange={(e) => updateField('selling_price', e.target.value)}
              className={`flex-1 px-3 py-2.5 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30 ${
                errors.selling_price ? 'border-red-400' : 'border-gray-200'
              }`}
            />
            <button
              type="button"
              onClick={handlePriceSuggestion}
              disabled={suggestingPrice || !form.brand || !form.model}
              className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-medium text-amber-700 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
            >
              {suggestingPrice ? (
                <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
              Suggestion IA
            </button>
          </div>
          {errors.selling_price && <p className="text-xs text-red-500 mt-1">{errors.selling_price}</p>}
          {priceSuggestion && (
            <button
              type="button"
              onClick={() => updateField('selling_price', String(priceSuggestion))}
              className="mt-1.5 text-xs text-[#2AA8DC]"
            >
              Appliquer le prix suggéré: {formatPrice(priceSuggestion)}
            </button>
          )}
        </div>

        {/* Supplier */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Fournisseur</label>
          <input
            type="text"
            placeholder="Nom du fournisseur"
            value={form.supplier}
            onChange={(e) => updateField('supplier', e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30"
          />
        </div>

        {/* Purchase date */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Date d&apos;achat</label>
          <input
            type="date"
            value={form.purchase_date}
            onChange={(e) => updateField('purchase_date', e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Notes</label>
          <textarea
            rows={3}
            placeholder="Notes supplémentaires..."
            value={form.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30 resize-none"
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 bg-[#2AA8DC] text-white rounded-xl font-semibold text-sm disabled:opacity-60 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Enregistrement...
            </>
          ) : (
            'Enregistrer le produit'
          )}
        </button>
      </div>
    </div>
  );
}
