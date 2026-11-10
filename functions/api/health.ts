/**
 * Cloudflare Pages Function: /api/health
 */
export const onRequestGet = async () => {
  return new Response(
    JSON.stringify({
      status: 'healthy',
      app: 'Comfort Business Operational System (COBOS)',
      architecture: 'Offline-First PWA + Cloudflare D1 SQLite',
      timestamp: new Date().toISOString(),
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
