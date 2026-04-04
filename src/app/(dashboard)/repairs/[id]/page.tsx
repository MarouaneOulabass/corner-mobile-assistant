'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Repair, RepairStatus } from '@/types';
import {
  formatPrice,
  formatDate,
  formatDateTime,
  repairStatusLabels,
  repairStatusColors,
  validRepairTransitions,
  generateWhatsAppLink,
} from '@/lib/utils';

export default function RepairDetailPage() {
  useAuth();
  const router = useRouter();
  const params = useParams();
  const repairId = params.id as string;

  const [repair, setRepair] = useState<Repair | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [finalCost, setFinalCost] = useState('');
  const [showFinalCost, setShowFinalCost] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRepair();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repairId]);

  async function fetchRepair() {
    setLoading(true);
    try {
      const res = await fetch(`/api/repairs/${repairId}`);
      if (res.ok) {
        const data = await res.json();
        setRepair(data);
        if (data.final_cost) setFinalCost(String(data.final_cost));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus: RepairStatus) {
    if (!repair) return;
    setError('');
    setUpdating(true);

    const body: Record<string, unknown> = {
      status: newStatus,
      status_note: statusNote || undefined,
    };

    // If completing and final cost is set
    if (newStatus === 'delivered' && finalCost) {
      body.final_cost = parseFloat(finalCost);
    }

    try {
      const res = await fetch(`/api/repairs/${repairId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setRepair(data);
        setStatusNote('');
      } else {
        const data = await res.json();
        setError(data.error || 'Erreur lors de la mise à jour.');
      }
    } catch {
      setError('Erreur de connexion.');
    } finally {
      setUpdating(false);
    }
  }

  async function handleSaveFinalCost() {
    if (!repair || !finalCost) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/repairs/${repairId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ final_cost: parseFloat(finalCost) }),
      });
      if (res.ok) {
        const data = await res.json();
        setRepair(data);
        setShowFinalCost(false);
      }
    } catch {
      // silent
    } finally {
      setUpdating(false);
    }
  }

  async function handleAiDiagnosis() {
    if (!repair) return;
    setAiLoading(true);
    setAiResult('');

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'repair_diagnosis',
          data: {
            device_brand: repair.device_brand,
            device_model: repair.device_model,
            problem: repair.problem,
            problem_categories: repair.problem_categories,
            condition_on_arrival: repair.condition_on_arrival,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiResult(data.result || data.response || 'Aucune suggestion.');
      } else {
        setAiResult('Erreur lors du diagnostic IA.');
      }
    } catch {
      setAiResult('Erreur de connexion.');
    } finally {
      setAiLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (!repair) {
    return (
      <div className="p-4 text-center py-12">
        <p className="text-gray-400 text-sm">Réparation introuvable</p>
      </div>
    );
  }

  const nextStatuses = validRepairTransitions[repair.status] || [];
  const isOverdue =
    repair.estimated_completion_date &&
    repair.status !== 'delivered' &&
    repair.status !== 'cancelled' &&
    new Date(repair.estimated_completion_date) < new Date();

  const whatsAppMessage = `Bonjour ${repair.customer?.name}, votre ${repair.device_model} est prêt à être récupéré chez Corner Mobile. À bientôt !`;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-gray-500 hover:text-gray-700"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">
            {repair.device_brand} {repair.device_model}
          </h1>
          <p className="text-xs text-gray-500">{repair.customer?.name}</p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white ${
            repairStatusColors[repair.status] || 'bg-gray-400'
          }`}
        >
          {repairStatusLabels[repair.status] || repair.status}
        </span>
      </div>

      {/* Overdue warning */}
      {isOverdue && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-sm text-red-600 font-medium">
            En retard - Date estimée: {formatDate(repair.estimated_completion_date!)}
          </p>
        </div>
      )}

      {/* Device info */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-2">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Appareil</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-400 text-xs">Marque</span>
            <p className="text-gray-900">{repair.device_brand}</p>
          </div>
          <div>
            <span className="text-gray-400 text-xs">Modèle</span>
            <p className="text-gray-900">{repair.device_model}</p>
          </div>
          {repair.imei && (
            <div className="col-span-2">
              <span className="text-gray-400 text-xs">IMEI</span>
              <p className="text-gray-900 font-mono text-xs">{repair.imei}</p>
            </div>
          )}
        </div>
      </div>

      {/* Customer */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-2">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Client</h2>
        <div className="text-sm">
          <p className="text-gray-900 font-medium">{repair.customer?.name}</p>
          <p className="text-gray-500">{repair.customer?.phone}</p>
        </div>
      </div>

      {/* Problem */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-2">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Problème</h2>
        {repair.problem_categories && repair.problem_categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {repair.problem_categories.map((cat) => (
              <span
                key={cat}
                className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full"
              >
                {cat}
              </span>
            ))}
          </div>
        )}
        <p className="text-sm text-gray-700">{repair.problem}</p>
        {repair.condition_on_arrival && (
          <div className="mt-2">
            <span className="text-gray-400 text-xs">État à l&apos;arrivée</span>
            <p className="text-sm text-gray-700">{repair.condition_on_arrival}</p>
          </div>
        )}
      </div>

      {/* Costs */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-2">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Coûts</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-400 text-xs">Coût estimé</span>
            <p className="text-gray-900 font-medium">{formatPrice(repair.estimated_cost)}</p>
          </div>
          <div>
            <span className="text-gray-400 text-xs">Acompte</span>
            <p className="text-gray-900 font-medium">{formatPrice(repair.deposit)}</p>
          </div>
          {repair.final_cost != null && (
            <div>
              <span className="text-gray-400 text-xs">Coût final</span>
              <p className="text-gray-900 font-semibold">{formatPrice(repair.final_cost)}</p>
            </div>
          )}
          {repair.estimated_completion_date && (
            <div>
              <span className="text-gray-400 text-xs">Date estimée</span>
              <p className={`${isOverdue ? 'text-red-500 font-medium' : 'text-gray-900'}`}>
                {formatDate(repair.estimated_completion_date)}
              </p>
            </div>
          )}
        </div>
        {repair.technician && (
          <div className="mt-1">
            <span className="text-gray-400 text-xs">Technicien</span>
            <p className="text-sm text-gray-900">{repair.technician.name}</p>
          </div>
        )}

        {/* Edit final cost */}
        {!showFinalCost &&
          repair.status !== 'delivered' &&
          repair.status !== 'cancelled' && (
            <button
              type="button"
              onClick={() => setShowFinalCost(true)}
              className="text-xs text-[#2AA8DC] font-medium mt-1"
            >
              Modifier le coût final
            </button>
          )}
        {showFinalCost && (
          <div className="flex gap-2 mt-2">
            <input
              type="number"
              placeholder="Coût final (MAD)"
              value={finalCost}
              onChange={(e) => setFinalCost(e.target.value)}
              className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30"
            />
            <button
              type="button"
              onClick={handleSaveFinalCost}
              disabled={updating}
              className="px-3 py-2 bg-[#2AA8DC] text-white rounded-lg text-xs font-medium disabled:opacity-50"
            >
              OK
            </button>
          </div>
        )}
      </div>

      {/* Status Timeline */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Historique
        </h2>
        {repair.status_logs && repair.status_logs.length > 0 ? (
          <div className="relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200" />
            <div className="space-y-4">
              {repair.status_logs.map((log, index) => (
                <div key={log.id} className="flex gap-3 relative">
                  <div
                    className={`w-4 h-4 rounded-full shrink-0 mt-0.5 border-2 border-white z-10 ${
                      index === repair.status_logs!.length - 1
                        ? repairStatusColors[log.status] || 'bg-gray-400'
                        : 'bg-gray-300'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {repairStatusLabels[log.status] || log.status}
                      </span>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {formatDateTime(log.changed_at)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {log.user?.name || 'Système'}
                      {log.notes ? ` - ${log.notes}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Aucun historique</p>
        )}
      </div>

      {/* WhatsApp button when ready */}
      {repair.status === 'ready' && repair.customer?.phone && (
        <a
          href={generateWhatsAppLink(repair.customer.phone, whatsAppMessage)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 bg-[#25D366] text-white font-semibold rounded-xl text-sm hover:bg-[#20bd5a] active:scale-[0.98] transition-all"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Notifier via WhatsApp
        </a>
      )}

      {/* Status transition buttons */}
      {nextStatuses.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Changer le statut
          </h2>
          <input
            type="text"
            placeholder="Note (optionnel)"
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC]/30"
          />
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map((status) => (
              <button
                key={status}
                onClick={() => handleStatusChange(status as RepairStatus)}
                disabled={updating}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all active:scale-95 disabled:opacity-50 ${
                  status === 'cancelled'
                    ? 'bg-red-500 hover:bg-red-600'
                    : repairStatusColors[status] || 'bg-gray-500'
                } hover:opacity-90`}
              >
                {repairStatusLabels[status] || status}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI Diagnosis */}
      {repair.status !== 'delivered' && repair.status !== 'cancelled' && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
          <button
            onClick={handleAiDiagnosis}
            disabled={aiLoading}
            className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold rounded-xl text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {aiLoading ? 'Analyse en cours...' : 'Demander diagnostic IA'}
          </button>
          {aiResult && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-purple-700 mb-1">Diagnostic IA</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{aiResult}</p>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}
