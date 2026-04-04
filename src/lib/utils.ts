import { type ClassValue, clsx } from 'clsx';

// Simple class merge utility (no tailwind-merge dependency needed for basic usage)
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// Format price in MAD
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('fr-MA', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' MAD';
}

// Format date in Moroccan format
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Format datetime
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// IMEI Luhn validation
export function validateIMEI(imei: string): boolean {
  if (!/^\d{15}$/.test(imei)) return false;

  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let digit = parseInt(imei[i], 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

// Generate WhatsApp link
export function generateWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const phoneWithCountry = cleanPhone.startsWith('212') ? cleanPhone : `212${cleanPhone.replace(/^0/, '')}`;
  return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
}

// Condition labels in French
export const conditionLabels: Record<string, string> = {
  new: 'Neuf',
  like_new: 'Comme neuf',
  good: 'Bon état',
  fair: 'État correct',
  poor: 'Mauvais état',
};

// Status labels in French
export const statusLabels: Record<string, string> = {
  in_stock: 'En stock',
  sold: 'Vendu',
  in_repair: 'En réparation',
  transferred: 'Transféré',
  returned: 'Retourné',
};

// Repair status labels
export const repairStatusLabels: Record<string, string> = {
  received: 'Reçu',
  diagnosing: 'Diagnostic',
  waiting_parts: 'Attente pièces',
  in_repair: 'En réparation',
  ready: 'Prêt',
  delivered: 'Livré',
  cancelled: 'Annulé',
};

// Status colors
export const statusColors: Record<string, string> = {
  in_stock: 'bg-green-500',
  sold: 'bg-blue-500',
  in_repair: 'bg-yellow-500',
  transferred: 'bg-purple-500',
  returned: 'bg-red-500',
};

// Repair status colors
export const repairStatusColors: Record<string, string> = {
  received: 'bg-gray-500',
  diagnosing: 'bg-blue-500',
  waiting_parts: 'bg-yellow-500',
  in_repair: 'bg-orange-500',
  ready: 'bg-green-500',
  delivered: 'bg-emerald-600',
  cancelled: 'bg-red-500',
};

// Valid repair status transitions
export const validRepairTransitions: Record<string, string[]> = {
  received: ['diagnosing', 'cancelled'],
  diagnosing: ['waiting_parts', 'in_repair', 'cancelled'],
  waiting_parts: ['in_repair', 'cancelled'],
  in_repair: ['ready', 'waiting_parts', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};
