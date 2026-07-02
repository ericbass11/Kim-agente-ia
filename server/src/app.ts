import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { webhooksRouter } from './routes/webhooks.js';
import { apiRouter } from './routes/api.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.webOrigin }));

  // captura o corpo bruto (necessário para validar a assinatura do webhook da Meta)
  app.use(
    express.json({
      verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      ai: env.ai.enabled,
      whatsapp: env.whatsapp.enabled,
      time: new Date().toISOString(),
    });
  });

  app.use('/api/webhooks', webhooksRouter);
  app.use('/api', apiRouter);

  // tratamento de erros
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Dados inválidos', details: err.issues });
    }
    logger.error({ err }, 'Erro não tratado na API.');
    res.status(500).json({ error: 'Erro interno' });
  });

  return app;
}
