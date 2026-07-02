import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { initRealtime } from './realtime/io.js';

const app = createApp();
const httpServer = createServer(app);
initRealtime(httpServer);

httpServer.listen(env.port, () => {
  logger.info(`🚀 KIM API rodando em http://localhost:${env.port}`);
  logger.info(`   IA: ${env.ai.enabled ? 'habilitada (' + env.ai.model + ')' : 'DESABILITADA (modo demo)'}`);
  logger.info(`   WhatsApp: ${env.whatsapp.enabled ? 'habilitado' : 'DESABILITADO (modo demo)'}`);
});

const shutdown = () => {
  logger.info('Encerrando servidor...');
  httpServer.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
