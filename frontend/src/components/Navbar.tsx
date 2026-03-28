'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Map,
  Grid3X3,
  Building2,
  Tags,
  TrendingUp,
  MessageCircle,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Market Pulse', icon: BarChart3 },
  { href: '/heatmap', label: 'Heatmap', icon: Map },
  { href: '/gap-analysis', label: 'GAP Analysis', icon: Grid3X3 },
  { href: '/malls', label: 'Malls', icon: Building2 },
  { href: '/brands', label: 'Brands', icon: Tags },
  { href: '/trends', label: 'Trends', icon: TrendingUp },
  { href: '/assistant', label: 'AI Assistant', icon: MessageCircle },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <aside className="fixed top-0 left-0 h-screen w-60 flex flex-col border-r border-gray-100"
           style={{ background: '#FAFBFD' }}>
      <div className="px-6 py-6">
        <h1 className="text-xl font-bold tracking-tight" style={{ color: '#3EA8FF' }}>
          Shopingy
        </h1>
        <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
          Retail Intelligence
        </p>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'nav-link-active'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-6 py-4 border-t border-gray-100">
        <p className="text-xs" style={{ color: '#CBD5E1' }}>
          v0.1.0
        </p>
      </div>
    </aside>
  );
}
