'use client';
// frontend/components/layout/Toast.tsx

import { useEffect } from 'react';

interface ToastProps {
  message: string;
  onDismiss: () => void;
}

export function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className="fixed top-20 right-4 z-50 px-4 py-3 rounded shadow-lg text-sm font-medium text-white"
      style={{
        backgroundColor: 'var(--color-brand)',
        borderLeft: '4px solid var(--color-brand-bright)',
        maxWidth: '320px',
      }}
    >
      {message}
    </div>
  );
}
