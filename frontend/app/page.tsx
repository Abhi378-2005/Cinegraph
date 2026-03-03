'use client';
// frontend/app/page.tsx

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { hasExistingToken, getOrCreateToken } from '@/lib/session';
import { api } from '@/lib/api';
import { GenrePicker } from '@/components/onboarding/GenrePicker';

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // If user already has a session cookie → skip onboarding
    if (hasExistingToken()) {
      router.replace('/discover');
      return;
    }
    // Create token for the first-time visitor
    getOrCreateToken();
    setChecked(true);
  }, [router]);

  const handleSubmit = async (genres: string[]) => {
    setLoading(true);
    await api.startColdStart(genres);
    router.push('/discover');
  };

  if (!checked) return null; // Wait for session check before rendering

  return <GenrePicker onSubmit={handleSubmit} loading={loading} />;
}
