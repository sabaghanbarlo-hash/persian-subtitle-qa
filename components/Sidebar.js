'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/review', label: 'New Review' },
  { href: '/projects', label: 'Projects' },
  { href: '/translation-memory', label: 'Translation Memory' },
  { href: '/ai-models', label: 'AI Models' },
  { href: '/settings', label: 'Settings' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">Subtitle QA</span>
        <span className="brand-tc">00:00:01,000</span>
      </div>

      <nav className="nav">
        {NAV_ITEMS.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={`nav-item${active ? ' active' : ''}`}>
              <span className="dot" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        English → Persian anime subtitle QA.
        <br />
        Keys stay server-side.
      </div>
    </aside>
  );
}
