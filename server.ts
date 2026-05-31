/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Marubozu Scanner — Server (static host only)
 *
 * All market data (tickers, klines, WebSocket streams) is fetched directly
 * from the Binance public API by the frontend. No API key is needed.
 * This server's only job is to serve the Vite dev middleware in development
 * and the built SPA in production.
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app  = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// ---------------------------------------------------------------------------
// Health check — useful for container orchestration / uptime monitors
// ---------------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', dataSource: 'Binance Public API (client-side)' });
});

// ---------------------------------------------------------------------------
// Vite middleware (dev) / static file serving (prod)
// ---------------------------------------------------------------------------
async function bootstrap() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA fallback — let React Router handle client-side routes
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Marubozu Scanner running at http://localhost:${PORT}`);
    console.log('Data source: Binance Public API (client-side, no API key required)');
  });
}

bootstrap();
