'use client';

import { ArchitectureFlow } from '@/components/architecture/ArchitectureFlow';

export default function ArchitecturePage() {
  return (
    <div className="w-screen h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <ArchitectureFlow />
    </div>
  );
}
