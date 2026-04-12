'use client';
// frontend/components/architecture/NodeDetailDrawer.tsx

import { useEffect } from 'react';
import { nodeDetails } from '@/components/architecture/data/nodeDetails';

interface Props {
  nodeId: string | null;
  onClose: () => void;
}

export function NodeDetailDrawer({ nodeId, onClose }: Props) {
  const detail = nodeId ? (nodeDetails[nodeId] ?? null) : null;
  const isOpen = nodeId !== null;

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      style={{
        position:        'fixed',
        top:             64, // below Navbar
        right:           0,
        bottom:          0,
        width:           400,
        backgroundColor: 'var(--color-bg-card)',
        borderLeft:      '1px solid var(--color-card-border)',
        transform:       isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition:      'transform 0.3s ease-out',
        zIndex:          40,
        overflowY:       'auto',
        padding:         '20px',
        display:         'flex',
        flexDirection:   'column',
        gap:             16,
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Close detail panel"
        style={{
          alignSelf:       'flex-end',
          background:      'none',
          border:          'none',
          color:           'var(--color-text-muted)',
          cursor:          'pointer',
          fontSize:        18,
          lineHeight:      1,
          padding:         4,
        }}
      >
        ✕
      </button>

      {/* Content — fades in after drawer slides in */}
      <div
        style={{
          opacity:    isOpen ? 1 : 0,
          transition: 'opacity 0.15s ease 0.1s',
          display:    'flex',
          flexDirection: 'column',
          gap:        16,
        }}
      >
        {detail ? (
          <>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
              {detail.title}
            </h2>

            {detail.filePath && (
              <code
                style={{
                  display:         'block',
                  fontSize:        11,
                  color:           'var(--color-text-muted)',
                  backgroundColor: '#111',
                  padding:         '4px 10px',
                  borderRadius:    4,
                }}
              >
                {detail.filePath}
              </code>
            )}

            <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--color-text-secondary)', margin: 0 }}>
              {detail.description}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {detail.facts.map(({ label, value }) => (
                <div
                  key={label}
                  style={{
                    display:             'grid',
                    gridTemplateColumns: '140px 1fr',
                    gap:                 8,
                    fontSize:            12,
                    padding:             '8px 0',
                    borderBottom:        '1px solid #2a2a2a',
                  }}
                >
                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>{label}</span>
                  <span style={{ color: 'var(--color-text-primary)' }}>{value}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          isOpen && (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              No details available for this node.
            </p>
          )
        )}
      </div>
    </div>
  );
}
