'use client';
// frontend/components/layout/NavbarWrapper.tsx

import { usePathname } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';

export function NavbarWrapper() {
  const pathname = usePathname();
  if (pathname === '/') return null;
  return <Navbar />;
}
