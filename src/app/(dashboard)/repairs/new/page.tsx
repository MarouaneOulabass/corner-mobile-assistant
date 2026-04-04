'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Customer, User } from '@/types';

const commonProblems = [
  'Écran cassé',
  'Batterie',
  'Port de charge',
  'Caméra',
  "Dégâts d'eau",
  'Autre',
];

export default function NewRepairPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Customer state
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [searchingCustomers, setSearchingCustomers] = useState(false);

  // Device
  const [deviceBrand, setDeviceBrand] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [imei, setImei] = useState('');

  // Problem
  const [problemText, setProblemText] = useState('');
  const [selectedProblems, setSelectedProblems] = useState<string[]>([]);

  // Details
  const [conditionOnArrival, setConditionOnArrival] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [estimatedDate, setEstimatedDate] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [deposit, setDeposit] = useState('');

  // Technicians
  const [technicians, setTechnicians] = useState<User[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch technicians from same store
  useEffect(() => {
    if (!user) return;
    supabase
      .from('users')
      .select('id, name, role')
      .eq('store_id', user.store_id)
      .then(({ data }) => {
        if (data) setTechnicians(data as User[]);
      });
  }, [user]);

  // Search customers by phone
  const searchCustomers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setCustomers([]);
      return;
    }
    setSearchingCustomers(true);
    const { data } = await supabase
      .from('customers')
      .select('*')
      .or(`phone.ilike.%${query}%,name.ilike.%${query}%`)
      .limit(5);
    setCustomers(data || []);
    setSearchingCustomers(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchCustomers(customerSearch), 300);
    return () => clearTimeout(timer);
  }, [customerSearch, searchCustomers]);

  function toggleProblem(problem: string) {
    setSelectedProblems((prev) =>
      prev.includes(problem)
        ? prev.filter((p) => p !== problem)
        : [...prev, problem]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      let customerId = selectedCustomer?.id;

      // Create new customer if needed
      if (!customerId && showNewCustomer) {
        if (!newCustomerName || !newCustomerPhone) {
          setError('Le nom et le téléphone du client sont requis.');
          setSubmitting(false);
          return;
        }

        const { data: newCust, error: custErr } = await supabase
          .from('customers')
          .insert({ name: newCustomerName, phone: newCustomerPhone })
          .select()
          .single();

        if (custErr || !newCust) {
          setError('Erreur lors de la création du client.');
          setSubmitting(false);
          return;
        }
        customerId = newCust.id;
      }

      if (!customerId) {
        setError('Veuillez sélectionner ou créer un client.');
        setSubmitting(false);
        return;
      }

      const body = {
        customer_id: customerId,
        store_id: user?.store_id,
        device_brand: deviceBrand,
        device_model: deviceModel,
        imei: imei || undefined,
        problem: problemText,
        problem_categories: selectedProblems,
        condition_on_arrival: conditionOnArrival || undefined,
        estimated_cost: parseFloat(estimatedCost) || 0,
        estimated_completion_date: estimatedDate || undefined,
        technician_id: technicianId || undefined,
        deposit: parseFloat(deposit) || 0,
      };

      const res = await fetch('/api/repairs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erreur lors de la création.');
        setSubmitting(false);
        return;
      }

      const repair = await res.json();
      router.push(`/repairs/${repair.id}`);
    } catch {
      setError('Erreur de connexion.');
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="text-gray-500 hover:text-gray-700"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">Nouvelle réparation</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Section */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Client</h2>

          {selectedCustomer ? (
            <div className="bg-[#2AA8DC]/5 border border-[#2AA8DC]/20 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm text-gray-900">{selectedCustomer.name}</p>
                <p className="text-xs text-gray-500">{selectedCustomer.phone}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomer(null);
                  setCustomerSearch('');
                }}
                className="text-xs text-red-500 font-medium"
              >
                Changer
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                placeholder="Rechercher par téléphone ou nom..."
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setShowNewCustomer(false);
                }}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30 focus:border-[#2AA8DC]"
              />

              {searchingCustomers && (
                <p className="text-xs text-gray-400">Recherche...</p>
              )}

              {customers.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {customers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(c);
                        setCustomerSearch('');
                        setCustomers([]);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.phone}</p>
                    </button>
                  ))}
                </div>
              )}

              {customerSearch.length >= 2 && customers.length === 0 && !searchingCustomers && (
                <button
                  type="button"
                  onClick={() => {
                    setShowNewCustomer(true);
                    setNewCustomerPhone(customerSearch.replace(/\D/g, '') ? customerSearch : '');
                  }}
                  className="text-sm text-[#2AA8DC] font-medium"
                >
                  + Créer un nouveau client
                </button>
              )}

              {showNewCustomer && (
                <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <input
                    type="text"
                    placeholder="Nom du client"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30"
                  />
                  <input
                    type="tel"
                    placeholder="Téléphone"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30"
                  />
                </div>
              )}
            </>
          )}
        </section>

        {/* Device Section */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Appareil</h2>
          <input
            type="text"
            placeholder="Marque (ex: Samsung, Apple)"
            value={deviceBrand}
            onChange={(e) => setDeviceBrand(e.target.value)}
            required
            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30 focus:border-[#2AA8DC]"
          />
          <input
            type="text"
            placeholder="Modèle (ex: Galaxy S24, iPhone 15)"
            value={deviceModel}
            onChange={(e) => setDeviceModel(e.target.value)}
            required
            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30 focus:border-[#2AA8DC]"
          />
          <input
            type="text"
            placeholder="IMEI (optionnel)"
            value={imei}
            onChange={(e) => setImei(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30 focus:border-[#2AA8DC]"
          />
        </section>

        {/* Problem Section */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Problème</h2>
          <div className="flex flex-wrap gap-2">
            {commonProblems.map((problem) => (
              <button
                key={problem}
                type="button"
                onClick={() => toggleProblem(problem)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedProblems.includes(problem)
                    ? 'bg-[#2AA8DC] text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {problem}
              </button>
            ))}
          </div>
          <textarea
            placeholder="Description détaillée du problème..."
            value={problemText}
            onChange={(e) => setProblemText(e.target.value)}
            required
            rows={3}
            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30 focus:border-[#2AA8DC] resize-none"
          />
        </section>

        {/* Condition */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            État à l&apos;arrivée
          </h2>
          <textarea
            placeholder="État général de l'appareil à la réception..."
            value={conditionOnArrival}
            onChange={(e) => setConditionOnArrival(e.target.value)}
            rows={2}
            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30 focus:border-[#2AA8DC] resize-none"
          />
        </section>

        {/* Cost & Date */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Détails</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Coût estimé (MAD)</label>
              <input
                type="number"
                placeholder="0"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                required
                min="0"
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30 focus:border-[#2AA8DC]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Acompte (MAD)</label>
              <input
                type="number"
                placeholder="0"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                min="0"
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30 focus:border-[#2AA8DC]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date de fin estimée</label>
            <input
              type="date"
              value={estimatedDate}
              onChange={(e) => setEstimatedDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30 focus:border-[#2AA8DC]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Technicien</label>
            <select
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30 focus:border-[#2AA8DC]"
            >
              <option value="">Sélectionner un technicien</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-[#2AA8DC] text-white font-semibold rounded-xl text-sm hover:bg-[#2590c0] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Création en cours...' : 'Créer la réparation'}
        </button>
      </form>
    </div>
  );
}
