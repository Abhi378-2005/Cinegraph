// frontend/components/architecture/nodes/layerColors.ts
// Shared layer color map — one source of truth for both node components

export const LAYER_COLORS: Record<string, string> = {
  user:     '#3B82F6',
  frontend: '#10B981',
  backend:  '#7C3AED',
  data:     '#F59E0B',
};

export const LAYER_DELAY: Record<string, string> = {
  user:     '0ms',
  frontend: '150ms',
  backend:  '300ms',
  data:     '450ms',
};
