'use client';
// frontend/components/layout/Navbar.tsx

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getPhase } from '@/lib/session';
import { ProfileDrawer } from '@/components/layout/ProfileDrawer';
import { SearchBar } from '@/components/layout/SearchBar';
import type { Phase } from '@/lib/types';

const PHASE_LABELS: Record<Phase, string> = {
  cold: 'COLD',
  warming: 'WARMING',
  full: 'FULL',
};

const PHASE_COLORS: Record<Phase, string> = {
  cold: 'bg-blue-600',
  warming: 'bg-amber-500',
  full: 'bg-violet-600',
};

const NAV_LINKS = [
  { href: '/discover', label: 'Discover' },
  { href: '/graph', label: 'Graph' },
];

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [phase, setPhase] = useState<Phase>('cold');
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    setPhase(getPhase());
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 h-16 transition-all duration-300"
      style={{
        backgroundColor: scrolled ? 'var(--color-bg-navbar)' : 'transparent',
        backdropFilter: scrolled ? 'blur(8px)' : 'none',
      }}
    >
      {/* Logo */}
      <Link href="/discover" className="text-xl font-bold tracking-tight text-white select-none">
        Cine<span style={{ color: 'var(--color-brand)' }}>Graph</span>
      </Link>

      {/* Nav links */}
      <div className="flex items-center gap-6">
        {NAV_LINKS.map(({ href, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="text-sm font-medium transition-colors duration-150"
              style={{
                color: active ? 'var(--color-brand)' : 'var(--color-text-secondary)',
                borderBottom: active ? '2px solid var(--color-brand)' : '2px solid transparent',
                paddingBottom: '2px',
              }}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Right: Search + Phase badge + avatar */}
      <div className="flex items-center gap-3">
        <SearchBar />
        <span
          className={`text-xs font-bold px-2 py-1 rounded ${PHASE_COLORS[phase]} text-white tracking-wider`}
        >
          {PHASE_LABELS[phase]}
        </span>
        <button
          onClick={() => setProfileOpen(true)}
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white transition-opacity hover:opacity-80"
          style={{ backgroundColor: 'var(--color-brand)' }}
          aria-label="Open profile"
        >
          CG
        </button>
      </div>

      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </nav>
  );
}
