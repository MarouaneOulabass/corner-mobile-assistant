'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/auth';

const menuItems = [
  {
    title: 'Réparations',
    description: 'Gérer les tickets de réparation',
    href: '/repairs',
    icon: '🔧',
    minRole: 'seller' as const,
  },
  {
    title: 'Clients',
    description: 'Base de données clients',
    href: '/customers',
    icon: '👥',
    minRole: 'seller' as const,
  },
  {
    title: 'Rapports',
    description: 'Analyses et statistiques',
    href: '/reports',
    icon: '📊',
    minRole: 'manager' as const,
  },
  {
    title: 'Utilisateurs',
    description: 'Gérer les comptes',
    href: '/users',
    icon: '⚙️',
    minRole: 'superadmin' as const,
  },
];

export default function MenuPage() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Menu</h1>

      {/* User Card */}
      <div className="p-4 bg-gradient-to-r from-[#2AA8DC] to-[#2AA8DC]/80 rounded-2xl text-white mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
            {user.name.charAt(0)}
          </div>
          <div>
            <p className="font-semibold">{user.name}</p>
            <p className="text-sm text-white/80">{user.role} — {user.store?.name}</p>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="space-y-2">
        {menuItems
          .filter((item) => hasPermission(user.role, item.minRole))
          .map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-[#2AA8DC]/30 transition"
            >
              <span className="text-2xl">{item.icon}</span>
              <div>
                <p className="font-medium text-gray-900">{item.title}</p>
                <p className="text-sm text-gray-500">{item.description}</p>
              </div>
              <svg className="w-5 h-5 text-gray-300 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
      </div>

      {/* Logout */}
      <button
        onClick={logout}
        className="w-full mt-8 py-3 text-center text-red-500 text-sm font-medium"
      >
        Se déconnecter
      </button>

      <p className="text-center text-gray-400 text-xs mt-4">
        Corner Mobile v1.0
      </p>
    </div>
  );
}
