// Demo is the safe default when no Supabase project is configured.
const queryDemo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1';
const cloudConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
export const isDemoMode = queryDemo || import.meta.env.VITE_DEMO_MODE === 'true' || !cloudConfigured;
