'use client';
// frontend/components/layout/ProfileDrawer.tsx

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { api } from '@/lib/api';
import { posterUrl } from '@/lib/formatters';
import type { ProfileData } from '@/lib/api';
import type { Phase } from '@/lib/types';

const PHASE_LABELS: Record<Phase, string> = {
  cold: 'Cold Start',
  warming: 'Warming Up',
  full: 'Full Mode',
};

const PHASE_DESC: Record<Phase, string> = {
  cold: 'Getting to know your taste',
  warming: 'Content-Based filtering active',
  full: 'Collaborative filtering active',
};

const PHASE_COLOR: Record<Phase, string> = {
  cold: '#3B82F6',
  warming: '#F59E0B',
  full: '#7C3AED',
};

const STAR_LABELS = ['', 'Hated it', 'Disliked', 'It\'s ok', 'Liked it', 'Loved it'];

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <svg key={s} width="10" height="10" viewBox="0 0 24 24"
          fill={s <= rating ? 'var(--color-star-active)' : 'var(--color-star-inactive)'}
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

interface ProfileDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function ProfileDrawer({ open, onClose }: ProfileDrawerProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.getProfile()
      .then(setProfile)
      .finally(() => setLoading(false));
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const phase = profile?.phase ?? 'cold';
  const count = profile?.ratingsCount ?? 0;
  const nextAt = profile?.nextPhaseAt ?? null;
  const progress = nextAt ? Math.min(count / nextAt, 1) : 1;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.aside
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed top-0 right-0 h-full z-50 flex flex-col"
            style={{
              width: '320px',
              backgroundColor: 'var(--color-bg-card)',
              borderLeft: '1px solid var(--color-border)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid var(--color-border)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: 'var(--color-brand)' }}
                >
                  CG
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">My Profile</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Anonymous session
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-lg leading-none"
                style={{ color: 'var(--color-text-muted)' }}
                aria-label="Close profile"
              >
                ✕
              </button>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div
                  className="w-6 h-6 rounded-full border-2 animate-spin"
                  style={{ borderColor: 'var(--color-brand) transparent transparent transparent' }}
                />
              </div>
            ) : profile && (
              <div className="flex-1 overflow-y-auto">

                {/* Phase card */}
                <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                      Engine Phase
                    </span>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded"
                      style={{ backgroundColor: `${PHASE_COLOR[phase]}22`, color: PHASE_COLOR[phase] }}
                    >
                      {PHASE_LABELS[phase]}
                    </span>
                  </div>
                  <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {PHASE_DESC[phase]}
                  </p>

                  {/* Progress bar */}
                  {nextAt && (
                    <>
                      <div
                        className="h-1.5 rounded-full overflow-hidden mb-1"
                        style={{ backgroundColor: 'var(--color-border)' }}
                      >
                        <motion.div
                          className="h-full rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress * 100}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          style={{ backgroundColor: PHASE_COLOR[phase] }}
                        />
                      </div>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {count} / {nextAt} ratings
                        {phase === 'cold' && ' to unlock Content-Based'}
                        {phase === 'warming' && ' to unlock Collaborative'}
                      </p>
                    </>
                  )}
                  {!nextAt && (
                    <p className="text-xs" style={{ color: 'var(--color-match)' }}>
                      All engines active · {count} total ratings
                    </p>
                  )}
                </div>

                {/* Stats row */}
                <div
                  className="grid grid-cols-3 px-0 py-3"
                  style={{ borderBottom: '1px solid var(--color-border)' }}
                >
                  {[
                    { label: 'Rated', value: count },
                    { label: 'Loved', value: profile.ratedMovies.filter(m => m.rating === 5).length },
                    { label: 'Avg', value: count > 0 ? (profile.ratedMovies.reduce((s, m) => s + m.rating, 0) / count).toFixed(1) : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex flex-col items-center py-1">
                      <span className="text-lg font-bold text-white tabular-nums">{value}</span>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                    </div>
                  ))}
                </div>

                {/* Rated movies list */}
                {profile.ratedMovies.length > 0 ? (
                  <div className="px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
                      Your Ratings
                    </p>
                    <div className="flex flex-col gap-3">
                      {profile.ratedMovies.map(m => (
                        <Link
                          key={m.movieId}
                          href={`/movie/${m.movieId}`}
                          onClick={onClose}
                          className="flex items-center gap-3 group"
                        >
                          {/* Poster */}
                          <div
                            className="flex-shrink-0 rounded overflow-hidden"
                            style={{ width: '36px', height: '52px', backgroundColor: 'var(--color-bg-base)' }}
                          >
                            {m.posterPath && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={posterUrl(m.posterPath)}
                                alt={m.title}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-sm font-medium truncate group-hover:underline"
                              style={{ color: 'white' }}
                            >
                              {m.title}
                            </p>
                            <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                              {m.releaseYear}
                            </p>
                            <StarRow rating={m.rating} />
                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                              {STAR_LABELS[m.rating]}
                            </p>
                          </div>

                          {/* Rating number */}
                          <span
                            className="flex-shrink-0 text-sm font-bold tabular-nums"
                            style={{ color: m.rating >= 4 ? 'var(--color-match)' : m.rating >= 3 ? 'var(--color-brand)' : 'var(--color-text-muted)' }}
                          >
                            {m.rating}/5
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="px-5 py-8 text-center">
                    <p className="text-2xl mb-2">🎬</p>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      No ratings yet — rate movies to train your engine
                    </p>
                  </div>
                )}
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
