'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { auth } from '@/lib/auth';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: '📊', roles: ['ADMIN', 'MANAGER', 'CASHIER'] },
  { href: '/admin/products', label: 'Products', icon: '📦', roles: ['ADMIN', 'MANAGER', 'CASHIER'] },
  { href: '/admin/inventory', label: 'Inventory', icon: '🏪', roles: ['ADMIN', 'MANAGER', 'CASHIER'] },
  { href: '/admin/reports', label: 'Reports', icon: '📈', roles: ['ADMIN', 'MANAGER'] },
  { href: '/admin/audit', label: 'Audit Log', icon: '🔍', roles: ['ADMIN'] },
  { href: '/admin/users', label: 'Users', icon: '👥', roles: ['ADMIN'] },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setUser(auth.getUser());
  }, []);

  const handleLogout = () => {
    auth.logout();
    router.push('/login');
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-56 bg-blue-800 text-white flex flex-col">
        <div className="px-4 py-5 border-b border-blue-700">
          <h1 className="font-bold text-sm leading-tight">Tangub City Hardware</h1>
          <p className="text-blue-300 text-xs mt-1">Admin Panel</p>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            if (!item.roles.includes(user?.role)) return null;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-blue-100 hover:bg-blue-700'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-blue-700">
          <div className="text-xs text-blue-300 mb-1">{user?.name}</div>
          <div className="text-xs text-blue-400 mb-3">{user?.role}</div>
          <div className="flex gap-2">
            <Link
              href="/"
              className="flex-1 text-center text-xs bg-blue-700 hover:bg-blue-600 px-2 py-1 rounded text-blue-100 transition"
            >
              POS
            </Link>
            <button
              onClick={handleLogout}
              className="flex-1 text-xs bg-red-700 hover:bg-red-600 px-2 py-1 rounded text-white transition"
            >
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
